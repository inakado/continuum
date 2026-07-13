# SECURITY

Статус: `Draft` (источник истины — код).

## Scope

- AuthN/AuthZ (Better Auth DB-backed sessions)
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

### Auth: Better Auth sessions

- Username/password authentication обслуживает Better Auth; public signup и email-вход отключены.
- Сессия хранится в таблице `sessions`, идентификатор передаётся только в `HttpOnly` cookie.
- Срок сессии фиксирован: 14 дней без sliding refresh; cookie cache и Redis session storage отключены.
- Logout, смена и сброс пароля немедленно удаляют активные сессии пользователя.
- `login` канонизируется в lowercase и связан с техническим email `<login>@users.continuum.invalid`.
- `BETTER_AUTH_SECRET` и `BETTER_AUTH_URL` обязательны в production.
- Auth endpoints ограничены общим rate limit; username sign-in — 5 попыток в минуту на client key.

### CORS + origin checks

- CORS включает `credentials: true`; разрешённые origins берутся из `CORS_ORIGIN`/`WEB_ORIGIN`.
- В production запрещён `CORS_ORIGIN="*"` при credentials.
- Better Auth проверяет Origin/Fetch Metadata для auth mutations по `trustedOrigins`.

### RBAC и доступы

- `admin/*` endpoints доступны только роли `admin`; создание/удаление преподавателей вынесено из teacher contour.
- Глобальный `SessionAuthGuard` защищает все routes по умолчанию; public routes помечаются `@AllowAnonymous()` явно.
- `RolesGuard` + `@Roles(...)` ограничивают role-specific routes.
- `GET /teacher/teachers` является read-only directory для transfer ученика; write-операций в этом contour нет.
- Student endpoints ограничены ролью `student` и используют `req.user.id` как studentId.
- Проверка “lead teacher owns student” для teacher-review сценариев делается на уровне сервисов.
- Сброс пароля ученика отзывает все активные sessions.

### Debug и internal routes

- Debug controllers регистрируются только вне production.
- Nginx не публикует `/api/internal/*`; worker обращается к internal endpoint внутри Docker network.
- `WORKER_INTERNAL_TOKEN` обязателен в production для API и worker; development fallback не применяется в production.

### Worker ↔ API internal auth

- Worker применяет результаты LaTeX compile через internal endpoint с заголовком `x-internal-token`.
- Token сравнивается с `WORKER_INTERNAL_TOKEN`.

### LaTeX runtime sandbox policy

- Backend LaTeX runtime основан на `TeX Live`, но остаётся в no-shell-escape contour.
- `pdflatex` source проходит fail-fast validation и отклоняется, если содержит:
  - XeTeX/LuaTeX-only preamble (`fontspec`, `unicode-math`, `polyglossia`, `\setmainfont` и похожие команды);
  - shell-escape/external-tooling markers (`minted`, `svg`, `\includesvg`, `\write18`, `\tikzexternalize`);
  - bibliography/index toolchain вне текущего scope.
- Worker и API не должны silently включать shell-escape как “compatibility fix”.

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

Photo/board feedback ACL (`Implemented`):
- Student `presign-view` разрешает читать только собственные photo/board submission assets.
- `teacherFeedbackBoardAssetKey` и `teacherFeedbackPreviewAssetKey` доступны ученику только для собственной submission после review.
- Teacher feedback upload keys валидируются по отдельному `teacher-feedback/` prefix и не перезаписывают оригинальные student board assets.

## Source Links

- Auth:
  - `apps/api/src/auth/auth.module.ts`
  - `apps/api/src/auth/better-auth.factory.ts`
  - `apps/api/src/auth/guards/session-auth.guard.ts`
  - `apps/api/src/auth/identity-provisioning.service.ts`
- CORS:
  - `apps/api/src/main.ts`
- Internal worker token:
  - `apps/api/src/content/internal-latex.controller.ts`
  - `apps/worker/src/latex/latex-apply-client.ts`
- LaTeX runtime:
  - `packages/latex-runtime/src/*`
- Storage:
  - `apps/api/src/infra/storage/object-storage.service.ts`
  - `apps/api/src/learning/photo-task-read.service.ts`
  - `apps/api/src/learning/photo-task-review-write.service.ts`
  - `apps/api/src/learning/photo-task-policy.service.ts`
  - `apps/api/src/learning/student-units.controller.ts`
  - `apps/api/src/learning/student-task-solutions.controller.ts`
