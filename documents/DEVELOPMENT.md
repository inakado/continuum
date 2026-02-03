# DEVELOPMENT.md

Краткий контрольный контур для dev‑запуска.

## Переменные
- `API_PORT` (default: 3000)
- `NEXT_PUBLIC_API_BASE_URL` (default: http://localhost:3000)

## Запуск
1) Infra (Docker):
   - `pnpm dev:infra`
2) Backend (API + Worker):
   - `pnpm dev:backend`
3) Web (локально):
   - `pnpm dev:web`

Примечание: команды `dev:web` и `smoke` рассчитаны на bash (macOS/Linux). На Windows используйте WSL или задайте переменные окружения вручную.

## Smoke-check
Убедитесь, что infra и backend подняты, web запущен локально:
- `pnpm smoke`

Проверяет:
1) API `/health` и `/ready`
2) `POST /debug/enqueue-ping`
3) Web `/debug`

## Prisma / миграции
1) Схема менялась → создаём миграцию в контейнере:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"`
2) Если в рантайме появились ошибки вида `Property 'course' does not exist on type 'PrismaService'` — заново сгенерировать клиент:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"`
3) Prisma v7 читает env из `apps/api/prisma.config.ts`. Для локального запуска обязательно доступны `DATABASE_URL` или `POSTGRES_*`.
4) Быстрый рецепт после изменения схемы:
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"`
   - `docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"`
   - `docker compose restart api`

## Lockfile / зависимости (Docker)
1) `apps/api` в Docker ставит зависимости с `--frozen-lockfile`, поэтому lockfile должен быть актуальным.
2) После изменения `package.json` всегда запускать в корне:
   - `pnpm -w install`
3) Если Docker build падает на Corepack/pnpm download:
   - проверить доступ в сеть (registry.npmjs.org),
   - повторить `docker compose up -d --build api` после успешного `pnpm -w install`.
4) Если зависимости уже установлены и нужно лишь подхватить изменения кода, можно быстрее:
   - `docker compose restart api`
