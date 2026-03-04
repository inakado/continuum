# SECURITY

Статус: `Draft` (источник истины — код).

## Scope

- AuthN/AuthZ (cookies + refresh rotation)
- CORS/origin constraints для auth-операций
- RBAC на API endpoints
- Internal auth между worker ↔ api
- Object storage (presigned URLs)

## Source of Truth порядок

1. Код и тесты
2. Prisma schema / runtime-контракты / API handlers
3. `documents/generated/*`
4. Markdown-доки

## Current Invariants (`Implemented`, verified in code)

### Auth: cookies + refresh rotation

- Access token хранится в httpOnly cookie (по умолчанию `AUTH_COOKIE_NAME=access_token`).
- Refresh token хранится в httpOnly cookie (по умолчанию `AUTH_REFRESH_COOKIE_NAME=refresh_token`) и ротируется на каждый refresh.
- Refresh reuse detection: повторное использование refresh token обычно ведёт к revoke всей session family; для конкурентного benign-replay есть grace-ветка (`REFRESH_TOKEN_STALE`) без немедленной ревокации.
- Server-side sessions: refresh tokens привязаны к `auth_sessions`/`auth_refresh_tokens` в БД; доступ валидируется по `sid` в JWT payload.
- При выдаче/очистке auth-cookie backend дополнительно чистит legacy refresh-cookie paths.
- Refresh-ошибки пишутся в structured warn logs (`code`, `ip`, `origin`, `user-agent`) на уровне API.

Operational pitfall (`Implemented`):
- **Симптом:** через время жизни access token UI уходит в `401`, а refresh не восстанавливает сессию.
- **Причина:** несовпадение `AUTH_REFRESH_COOKIE_PATH` и API-префикса и/или legacy cookie-path дубли с тем же именем.
- **Фикс:** выставить совместимый path (`AUTH_REFRESH_COOKIE_PATH=/api/auth`) или использовать дефолтный `path=/`; дополнительно задать `AUTH_REFRESH_COOKIE_LEGACY_PATHS` для очистки старых path.
- **Проверка:** после истечения access-cookie `POST /api/auth/refresh` возвращает `200`.

### CORS + origin checks

- CORS включает `credentials: true`; разрешённые origins берутся из `CORS_ORIGIN`/`WEB_ORIGIN`.
- В production запрещён `CORS_ORIGIN="*"` при credentials.
- На `/auth/refresh` и `/auth/logout` дополнительно проверяется origin/referer на allowlist.

### RBAC и доступы

- Защита большинства `teacher/*` endpoints через `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.teacher)`.
- Student endpoints ограничены ролью `student` и используют `req.user.id` как studentId.
- Проверка “lead teacher owns student” для teacher-review сценариев делается на уровне сервисов.

### Worker ↔ API internal auth

- Worker применяет результаты LaTeX compile через internal endpoint с заголовком `x-internal-token`.
- Token сравнивается с `WORKER_INTERNAL_TOKEN`.

### Object storage (presigned URLs)

- Файлы в S3/MinIO доступны через presigned URLs, которые выдаёт backend.
- Asset keys сейчас хранятся прямо в доменных сущностях.
- Для student unit HTML backend не отдаёт raw storage HTML напрямую:
  - читает HTML артефакт сам,
  - подписывает связанные SVG asset URLs,
  - возвращает уже санитизированный HTML fragment.
- Teacher HTML preview идёт через отдельный backend endpoint с teacher RBAC; web не читает HTML asset напрямую из storage.
- Worker должен fail-closed отклонять HTML/SVG с опасной разметкой (`script`, event handlers, executable external refs).

Operational pitfall (`Implemented`):
- **Симптом:** браузер блокирует PDF/изображения из S3 с `No 'Access-Control-Allow-Origin' header`.
- **Причина:** на bucket не настроен CORS под origin frontend.
- **Фикс:** добавить CORS policy на bucket (origin frontend, methods `GET/HEAD/PUT`, headers `*`).
- **Проверка:** `curl -I -H "Origin: https://<frontend-domain>" "<presigned-url>"` возвращает `Access-Control-Allow-Origin`.

## Source Links

- Auth:
  - `apps/api/src/auth/auth.controller.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/auth.config.ts`
  - `apps/api/src/auth/strategies/jwt.strategy.ts`
- CORS:
  - `apps/api/src/main.ts`
- Internal worker token:
  - `apps/api/src/content/internal-latex.controller.ts`
  - `apps/worker/src/latex/latex-apply-client.ts`
- Storage:
  - `apps/api/src/infra/storage/object-storage.service.ts`
  - `apps/api/src/learning/photo-task-read.service.ts`
  - `apps/api/src/learning/photo-task-review-write.service.ts`
  - `apps/api/src/learning/photo-task-policy.service.ts`
  - `apps/api/src/learning/student-units.controller.ts`
  - `apps/api/src/learning/student-task-solutions.controller.ts`
