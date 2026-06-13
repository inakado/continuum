# DEVELOPMENT.md

Назначение: короткий operational runbook для dev/build/test и базовых deploy-команд.
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
- `dev:web` запускает Next.js dev server в webpack-режиме; Turbopack (`next dev` по умолчанию в Next 16) на текущем проекте может зависать после `Starting...`.
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
- Local worker runtime base image (one-time or after explicit cleanup):
  - `export TEXLIVE_BASE_IMAGE=continuum-texlive-base:texlive-2022-node20-bookworm`
  - `docker build -f apps/worker/Dockerfile.texlive-base -t "$TEXLIVE_BASE_IMAGE" .`
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
   - `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && pnpm --filter @continuum/api exec prisma migrate deploy'`

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

### Worker Dockerfile model

- `apps/worker/Dockerfile.texlive-base` — отдельный runtime Dockerfile для тяжёлой TeX Live базы.
- `apps/worker/Dockerfile` — application Dockerfile для `worker`, который использует `ARG TEXLIVE_BASE_IMAGE` и не должен сам устанавливать `texlive-full`.
- Обычный production/deploy цикл работает через:
  - редкий rebuild `Dockerfile.texlive-base` при изменении runtime-зависимостей;
  - частый rebuild `apps/worker/Dockerfile` при изменении worker/shared application-кода.
- Если в логе `docker compose -f docker-compose.prod.yml build worker` снова появляется шаг `install-texlive-runtime.sh`, это признак, что используется старая схема или отсутствует нужный `TEXLIVE_BASE_IMAGE`.
- Тот же invariant действует и локально: если `docker compose build worker` не находит `continuum-texlive-base:texlive-2022-node20-bookworm`, сначала нужно вручную собрать `apps/worker/Dockerfile.texlive-base`.

### Lockfile discipline

- Docker builds используют `--frozen-lockfile`.
- После изменения `package.json` lockfile должен быть актуальным.
- В репозитории включён `recursive-install=true`, чтобы `pnpm install` ставил все workspace-пакеты.

## Troubleshooting

Длинные повторяемые run/build/test/deploy сбои вынесены в [documents/ops/TROUBLESHOOTING.md](ops/TROUBLESHOOTING.md).

В этом файле остаются только базовые команды, проверочный runbook и operational invariants.
