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
- Сборка web больше не зависит от `next/font/google` / `fonts.googleapis.com`.

## Prisma / миграции
1) Схема менялась → создаём миграцию в контейнере:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"`
2) Если в рантайме появились ошибки вида `Property 'course' does not exist on type 'PrismaService'` — заново сгенерировать клиент:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"`
3) Prisma v7 читает env из `apps/api/prisma.config.ts`. Для локального запуска обязательно доступны `DATABASE_URL` или `POSTGRES_*`.
4) Production manual migration (до deploy):
   - `DATABASE_URL=... pnpm --filter @continuum/api exec prisma migrate deploy`

## Production deploy артефакты
- `docker-compose.prod.yml` — production compose без bind-монтажей исходников.
- `deploy/env/*.env` — service-specific env files (`api`, `worker`, `postgres`, `redis`, `minio`).
- `deploy/systemd/continuum-web.service` — systemd unit для Next.js frontend.
- `deploy/nginx/continuum.conf` — reverse proxy `/` и `/api/` + TLS контур.
- `deploy/README.md` — пошаговый runbook (GitHub, VPS, migrations, rollback).

## Lockfile / зависимости (Docker)
1) Docker сборки используют `--frozen-lockfile`, поэтому lockfile должен быть актуальным.
2) После изменения `package.json` запускать в корне:
   - `pnpm -r install`
   - в репозитории включён `recursive-install=true` (`.npmrc`), чтобы install ставил все workspace-пакеты, а не только root.
3) Если build падает на Corepack/pnpm download:
   - проверить доступ в сеть (registry.npmjs.org),
   - повторить сборку после успешной установки зависимостей.

## Troubleshooting (накопление граблей)

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

- **Симптом:** `pnpm install` падает с `ENOTFOUND registry.npmjs.org`.
- **Команда:** `CI=true pnpm install`
- **Причина:** отсутствует DNS/egress доступ к npm registry в текущем окружении.
- **Фикс:** повторить установку в окружении с внешней сетью (CI runner или VPS).
- **Проверка:** `pnpm install --frozen-lockfile` завершается без retry/fetch ошибок.

- **Симптом:** install падает на `apps/api postinstall: prisma generate` с ошибкой про `DATABASE_URL or POSTGRES_*`.
- **Команда:** `pnpm install --filter @continuum/api...`
- **Причина:** `apps/api/prisma.config.ts` требует `DATABASE_URL` (или `POSTGRES_*`) даже для `prisma generate`.
- **Фикс:** экспортировать `DATABASE_URL` перед install (`DATABASE_URL=postgresql://... pnpm install ...`) или предварительно загрузить `deploy/env/api.env`.
- **Проверка:** `pnpm install --frozen-lockfile` проходит без postinstall ошибки `prisma generate`.

- **Симптом:** `pnpm build`/`pnpm typecheck` падают с `tsc: command not found` (обычно в `@continuum/worker`) или `next: command not found` (в `web`).
- **Команда:** `pnpm build` или `pnpm --filter web run build`
- **Причина:** частичная установка зависимостей через `pnpm install --filter ...` пересоздаёт общий `node_modules`, и часть пакетов остаётся без локальных бинарей (`apps/*/node_modules/.bin`).
- **Фикс:**
  - очистить локальные зависимости: `rm -rf node_modules apps/web/node_modules apps/worker/node_modules packages/shared/node_modules`
  - выполнить полную установку в сети с доступом к npm: `CI=true DATABASE_URL=postgresql://... pnpm -r install --force`
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

## Planned

- CI-проверки документации (валидность ссылок, отсутствие сирот, наличие `Implemented/Planned` в ключевых SoR-доках).
- Реальные unit/integration/e2e tests вместо placeholder `test` скриптов.
