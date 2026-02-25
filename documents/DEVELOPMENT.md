# DEVELOPMENT.md

Краткий контрольный контур для dev/prod запуска.

Статус: `Draft` (источник истины — код/скрипты).

## Implemented

## Переменные
- `API_PORT` (default: 3000)
- `NEXT_PUBLIC_API_BASE_URL` (default: http://localhost:3000)

## Dev запуск
1) Infra (Docker):
   - `pnpm dev:infra`
2) Backend (API + Worker):
   - `pnpm dev:backend`
3) Web (локально):
   - `pnpm dev:web`

Примечание: команды `dev:web` и `smoke` рассчитаны на bash (macOS/Linux). На Windows используйте WSL или задайте переменные окружения вручную.

## Рекомендованный локальный runbook (`Implemented`)

Проверено локально (macOS, 2026-02-20):
- `pnpm dev:infra` и `pnpm dev:backend` поднимают `postgres`, `redis`, `minio`, `api`, `worker` без ошибок.
- `pnpm dev:web` поднимает Next.js на `http://localhost:3001`.
- `GET /login` возвращает `200`.
- `pnpm build:backend`, `pnpm build:web`, `pnpm typecheck` проходят успешно.

### 1) Подготовка окружения (один раз или после чистки зависимостей)
1) Установить зависимости workspace:
   - `CI=true DATABASE_URL=postgresql://continuum:continuum@localhost:5432/continuum pnpm -r install --force`
2) Проверить, что web-бинарники доступны:
   - `ls -l apps/web/node_modules/.bin/next apps/web/node_modules/.bin/tsc`

### 2) Ежедневная разработка
1) Поднять infra:
   - `pnpm dev:infra`
2) Поднять backend в Docker:
   - `pnpm dev:backend`
3) Запустить frontend локально:
   - `pnpm dev:web`
4) Быстрый smoke:
   - `pnpm smoke`

### 3) Проверка перед push
1) Backend production build (только Docker):
   - `pnpm build:backend`
2) Frontend/shared build:
   - `pnpm build:web`
3) Typecheck:
   - `pnpm typecheck`
4) Test (пока placeholder):
   - `pnpm test`

## Smoke-check
Убедитесь, что infra и backend подняты, web запущен локально:
- `pnpm smoke`

Проверяет:
1) API `/health` и `/ready`
2) `POST /debug/enqueue-ping`
3) Web `/login`

## Build/typecheck/test контур
- Backend build (только Docker): `pnpm build:backend`
- Backend build для dev compose (опционально): `pnpm build:backend:dev`
- Frontend/shared build: `pnpm build:web`
- Полный build (backend docker + web/shared): `pnpm build`
- Typecheck (web/shared): `pnpm typecheck`
- Test (текущий placeholder): `pnpm test`

Примечание: backend docker build в агентском sandbox-окружении может быть недоступен по правам к Docker socket; для гарантированного результата запускать вне sandbox (обычный терминал/VPS/CI runner).

Примечание: сейчас `test` в пакетах — placeholder-команды без unit/integration набора.

## Инвариант: backend build only in Docker (`Implemented`)
- `apps/api` и `apps/worker` не должны собираться на хосте напрямую.
- Скрипты `build`/`typecheck` в `apps/api` и `apps/worker` содержат guard `scripts/ensure-docker-build.cjs`.
- При запуске вне контейнера сборка завершается ошибкой с подсказкой использовать Docker Compose.

## Шрифты frontend (Implemented)
- `Inter` и `Unbounded` подключены локально через `@fontsource/inter` и `@fontsource/unbounded`.
- Для `Unbounded` подключены веса `300/400/500/600/700`, чтобы исключить weight-fallback на экранах с заголовками `500+`.
- На логин-экране бренд-текст оставлен в `font-weight: 300` для соответствия историческому визуалу.
- Сборка web больше не зависит от `next/font/google` / `fonts.googleapis.com`.

## Prisma / миграции
1) Схема менялась → создаём миграцию в контейнере:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"`
2) Если в рантайме появились ошибки вида `Property 'course' does not exist on type 'PrismaService'` — заново сгенерировать клиент:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"`
3) Prisma v7 читает env из `apps/api/prisma.config.ts`. Для локального запуска обязательно доступны `DATABASE_URL` или `POSTGRES_*`.
4) Production manual migration (до deploy):
   - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`

## Production deploy артефакты
- `docker-compose.prod.yml` — production compose без bind-монтажей исходников.
- `deploy/env/*.env` — service-specific env files (`api`, `worker`, `postgres`, `redis`).
- `deploy/systemd/continuum-web.service` — systemd unit для Next.js frontend.
- `deploy/nginx/continuum.conf` — reverse proxy `/` и `/api/` + TLS контур.
- `deploy/README.md` — пошаговый runbook (GitHub, VPS, migrations, rollback).

Production policy (`Implemented`):
- object storage в production — внешний S3-провайдер (Beget S3);
- MinIO используется только в dev-окружении (`docker compose` без `-f docker-compose.prod.yml`).

## Lockfile / зависимости (Docker)
1) Docker сборки используют `--frozen-lockfile`, поэтому lockfile должен быть актуальным.
2) После изменения `package.json` запускать в корне:
   - `pnpm -r install`
   - в репозитории включён `recursive-install=true` (`.npmrc`), чтобы install ставил все workspace-пакеты, а не только root.
3) Если build падает на Corepack/pnpm download:
   - проверить доступ в сеть (registry.npmjs.org),
   - повторить сборку после успешной установки зависимостей.

## Troubleshooting (накопление граблей)

Границы раздела:
- Здесь фиксируем только run/deploy проблемы окружения (dev/prod контур, build, миграции, сервисы).
- Доменные инварианты публикации вынесены в `documents/CONTENT.md`.
- Auth/storage edge-cases вынесены в `documents/SECURITY.md` и `deploy/README.md`.

- **Симптом:** `pnpm smoke` возвращает `TypeError: fetch failed` для всех endpoint checks.
- **Команда:** `pnpm smoke`
- **Причина:** sandbox-сеть блокирует доступ к локальным портам в текущей среде запуска.
- **Фикс:** выполнить те же проверки вне sandbox (escalated shell) через `curl`.
- **Проверка:** `curl -fsS http://localhost:3000/health` и `curl -fsS http://localhost:3000/ready`.

- **Симптом:** backend docker build не стартует из агентской сессии с `permission denied ... docker.sock`.
- **Команда:** `pnpm build:backend` или `docker compose -f docker-compose.prod.yml build api worker`
- **Причина:** у sandbox-процесса нет прав на Docker daemon socket (`/Users/<user>/.docker/run/docker.sock`).
- **Фикс:** запускать команды вне sandbox/с повышенными правами (или напрямую в обычном терминале пользователя).
- **Проверка:** `docker compose -f docker-compose.prod.yml build api worker` завершается без ошибки доступа к socket.

- **Симптом:** на production после `docker compose up -d` неожиданно запускается `minio`, а `api` падает с `Bind for 127.0.0.1:3000 failed: port is already allocated`.
- **Команда:** `docker compose up -d`
- **Причина:** запущен dev compose (`docker-compose.yml`) вместо production compose (`docker-compose.prod.yml`).
- **Фикс:**
  - остановить dev-контур: `docker compose down --remove-orphans`
  - (опционально) удалить dev volumes: `docker compose down --remove-orphans -v`
  - поднять production-контур: `docker compose -f docker-compose.prod.yml up -d postgres redis && docker compose -f docker-compose.prod.yml up -d --build api worker`
- **Проверка:** `docker compose -f docker-compose.prod.yml ps` и `curl -fsS http://127.0.0.1:3000/health`.

- **Симптом:** `git pull --ff-only` блокируется на `deploy/env/*.env` (`would be overwritten by merge`) после перехода на `.env.example`.
- **Команда:** `git pull --ff-only`
- **Причина:** на сервере остались локальные правки в старых tracked `.env`, а в репозитории файлы уже переименованы в `*.env.example`.
- **Фикс:**
  - сделать backup: `mkdir -p .env-backup && cp deploy/env/*.env .env-backup/`
  - временно убрать tracked-изменения: `git stash push -m "server-env-before-untrack" -- deploy/env/api.env deploy/env/postgres.env deploy/env/worker.env deploy/env/redis.env`
  - выполнить `git pull --ff-only`
  - восстановить runtime env: `for f in api worker postgres redis; do [ -f "deploy/env/$f.env" ] || cp "deploy/env/$f.env.example" "deploy/env/$f.env"; done && cp .env-backup/*.env deploy/env/ && rm -rf .env-backup`
- **Проверка:** `git status --short` пустой, а последующие `git pull --ff-only` проходят без конфликтов по `deploy/env/*.env`.

- **Симптом:** `pnpm install` падает с `ENOTFOUND registry.npmjs.org`.
- **Команда:** `CI=true pnpm install`
- **Причина:** отсутствует DNS/egress доступ к npm registry в текущем окружении.
- **Фикс:** повторить установку в окружении с внешней сетью (CI runner или VPS).
- **Проверка:** `pnpm install --frozen-lockfile` завершается без retry/fetch ошибок.

- **Симптом:** агент запускает `CI=true pnpm install --frozen-lockfile` в sandbox и получает нестабильные сетевые ошибки.
- **Команда:** `CI=true pnpm install --frozen-lockfile`
- **Причина:** в агентском окружении нет гарантированного доступа к npm registry.
- **Фикс:** для агента эта команда запрещена; выполнять её должен пользователь в локальном терминале.
- **Проверка:** агент запрашивает локальный запуск команды у пользователя вместо самостоятельного выполнения.

- **Симптом:** после install появляется предупреждение `Ignored build scripts: ...`.
- **Команда:** `pnpm install --frozen-lockfile`
- **Причина:** pnpm v10 по умолчанию блокирует lifecycle build scripts без явного allowlist.
- **Фикс:** в корневом `package.json` зафиксирован `pnpm.onlyBuiltDependencies` для требуемых пакетов (`@nestjs/core`, `@prisma/engines`, `argon2`, `msgpackr-extract`, `prisma`).
- **Проверка:** install не требует ручного `pnpm approve-builds` в стандартном потоке.

- **Симптом:** install падал на `apps/api postinstall: prisma generate` с ошибкой про `DATABASE_URL or POSTGRES_*`.
- **Команда:** `pnpm install --filter @continuum/api...`
- **Причина:** раньше `@continuum/api` запускал `prisma generate` в `postinstall`, а Prisma config требует DB env.
- **Фикс:** `postinstall` удалён; генерация Prisma выполняется только явно (`pnpm --filter @continuum/api prisma:generate`) или в Docker build.
- **Проверка:** `pnpm install --frozen-lockfile` проходит без требования `DATABASE_URL` на этапе install.

- **Симптом:** `pnpm build`/`pnpm typecheck` падают с `tsc: command not found` (обычно в `@continuum/worker`) или `next: command not found` (в `web`).
- **Команда:** `pnpm build` или `pnpm --filter web run build`
- **Причина:** частичная установка зависимостей через `pnpm install --filter ...` пересоздаёт общий `node_modules`, и часть пакетов остаётся без локальных бинарей (`apps/*/node_modules/.bin`).
- **Фикс:**
  - очистить локальные зависимости: `rm -rf node_modules apps/web/node_modules apps/worker/node_modules packages/shared/node_modules`
  - выполнить полную установку в сети с доступом к npm: `CI=true pnpm -r install --force`
  - если снова `ENOTFOUND`, проверить DNS: `curl -I https://registry.npmjs.org` (должен вернуться HTTP-ответ)
- **Проверка:** существуют `apps/web/node_modules/.bin/next` и `apps/web/node_modules/.bin/tsc`, затем `pnpm build:web` и `pnpm typecheck` проходят.

- **Симптом:** backend build/typecheck запускается на хосте и сразу падает.
- **Команда:** `pnpm --filter @continuum/api run build` или `pnpm --filter @continuum/worker run build`
- **Причина:** включён guard `Backend build/typecheck is allowed only inside Docker containers.`
- **Фикс:** использовать `pnpm build:backend` (или `pnpm build:backend:dev`).
- **Проверка:** `docker compose -f docker-compose.prod.yml build api worker` завершается успешно.

- **Симптом:** backend health-check успешен, но `/login` недоступен.
- **Команда:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/login`
- **Причина:** frontend-процесс не запущен (в dev нужно отдельно запускать `pnpm dev:web`; в production — `continuum-web.service`).
- **Фикс (dev):** `pnpm dev:web`
- **Фикс (prod):** `NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build && sudo systemctl restart continuum-web`
- **Проверка:** `curl -fsS http://localhost:3001/login >/dev/null`.

- **Симптом:** пользователя периодически разлогинивает после истечения access token, в API логе встречается `REFRESH_TOKEN_REUSED`.
- **Команда:** `docker compose logs --no-color --tail=200 api`
- **Причина:** race refresh-запросов и/или legacy refresh-cookie c другим `path` (одинаковое имя cookie, разные path).
- **Фикс:**
  - выровнять `NEXT_PUBLIC_API_BASE_URL` и `AUTH_REFRESH_COOKIE_PATH`;
  - задать cleanup путей: `AUTH_REFRESH_COOKIE_LEGACY_PATHS=/,/auth` (или релевантный набор прошлых path);
  - при необходимости подстроить `AUTH_REFRESH_REUSE_GRACE_SECONDS` (default `20`).
- **Проверка:**
  - истечь access-token и убедиться, что `POST /auth/refresh` возвращает `200/201`;
  - в логах API отсутствуют массовые `REFRESH_TOKEN_REUSED` для активных пользователей.

- **Симптом:** `prisma migrate deploy` в production падает с `P1001: Can't reach database server at postgres:5432`.
- **Команда:** `DATABASE_URL=postgresql://...@postgres:5432/... pnpm --filter @continuum/api exec prisma migrate deploy`
- **Причина:** команда запущена на хосте VPS, где `postgres` (docker service name) не резолвится.
- **Фикс:** запускать миграцию внутри docker network:
  - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`
- **Проверка:** команда миграции завершается успешно и `docker compose -f docker-compose.prod.yml up -d --build api worker` поднимает `api` в `healthy`.

- **Симптом:** после `git pull` API отвечает `500`, в логах Prisma `P2022` и Postgres `column sections.description does not exist`.
- **Команда:** `docker compose -f docker-compose.prod.yml logs --no-color --tail=200 api`
- **Причина:** migration-файлы уже в репозитории, но миграция не применена (часто запуск `migrate deploy` делали без пересборки образа и использовали устаревший image).
- **Фикс:**
  - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`
  - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate status'`
  - при необходимости проверить колонку напрямую:
    - `docker compose -f docker-compose.prod.yml exec -T postgres psql -U continuum -d continuum -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sections' AND column_name='description';"`
- **Проверка:** запрос к `information_schema` возвращает `description`, а в логах API исчезают ошибки `P2022`/`42703`.

- **Симптом:** production `api` уходит в restart-loop с `Cannot find module '.prisma/client/default'`.
- **Команда:** `docker compose -f docker-compose.prod.yml logs --no-color --tail=200 api`
- **Причина:** в `apps/api/Dockerfile` runner stage копировал `node_modules` из `deps`, а `prisma generate` выполняется в `builder`; в рантайм-образ не попадал сгенерированный Prisma client.
- **Фикс:** в runner stage копировать `node_modules` из `builder` (см. `apps/api/Dockerfile`), затем пересобрать `api`:
  - `docker compose -f docker-compose.prod.yml build --no-cache api`
  - `docker compose -f docker-compose.prod.yml up -d --force-recreate api`
- **Проверка:** `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/health` возвращает `200`, а в логах `api` нет `MODULE_NOT_FOUND`.

- **Симптом:** `docker compose ... run api ... prisma migrate deploy` падает с `Could not find Prisma Schema`.
- **Команда:** `docker compose -f docker-compose.prod.yml run --rm api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`
- **Причина:** в runner image не скопированы `apps/api/prisma` и `apps/api/prisma.config.ts`.
- **Фикс:** копировать `prisma` каталог и `prisma.config.ts` в runner stage `apps/api/Dockerfile`, затем пересобрать `api`.
- **Проверка:** migrate deploy выполняется без ошибки schema location.

- **Симптом:** `api` в production уходит в restart-loop с `Error: JWT_SECRET must be set in production.`
- **Команда:** `docker compose -f docker-compose.prod.yml logs --no-color --tail=120 api`
- **Причина:** в `deploy/env/api.env` не задан `JWT_SECRET` (или пустой).
- **Фикс:** задать сильный `JWT_SECRET`, затем `docker compose -f docker-compose.prod.yml up -d --build api`.
- **Проверка:** `docker compose -f docker-compose.prod.yml ps` показывает `api` как `healthy`.

- **Симптом:** `sudo -n systemctl restart continuum-web` → `Unit continuum-web.service not found`.
- **Команда:** `sudo -n systemctl restart continuum-web`
- **Причина:** unit-файл ещё не установлен в `/etc/systemd/system/continuum-web.service`.
- **Фикс:** под `root` выполнить `cp deploy/systemd/continuum-web.service /etc/systemd/system/continuum-web.service && systemctl daemon-reload && systemctl enable continuum-web`.
- **Проверка:** `systemctl is-active continuum-web` возвращает `active`.

- **Симптом:** `nginx -t` падает с `cannot load certificate ... fullchain.pem`.
- **Команда:** `nginx -t`
- **Причина:** SSL-блок включён до выпуска сертификата Let's Encrypt.
- **Фикс:** сначала применить HTTP-only nginx конфиг и запустить `certbot --nginx -d <domain> --redirect`; только потом использовать SSL-пути.
- **Проверка:** `curl -I https://<domain>/login` и `curl -I https://<domain>/api/health` дают `200`.

- **Симптом:** нельзя войти в production (нет teacher/student), хотя API живой.
- **Команда:** попытка логина на `/login` с `teacher1`/`student1`.
- **Причина:** seed пользователей не выполнялся после миграций.
- **Фикс:** создать пользователей через контейнер API:
  - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'node apps/api/scripts/seed-users.mjs --teacher-login=teacher1 --teacher-password=Pass123! --student-login=student1 --student-password=Pass123!'`
- **Проверка:** логин teacher/student проходит, `/auth/me` возвращает пользователя.

## Planned

- CI-проверки документации (валидность ссылок, отсутствие сирот, наличие `Implemented/Planned` в ключевых SoR-доках).
- Реальные unit/integration/e2e tests вместо placeholder `test` скриптов.
