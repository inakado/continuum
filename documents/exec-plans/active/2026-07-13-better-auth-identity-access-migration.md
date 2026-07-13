# Миграция Identity & Access на Better Auth

Статус: `Active`

## 1. Цель и контекст

Заменить custom JWT/refresh contour на Better Auth с DB-backed sessions, сохранив доменные роли и ownership. Одновременно перевести API на fail-closed AuthZ, выделить роль `admin` и закрыть обнаруженные security gaps.

## 2. In scope

- Better Auth username/password + Prisma adapter.
- Роли `admin | teacher | student` и отдельный `/admin` contour.
- Технический email `<login>@users.continuum.invalid`.
- DB-backed fixed 14-day sessions без cookie cache.
- Атомарный provisioning `User + Account + Profile`.
- Global fail-closed guard, production debug/internal hardening.
- Frontend session/login/logout cutover.
- Auth integration, browser smoke, CI/deploy gate и SoR docs.

## 3. Out of scope

- Email delivery/verification/reset.
- Social login, OAuth, MFA и external IdP.
- Content ownership между преподавателями.
- Совместимость существующих pre-launch auth records.

## 4. Порядок выполнения

1. Закрыть завершённый Excalidraw plan.
2. AuthZ hardening: debug/internal, student password reset, admin boundary.
3. Baseline auth integration tests.
4. Better Auth spike: Nest/ESM/body parser/Prisma/proxy/atomic provisioning.
5. Expand schema и внедрить IdentityProvisioningService.
6. Global fail-closed session/role guards.
7. Frontend cutover и отдельный `/admin` UI.
8. Production smoke, затем удаление legacy JWT/refresh contour.
9. Docs, generated artifacts и финальная проверка.

## 5. Зафиксированные решения

- Существующий `User` остаётся центральной identity.
- Login canonical lowercase и неизменяем.
- `admin` управляет преподавателями в отдельном `/admin` UI.
- Первый admin создаётся одноразовой CLI-командой.
- Better Auth не заменяет domain ownership checks.
- Sessions фиксированные 14 дней; cookie cache и Redis secondary storage отключены.
- Public signup, email sign-in/change/reset и username availability отключены.
- Старые auth tables удаляются только после зелёного cutover smoke.

## 6. Риски и checkpoints

- Better Auth и Nest adapter являются ESM-only: spike обязан пройти production Docker build.
- Nest integration требует `bodyParser: false`: все существующие JSON endpoints проверяются integration tests.
- Better Auth API не гарантирует внешнюю Prisma transaction для domain profile: provisioning реализуется одной собственной Prisma transaction и фиксируется contract tests.
- External `/api/auth/*` должен корректно отображаться на internal `/auth/*` за Nginx.

## 7. Completion criteria

- Только `admin` управляет преподавателями.
- Все routes fail-closed, public/internal исключения явные.
- Debug API отсутствует в production.
- Password reset отзывает все sessions.
- Login/session/logout обслуживает Better Auth; legacy JWT/refresh удалён.
- Реальные auth integration tests работают без guard overrides.
- Production HTTPS/Nginx auth smoke является deploy gate.
- `SECURITY`, `ARCHITECTURE`, `HANDLER-MAP`, generated docs и deploy runbook актуальны.

## 8. Progress log

- 2026-07-13: завершён repository audit AuthN/AuthZ, Prisma identity links, frontend session flow, deploy proxy и test contour.
- 2026-07-13: продуктовые решения зафиксированы: отдельная роль/admin UI, CLI bootstrap, fixed 14-day sessions, immutable lowercase login.
- 2026-07-13: завершён первый hardening slice: роль `admin`, admin-only teacher writes и отдельный `/admin/teachers` UI, teacher read-only directory, production debug exclusion, Nginx internal deny, fail-fast internal token и session revocation при student password reset. Проверки: API 70/70, web 136/136, web typecheck, boundaries.
- 2026-07-13: ownership checks для review accept/reject, unit/section override, credit и unblock перенесены внутрь соответствующих Prisma transactions, устраняя окно между pre-check и write.
- 2026-07-13: Better Auth spike завершён. Зафиксированы `better-auth@1.6.23` и `@thallesp/nestjs-better-auth@2.7.0`; Nest adapter работает с `bodyParser: false`, существующий CommonJS production image и Node 24 не требуют ESM-миграции.
- 2026-07-13: добавлена additive identity schema (`Account`, `Session`, `Verification` и Better Auth поля `User`) с backfill canonical login, technical email и credential accounts. Миграция успешно применена к пустой локальной БД.
- 2026-07-13: введён атомарный `IdentityProvisioningService`: teacher/student создаются вместе с credential account и profile; password change/reset синхронизирует оба password store и отзывает legacy + Better Auth sessions. Ownership student password reset повторно проверяется внутри write-транзакции.
- 2026-07-13: runtime smoke прошёл: mixed-case username нормализуется, session хранится в БД с fixed 14-day expiry, mutation без `Origin` отклоняется, trusted-origin sign-out немедленно удаляет session. Production runner дополнен workspace manifests, документированная `pnpm --filter ... prisma migrate deploy` команда снова работает.
