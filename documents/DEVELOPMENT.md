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

