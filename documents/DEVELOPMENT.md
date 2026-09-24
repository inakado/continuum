# DEVELOPMENT

Назначение: короткий runbook для dev/build/test. Production operations находятся в [deploy/README.md](../deploy/README.md).

## Prerequisites / Env

- Node.js `24.x`.
- pnpm `10.11.1` через Corepack.
- `API_PORT` — default `3000`.
- `NEXT_PUBLIC_API_BASE_URL` — default `http://localhost:3000`.
- Backend использует `DATABASE_URL` или `POSTGRES_*`.
- Storage использует `S3_*`; локально это MinIO.
- В агентской sandbox-сессии `CI=true pnpm install --frozen-lockfile` не запускается.

## Dev Runbook

1. `pnpm dev:infra` — PostgreSQL и MinIO.
2. `pnpm dev:backend` — NestJS API в Docker.
3. `pnpm dev:web` — Next.js на `http://localhost:3001`.
4. `pnpm smoke` — `/health`, `/ready` и `/login`.

Worker, Redis и TeX Live не входят в целевой runtime.

## Verification Commands

- Документация: `pnpm docs:check`
- Shared contracts: `pnpm --filter @continuum/shared typecheck && pnpm --filter @continuum/shared test`
- Frontend boundaries: `pnpm lint:boundaries`
- Frontend: `pnpm --filter web typecheck && pnpm --filter web test`
- Backend image: `pnpm build:backend`
- Web + shared: `pnpm build:web`
- Full build: `pnpm build`
- Full test: `pnpm test`

### Auth smoke

```bash
docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"
```

### API integration tests

```bash
docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"
```

### Library smoke

После baseline migration и создания локальных `teacher1` / `student1`:

```bash
pnpm --filter @continuum/api smoke:library
```

Проверяет создание и публикацию раздела/занятия, загрузку двух PDF в S3, выдачу доступа и получение опубликованных файлов учеником. Smoke создаёт тестовый раздел и файлы в локальном окружении; после запуска их нужно удалить.

Управление учениками проверяется через `/teacher/students`: создание выполняется из teacher-сессии, деактивация отзывает student-сессии, доступы к классам сохраняются через `/teacher/library/access-grants`.

## Prisma / Migrations

Создание локальной миграции:

```bash
docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"
```

Генерация клиента:

```bash
docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"
```

Production migration выполняется только как часть подтверждённого cutover.

## Operational Invariants

- Backend build/typecheck выполняется в Docker-контуре.
- Docker build использует frozen lockfile; после изменения зависимостей lockfile обновляется отдельно.
- Production storage внешний, dev storage — MinIO.
- Новое занятие публикуется как content artifact и не запускает platform deploy.
- Push и deploy выполняются только по явной команде пользователя.

## Troubleshooting

Повторяемые dev/run/build/test/deploy сбои хранятся в [documents/ops/TROUBLESHOOTING.md](ops/TROUBLESHOOTING.md).
