# DEVELOPMENT.md

Назначение: operational runbook для dev/build/test/deploy и повторяемый troubleshooting.
Краткие правила выбора документов см. `AGENTS.md` и `documents/PLANS.md`.

## Prerequisites / Env

- `API_PORT` — default `3000`
- `NEXT_PUBLIC_API_BASE_URL` — default `http://localhost:3000`
- Для backend/Prisma-команд должны быть доступны `DATABASE_URL` или `POSTGRES_*`
- В агентской sandbox-сессии команда `CI=true pnpm install --frozen-lockfile` не запускается; её должен выполнять пользователь локально

## Dev Runbook

### Базовый локальный контур

1. Поднять infra:
   - `pnpm dev:infra`
2. Поднять backend:
   - `pnpm dev:backend`
3. Запустить web локально:
   - `pnpm dev:web`

Примечание:
- `dev:web` и `smoke` рассчитаны на bash-совместимую оболочку.
- На Windows использовать WSL или задавать env-переменные вручную.

### Подготовка окружения

1. Установить workspace dependencies:
   - `pnpm -r install --force`
2. Проверить, что web binary доступны:
   - `ls -l apps/web/node_modules/.bin/next apps/web/node_modules/.bin/tsc`

## Verification Commands

### Build

- Backend images:
  - `pnpm build:backend`
- Dev backend images:
  - `pnpm build:backend:dev`
- Web + shared:
  - `pnpm build:web`
- Full workspace build:
  - `pnpm build`

### Typecheck / Lint / Tests

- Typecheck:
  - `pnpm typecheck`
- Lint:
  - `pnpm lint`
- Dependency boundaries:
  - `pnpm lint:boundaries`
- Tests:
  - `pnpm test`
- Documentation checks:
  - `pnpm docs:check`

### Smoke

Перед запуском smoke должны быть подняты infra и backend, а web должен быть доступен локально.

- `pnpm smoke`

### API auth smoke (Docker only)

- Полный auth smoke для cookie-first login/refresh/role routing:
  - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`

Smoke проверяет:
1. `GET /health`
2. `GET /ready`
3. `POST /debug/enqueue-ping`
4. `GET /login`

Auth smoke проверяет:
1. `POST /auth/login`
2. `GET /auth/me`
3. `GET /teacher/me`
4. refresh rotation + stale replay handling
5. teacher-only / student-only guards
6. `GET /courses = 403` для teacher-session

### API integration tests (Docker only)

- Полный integration-прогон:
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"`
- Точечный прогон одного suite:
  - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec vitest run --config vitest.integration.config.ts test/integration/<suite>.integration.test.ts"`

## Prisma / Migrations

1. Создать миграцию в контейнере:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"`
2. Явно пересгенерировать Prisma client:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"`
3. Production manual migration:
   - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`

## Operational Invariants

### Backend build/typecheck only in Docker

- `apps/api` и `apps/worker` не должны собираться на хосте напрямую.
- Скрипты `build` и `typecheck` для backend содержат guard `scripts/ensure-docker-build.cjs`.
- Если backend build/typecheck запускается вне Docker, это считается неверным operational path.

### Production deploy source of truth

- Подробный production deploy runbook хранится в [deploy/README.md](../deploy/README.md).
- `DEVELOPMENT.md` хранит только минимальные operational инварианты и команды.
- Dev storage использует MinIO; production storage использует внешний S3-провайдер.
- Для production deploy применяется cache-first policy: по умолчанию пересобирается только изменившийся сервис (обычно `api`), а `worker` пересобирается только при изменениях в worker/runtime контуре.
- Для production deploy действует disk hygiene policy (проверки `df -h`/`df -i`/`docker system df`, регулярный cleanup image/container без удаления volumes); детали в `deploy/README.md`.

### Lockfile discipline

- Docker builds используют `--frozen-lockfile`.
- После изменения `package.json` lockfile должен быть актуальным.
- В репозитории включён `recursive-install=true`, чтобы `pnpm install` ставил все workspace-пакеты.

## Troubleshooting

Границы раздела:
- здесь фиксируются только повторяемые run/build/test/deploy проблемы;
- доменные ошибки и продуктовые инварианты сюда не переносятся.

- **Симптом:** `pnpm smoke` возвращает `TypeError: fetch failed`.
- **Команда:** `pnpm smoke`
- **Причина:** sandbox не даёт доступ к локальным портам в текущей среде.
- **Фикс:** повторить проверки вне sandbox через `curl`.
- **Проверка:** `curl -fsS http://localhost:3000/health` и `curl -fsS http://localhost:3000/ready`

- **Симптом:** backend Docker build не стартует с `permission denied ... docker.sock`.
- **Команда:** `pnpm build:backend`
- **Причина:** у текущего процесса нет доступа к Docker daemon socket.
- **Фикс:** запускать build вне sandbox или в обычном пользовательском терминале.
- **Проверка:** `docker compose -f docker-compose.prod.yml build api worker`

- **Симптом:** `pnpm --filter @continuum/api test` падает с `listen EPERM: operation not permitted 0.0.0.0`.
- **Команда:** `pnpm --filter @continuum/api test`
- **Причина:** sandbox запрещает bind/listen локального HTTP server.
- **Фикс:** socket-based integration гонять вне sandbox; локально использовать controller/service-level tests без bind/listen.
- **Проверка:** повторный запуск вне sandbox или через Docker integration contour

- **Симптом:** `pnpm --filter @continuum/api test:integration` в контейнере падает с `Cannot find package 'supertest'`.
- **Команда:** `docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"`
- **Причина:** контейнерный `node_modules` не синхронизирован с обновлённым lockfile.
- **Фикс:** переустановить зависимости внутри контейнера:
  - `docker compose exec -T api sh -lc "pnpm install --filter @continuum/api... --frozen-lockfile"`
- **Проверка:** повторный integration-прогон проходит

- **Симптом:** integration-тесты Nest отвечают `500` с `Cannot read properties of undefined (reading '<serviceMethod>')`.
- **Команда:** `pnpm --filter @continuum/api test:integration`
- **Причина:** DI metadata конструктора не резолвится автоматически в vitest/esbuild.
- **Фикс:** использовать `apps/api/test/integration/test-app.factory.ts` и явно задавать `constructorParams`.
- **Проверка:** suite проходит без `undefined` зависимостей

- **Симптом:** точечный запуск `apps/api/test/integration/*.integration.test.ts` на хосте падает с `Cannot find module '.prisma/client/default'`.
- **Команда:** `pnpm exec vitest run --config vitest.integration.config.ts test/integration/<suite>.integration.test.ts`
- **Причина:** integration-контур `apps/api` рассчитан на Docker runtime с корректно сгенерированным Prisma client.
- **Фикс:** запускать suite внутри контейнера `api`:
  - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec vitest run --config vitest.integration.config.ts test/integration/<suite>.integration.test.ts"`
- **Проверка:** нужный suite проходит внутри контейнера

- **Симптом:** `git pull --ff-only` конфликтует с `deploy/env/*.env`.
- **Команда:** `git pull --ff-only`
- **Причина:** на сервере остались локальные tracked-правки, а в репозитории файлы уже заменены на `*.env.example`.
- **Фикс:**
  - `mkdir -p .env-backup && cp deploy/env/*.env .env-backup/`
  - `git stash push -m "server-env-before-untrack" -- deploy/env/api.env deploy/env/postgres.env deploy/env/worker.env deploy/env/redis.env`
  - `git pull --ff-only`
  - `for f in api worker postgres redis; do [ -f "deploy/env/$f.env" ] || cp "deploy/env/$f.env.example" "deploy/env/$f.env"; done && cp .env-backup/*.env deploy/env/ && rm -rf .env-backup`
- **Проверка:** `git status --short` пустой, а последующие `git pull --ff-only` проходят

- **Симптом:** `pnpm install` падает с `ENOTFOUND registry.npmjs.org`.
- **Команда:** `pnpm install --frozen-lockfile`
- **Причина:** нет DNS/egress доступа к npm registry.
- **Фикс:** повторить install в окружении с внешней сетью.
- **Проверка:** install завершается без fetch/dns ошибок

- **Симптом:** `pnpm add -Dw ...` падает с `ERR_PNPM_META_FETCH_FAIL` или `ERR_PNPM_UNEXPECTED_STORE`.
- **Команда:** `pnpm add -Dw <deps>`
- **Причина:** sandbox не видит registry и store-dir не совпадает с уже собранным `node_modules`.
- **Фикс:** запускать установку вне sandbox и при необходимости выровнять `PNPM_STORE_DIR`.
- **Проверка:** команда завершается успешно, затем `pnpm lint` и `pnpm lint:boundaries` проходят

- **Симптом:** `pnpm typecheck` или тесты не резолвят `@continuum/shared/contracts/...`.
- **Команда:** `pnpm typecheck`, `pnpm --filter @continuum/api test`, `pnpm --filter web test`
- **Причина:** subpath требует корректный source-alias или собранный `dist`.
- **Фикс:** проверить alias/path mapping в toolchain и при необходимости пересобрать shared.
- **Проверка:** `pnpm typecheck`, `pnpm --filter @continuum/api test`, `pnpm --filter web test`

- **Симптом:** Docker `api` отвечает `500` с ошибкой вида `Cannot read properties of undefined (reading 'parse')` сразу после изменения shared-контрактов.
- **Команда:** `GET /units/:id/rendered-content`, другие endpoints с runtime schema parsing
- **Причина:** контейнер использует устаревший `/app/packages/shared/dist`, если dev startup пересобирал shared только при отсутствии файлов.
- **Фикс:** пересобрать shared внутри контейнеров и перезапустить backend:
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api exec tsc -p /app/packages/shared/tsconfig.json"`
  - `docker compose exec -T worker sh -lc "pnpm --filter @continuum/worker exec tsc -p /app/packages/shared/tsconfig.json"`
  - `docker compose restart api worker`
- **Проверка:** endpoint снова отвечает `200`, а dev startup всегда пересобирает `packages/shared`

- **Симптом:** compile падает сообщением про incompatible `pdflatex` source (`fontspec`, `unicode-math`, `\includesvg`, bibliography/index команды).
- **Команда:** teacher compile / `GET /teacher/latex/jobs/:jobId`
- **Причина:** новый backend runtime работает на strict `pdflatex` policy и не поддерживает XeTeX/LuaTeX-only preamble и внешний toolchain.
- **Фикс:**
  - привести teacher source к `pdflatex`-совместимой preamble;
  - убрать `fontspec`, `unicode-math`, `polyglossia`, `minted`, `svg`, `\includesvg`, `\tikzexternalize`, bibliography/index команды;
  - не использовать shell-escape.
- **Проверка:** compile job завершается `succeeded`, а PDF/HTML assets публикуются как обычно

- **Симптом:** в student HTML panel при клике `Скачать PDF` открывается XML-ошибка storage с `AccessDenied` и `Request has expired`.
- **Команда:** открыть unit `theory/method` и кликнуть `Скачать PDF` после длительного idle страницы.
- **Причина:** использовался устаревший presigned URL.
- **Фикс:** использовать актуальный web path, где `StudentUnitHtmlPanel` перед скачиванием запрашивает свежий rendered-content URL; если запущен старый web bundle — перезапустить `pnpm dev:web` и сделать hard reload.
- **Проверка:** повторный клик `Скачать PDF` открывает PDF без XML-ошибки.

- **Симптом:** агент пытается запустить `CI=true pnpm install --frozen-lockfile` в sandbox и получает сетевые ошибки.
- **Команда:** `CI=true pnpm install --frozen-lockfile`
- **Причина:** для агентской sandbox-сессии эта команда запрещена policy и нестабильна по сети.
- **Фикс:** запуск должен делать пользователь локально.
- **Проверка:** агент вместо выполнения запрашивает локальный запуск у пользователя

- **Симптом:** install пишет `Ignored build scripts: ...`.
- **Команда:** `pnpm install --frozen-lockfile`
- **Причина:** pnpm v10 блокирует lifecycle build scripts без allowlist.
- **Симптом:** в dev startup `worker` логирует ошибку вида `msgpackr-extract install ... gcc: not found` или stack trace из `node-gyp`, но после этого всё равно пишет `Done in ...` и продолжает запускаться.
- **Команда:** `docker compose logs --no-color --tail=120 worker`
- **Причина:** `msgpackr-extract` пытается собрать optional native addon; в dev image нет build toolchain (`gcc`), поэтому native rebuild падает и пакет остаётся на JS fallback.
- **Фикс:** если `worker` после этого доходит до `[worker] latex ready`, ничего делать не нужно; это не блокирует runtime. Build toolchain добавлять только если появится реальная потребность в native performance path.
- **Проверка:** после лога install есть:
  - `Done in ... using pnpm`
  - `> @continuum/worker@0.0.0 dev`
  - `[worker] latex ready concurrency=...`
- **Фикс:** использовать зафиксированный `pnpm.onlyBuiltDependencies` в root `package.json`.
- **Проверка:** install не требует ручного `pnpm approve-builds`

- **Симптом:** `pnpm build` или `pnpm typecheck` падают с `tsc: command not found` или `next: command not found`.
- **Команда:** `pnpm build`, `pnpm typecheck`, `pnpm --filter web run build`
- **Причина:** частичная установка зависимостей оставила пакеты без локальных binaries.
- **Фикс:**
  - `rm -rf node_modules apps/web/node_modules apps/worker/node_modules packages/shared/node_modules`
  - `pnpm -r install --force`
- **Проверка:** существуют `apps/web/node_modules/.bin/next` и `apps/web/node_modules/.bin/tsc`, затем build/typecheck проходят

- **Симптом:** backend build/typecheck запускается на хосте и сразу падает.
- **Команда:** `pnpm --filter @continuum/api run build` или `pnpm --filter @continuum/worker run build`
- **Причина:** backend guard разрешает build/typecheck только в Docker.
- **Фикс:** использовать `pnpm build:backend` или `pnpm build:backend:dev`.
- **Проверка:** Docker build завершается успешно

- **Симптом:** backend health-check успешен, но `/login` недоступен.
- **Команда:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/login`
- **Причина:** frontend не запущен.
- **Фикс (dev):** `pnpm dev:web`
- **Фикс (prod):** пересобрать web и перезапустить frontend service по runbook из `deploy/README.md`

- **Симптом:** `api` контейнер формально `Up`, но логин не работает, `GET /health` снаружи не отвечает, а в `docker compose logs api` есть `UnknownDependenciesException`.
- **Команда:** `docker compose logs --no-color --tail=120 api`
- **Причина:** mass-fix `@typescript-eslint/consistent-type-imports` перевёл Nest DI зависимости (`PrismaService`, `AuthService`, `LearningService`, `Reflector` и другие runtime-классы) в type-only imports, поэтому приложение не проходит bootstrap.
- **Фикс:**
  - вернуть обычные imports для всех runtime-классов, которые участвуют в constructor DI;
  - отдельно проверить guards/strategies/controllers и сервисы с `PrismaService`;
  - после правки дождаться успешного `Nest application successfully started` в логах.
- **Проверка:**
  - `docker compose exec -T api sh -lc "wget -qO- http://localhost:3000/health || curl -s -i http://localhost:3000/health"`
  - `docker compose exec -T api sh -lc "curl -s -i -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{\"login\":\"teacher1\",\"password\":\"Pass123!\"}'"`

- **Симптом:** teacher login проходит, но `GET /courses` возвращает `403`, и это ошибочно воспринимается как поломка auth.
- **Команда:** `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`
- **Причина:** `/courses` — student-only endpoint; для teacher корректные read-paths начинаются с `/teacher/*`, а базовая cookie-сессия проверяется через `/auth/me` и `/teacher/me`.
- **Фикс:** не использовать `GET /courses` как teacher smoke; проверять `GET /auth/me`, `GET /teacher/me`, `GET /debug/teacher-only` и ожидать `GET /courses = 403`.
- **Проверка:** `pnpm smoke:auth` внутри контейнера `api` проходит целиком

- **Симптом:** PDF compile из UI запускается, но результат долго не появляется, либо в `worker` логах есть `Cannot find module '@continuum/latex-runtime'`.
- **Команда:** `docker compose logs --no-color --tail=120 worker`
- **Причина:** `worker` использует stale `node_modules` volume и после изменений в workspace-пакетах (`packages/shared`, `packages/latex-runtime`) не видит новые runtime dependencies, поэтому latex worker не стартует или не обрабатывает очередь. Если `pnpm install` должен перелинковать volume с нуля, без `--force` он может зависнуть на интерактивном вопросе `The modules directories will be removed and reinstalled from scratch`.
- **Фикс:**
  - пересоздать dev-контур:
    - `docker compose up -d --build --force-recreate api worker`
  - если нужно убедиться вручную:
    - `docker compose exec -T worker sh -lc "cd /app/packages/shared && node -e \"require('zod'); console.log('ok')\""`
    - `docker compose exec -T worker sh -lc "cd /app/apps/worker && node -e \"require('@continuum/latex-runtime'); console.log('ok')\""`
- **Проверка:**
  - в логах есть:
    - `[worker] latex ready concurrency=1`
    - `[worker][latex] success jobId=...`

- **Симптом:** backend Docker rebuild после LaTeX-изменений слишком долго скачивает `TeX Live` и зависимости заново.
- **Команда:** `docker compose build api worker`
- **Причина:** первый build после смены Dockerfile/install-layer заполняет BuildKit cache для `apt` и `pnpm`; при ручной очистке builder cache он заполняется снова.
- **Фикс:**
  - не очищать без необходимости Docker builder cache;
  - не делать `docker builder prune` / `docker system prune -a` (policy запрет для production deploy цикла);
  - для dev-перезапуска использовать `docker compose up -d --build api worker`, чтобы переиспользовать слои и named volumes.
- **Проверка:** повторный `docker compose build api worker` использует cached steps для `install-texlive-runtime.sh` и `pnpm install`, если не менялись Dockerfile и lockfile.

- **Симптом:** production `api`/`worker` уходит в restart-loop с `Error: Cannot find module 'zod'` (stack из `/app/packages/shared/dist/...`).
- **Команда:** `docker compose -f docker-compose.prod.yml logs --no-color --tail=200 api` или `... worker`
- **Причина:** runtime image собран до фикса, где `packages/shared/node_modules` не попадал в runner stage.
- **Фикс:**
  - убедиться, что на сервере подтянут commit с Dockerfile-фиксом (`fix(docker): include shared runtime deps in api/worker images`);
  - пересобрать только затронутый сервис (`docker compose -f docker-compose.prod.yml build api` или `build worker`);
  - перезапустить сервис через `docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate <service>`.
- **Проверка:** в логах нет `Cannot find module 'zod'`, сервис в статусе `healthy`/`up`.

- **Симптом:** `docker compose ... build worker` падает с `no space left on device` во время `exporting/unpacking` слоёв (`texlive-full`).
- **Команда:** `docker compose -f docker-compose.prod.yml build worker`
- **Причина:** недостаточно свободного места/инодов для тяжёлого worker image.
- **Фикс:**
  - проверить ресурсы: `df -h`, `df -i`, `docker system df -v`;
  - очистить неиспользуемые образы/контейнеры: `docker image prune -a -f` и `docker container prune -f`;
  - не удалять build cache; при недостатке места чистить host-level логи/кеши и при необходимости расширять диск.
- **Проверка:** после cleanup `docker compose -f docker-compose.prod.yml build worker` завершается успешно.
