# TROUBLESHOOTING

## Troubleshooting

Здесь хранятся повторяемые dev/run/build/test/deploy сбои новой версии. Production-first диагностика находится в [deploy/README.md](../../deploy/README.md).

### Better Auth dependency отсутствует в dev API volume

- **Симптом:** API падает с `Cannot find module '@thallesp/nestjs-better-auth'`.
- **Причина:** named volume `api_node_modules` создан до появления Better Auth.
- **Исправление:** `docker compose up -d --force-recreate api`.
- **Проверка:** API log содержит `Nest application successfully started`, `/health` возвращает `200`.

Startup guard в `docker-compose.yml` обязан проверять `@thallesp/nestjs-better-auth` и `better-auth` до решения пропустить установку зависимостей.

### macOS блокирует нативные Node binaries

- **Симптом:** Vitest или Next.js сообщает `ERR_DLOPEN_FAILED` и `library load disallowed by system policy` для Rollup/SWC.
- **Причина:** нативный бинарник в `node_modules` заблокирован macOS code-signing/quarantine policy после переноса проекта.
- **Диагностика:** проверить конкретный путь из stack trace; не снимать quarantine рекурсивно со всего репозитория.
- **Исправление:** переустановить зависимости локально или разрешить только конкретный подтверждённый бинарник.
- **Проверка:** `pnpm --filter @continuum/shared test` и `pnpm --filter web test` запускаются без startup error.

### Stale Next.js route types после удаления страниц

- **Симптом:** typecheck ссылается на уже удалённые `app/**/page.tsx` внутри `.next/dev/types`.
- **Причина:** dev type cache был создан до удаления routes.
- **Исправление:** удалить только генерируемый `.next/dev/types`, затем выполнить `pnpm --filter web exec next typegen`.
- **Проверка:** `pnpm --filter web typecheck` проходит.

### Docker/OrbStack daemon недоступен

- **Симптом:** `failed to connect to the docker API ... orbstack ... no such file or directory`.
- **Причина:** локальный Docker-compatible daemon не запущен.
- **Исправление:** запустить OrbStack/Docker Desktop и повторить команду.
- **Проверка:** `docker compose config --quiet` и `docker compose -f docker-compose.prod.yml build api` проходят.

### MinIO не стартует из-за занятого порта 9000

- **Симптом:** `Bind for 127.0.0.1:9000 failed: port is already allocated`.
- **Причина:** другой локальный проект уже публикует MinIO на `9000–9001`; внутренний Docker-порт не конфликтует.
- **Исправление:** запустить Continuum с `MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 S3_PUBLIC_BASE_URL=http://localhost:9100 docker compose up -d minio`.
- **Проверка:** `docker compose ps` показывает `continuum-minio` на `9100–9101`; API использует внутренний `http://minio:9000`.

### Prisma migrate deploy сообщает P3015 после удаления legacy migrations

- **Симптом:** Prisma находит десятки миграций и сообщает `Could not find the migration file at migration.sql`.
- **Причина:** после удаления файлов на диске остались пустые каталоги legacy migrations, которые попали в Docker build context.
- **Исправление:** удалить только пустые каталоги внутри `apps/api/prisma/migrations`, затем пересобрать API image.
- **Проверка:** `prisma migrate deploy` на чистой БД находит и применяет только `20260923000000_library_baseline`.

### Production runner пытается скачать pnpm при migration command

- **Симптом:** вместо запуска Prisma появляется `Corepack is about to download pnpm`.
- **Причина:** pnpm использовался в builder layer, но не был подготовлен в общем base layer для production runner.
- **Исправление:** base image выполняет `corepack prepare pnpm@10.11.1 --activate`.
- **Проверка:** `pnpm --filter @continuum/api exec prisma migrate deploy` работает внутри runner image без runtime download.
