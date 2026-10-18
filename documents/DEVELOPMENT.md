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

Запускать только с локальной PostgreSQL и поднятым локальным API на `localhost:3000` внутри контейнера. Для банка, конструктора и назначений также нужен MinIO, доступный API по `S3_ENDPOINT`. Наборы классов, банка, работ и назначений используют настоящие Better Auth и HTTP, создают собственных тестовых пользователей и удаляют только свои записи и S3-объекты. Не направлять тесты на production-БД или bucket.

```bash
docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"
```

Конструктор дополнительно проверять на `/teacher/works`: создание, выбор из банка, раскрытие условий, drag/клавиатура/меню, сохранение после повторного входа, предпросмотр и фиксация версии. Integration-тест проверяет ревизии, конкурентные записи, повтор, неизменяемый снимок после изменения банка и права. Desktop/mobile геометрию, фактическое перетаскивание и рисунки проверять отдельно в браузере.

Для назначений необходима миграция `20261017050000_assessment_assignments` и актуальный Prisma client. Через `/teacher/works` назначить непустую работу двум классам, открыть «Назначения» и выполнение. Через `/student/works` войти учеником, начать, изменить разные типы ответов, дождаться «Сохранено», выйти/войти и продолжить, затем завершить. Сверить статусы и результат у учителя. Проверить изменение состава перед POST, явное добавление новых учеников, обрыв сохранения/повтор, конфликт вкладок, запрет изменения завершённого и сохранность истории при переводе/удалении. Integration-тесты покрывают реальные HTTP/БД/S3 и права; component tests не заменяют desktop/mobile просмотр и проверку длинных условий.

### Library smoke

После baseline migration и создания локальных `teacher1` / `student1`:

```bash
pnpm --filter @continuum/api smoke:library
```

Проверяет создание и публикацию раздела/занятия, загрузку двух PDF в S3, выдачу доступа и получение опубликованных файлов учеником. Smoke создаёт тестовый раздел и файлы в локальном окружении; после запуска их нужно удалить.

Управление учениками проверяется через `/teacher/students`: отдельное создание, мастер массового создания с проверкой списка, CSV/печать, перевод, архивирование/удаление класса, сброс пароля и удаление ученика. Деактивация и сброс пароля отзывают student-сессии; зачисление в класс выдаёт доступ параллели. Повторные запросы, общая база преподавателей и изоляция ключей агентов проверяются integration-тестами. Печатную геометрию и мобильный layout проверять отдельно в браузере — component tests их не подтверждают.

## Prisma / Migrations

Создание локальной миграции:

```bash
docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma migrate dev --name <name>"
```

Генерация клиента:

```bash
docker compose exec -T api sh -lc "DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum pnpm --filter @continuum/api exec prisma generate"
```

Production migration выполняется только в составе явно подтверждённого deploy по `deploy/README.md`, без reset текущих данных.

## Operational Invariants

- Backend build/typecheck выполняется в Docker-контуре.
- Docker build использует frozen lockfile; после изменения зависимостей lockfile обновляется отдельно.
- Production storage внешний, dev storage — MinIO.
- Новое занятие публикуется как content artifact и не запускает platform deploy.
- Импорт заданий в банк не требует пересборки платформы. Для ручной проверки использовать `output/assessment-package-pilot-v1.zip`; он содержит закрытые учительские ключи.
- `pnpm --filter web sync:mathjax` копирует MathJax и шрифты локально; эта команда также выполняется перед web build.
- Push и deploy выполняются только по явной команде пользователя.

## Troubleshooting

Повторяемые dev/run/build/test/deploy сбои хранятся в [documents/ops/TROUBLESHOOTING.md](ops/TROUBLESHOOTING.md).
