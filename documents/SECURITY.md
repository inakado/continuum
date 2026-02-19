# SECURITY

Статус: `Draft` (источник истины — код).

## Scope

- AuthN/AuthZ (cookies + refresh rotation)
- CORS/origin constraints для auth-операций
- RBAC на API endpoints
- Internal auth между worker ↔ api
- Object storage (presigned URLs)

## Source of truth порядок

1. Код и тесты
2. Prisma schema / runtime-контракты / API handlers
3. `documents/generated/*`
4. Markdown-доки

## Current invariants (`Implemented`, verified in code)

### Auth: cookies + refresh rotation

- Access token хранится в httpOnly cookie (по умолчанию `AUTH_COOKIE_NAME=access_token`).  
- Refresh token хранится в httpOnly cookie (по умолчанию `AUTH_REFRESH_COOKIE_NAME=refresh_token`) и ротируется на каждый refresh.
- Refresh reuse detection: повторное использование refresh token → revoke всей session family.
- Server-side sessions: refresh tokens привязаны к `auth_sessions`/`auth_refresh_tokens` в БД; доступ валидируется по `sid` (session id) в JWT payload.

### CORS + origin checks

- CORS включает `credentials: true`; разрешённые origins берутся из `CORS_ORIGIN`/`WEB_ORIGIN` (comma-separated).
- В production запрещён `CORS_ORIGIN="*"` при credentials.
- На `/auth/refresh` и `/auth/logout` дополнительно проверяется origin/referer на allowlist (defense-in-depth).

### RBAC и доступы

- Защита большинства “teacher/*” endpoints через `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.teacher)`.
- Student endpoints ограничены ролью `student` и используют `req.user.id` как studentId (без передачи studentId с клиента).
- Проверка “lead teacher owns student” для teacher-review сценариев делается на уровне сервисов (см. Learning/PhotoTask).

### Worker ↔ API internal auth

- Worker применяет результаты LaTeX compile через internal endpoint с заголовком `x-internal-token`.
- Token сравнивается с `WORKER_INTERNAL_TOKEN` (dev fallback есть, но в prod должен быть задан безопасно).

### Object storage (presigned URLs)

- Файлы в S3/MinIO доступны через presigned URLs, которые выдаёт backend.
- Asset keys сейчас хранятся прямо в доменных сущностях (например `Unit.theoryPdfAssetKey`, `TaskRevision.solutionPdfAssetKey`, `PhotoTaskSubmission.assetKeysJson`), универсальной таблицы “entity_assets” нет.

## Source links

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
  - `apps/api/src/learning/photo-task.service.ts`
  - `apps/api/src/learning/student-units.controller.ts`

## Planned / TODO

- Threat model по trust boundaries (web↔api, api↔db/redis/s3, worker↔api/s3) и attacker model (student/teacher/external).
- CI checks: ссылки/сироты/`Implemented` vs `Planned` и минимальный security checklist.
