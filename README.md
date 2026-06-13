# Континуум

«Континуум» — закрытая платформа обучения с раздельными рабочими интерфейсами для учителя и ученика.

Документация:
- `documents/DOCS-INDEX.md` — карта документации и SoR-доков.
- `documents/DEVELOPMENT.md` — dev/build/test/deploy runbook.

Локальный dev-контур:

- `pnpm dev:infra` — Postgres, Redis, MinIO.
- `pnpm dev:backend` — API и worker в Docker.
- `pnpm dev:web` — Next.js web на `http://localhost:3001`.
- `pnpm smoke` — базовая проверка health/ready/queue/web.
