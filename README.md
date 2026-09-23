# Континуум

«Континуум» — закрытая библиотека занятий по физике: PDF, интерактивные лекции и задачи с доступом по возрастным группам.

Документация:
- `documents/DOCS-INDEX.md` — карта документации и SoR-доков.
- `documents/DEVELOPMENT.md` — dev/build/test/deploy runbook.

Локальный dev-контур:

- `pnpm dev:infra` — PostgreSQL и MinIO.
- `pnpm dev:backend` — API в Docker.
- `pnpm dev:web` — Next.js web на `http://localhost:3001`.
- `pnpm smoke` — базовая проверка health/ready/login.
