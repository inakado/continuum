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
- 2026-07-13: включён global fail-closed `SessionAuthGuard`; health/ready/internal исключения объявлены явно, inactive identity блокируется с немедленным удалением sessions. API route matrix проверена для teacher/student/admin.
- 2026-07-13: frontend полностью переведён на Better Auth client и React Query session state; удалены refresh/replay orchestration, добавлено раздельное поведение для `401`, `403` и network/5xx. Browser smoke пройден для трёх ролей.
- 2026-07-13: добавлены idempotent `bootstrap:admin` и новый Better Auth smoke. После зелёного cutover удалены Passport/JWT, legacy auth services/controllers, `password_hash`, `auth_sessions` и `auth_refresh_tokens`; credential hash остаётся только в `Account`.
- 2026-07-13: cleanup migration применена локально; Better Auth sign-in/session/foreign-origin rejection/sign-out/revocation прошли на production API image. API unit 84/84, web 141/141, web production build, boundaries и docs checks зелёные.
- 2026-07-13: dependency audit выполнен; несвязанные production/dev advisories вынесены в `TD-007`, чтобы не смешивать массовые dependency upgrades с auth cutover.
- 2026-07-13: regression gate завершён: workspace tests (API 84, web 141, worker 46, shared 26, latex-runtime 6), Docker integration 33/33, production builds API/web, workspace lint, docs и boundaries зелёные. На финальном образе teacher/student/admin проходят sign-in → session → role route → sign-out → 401; frontend browser smoke трёх ролей и post-logout guard прошёл без console errors.
- 2026-07-13: legacy audit подтверждает отсутствие JWT/Passport dependencies, old auth endpoints/symbols/env и frontend refresh orchestration. В локальной БД отсутствуют `auth_sessions`, `auth_refresh_tokens`, `users.password_hash`; исторические create/drop migrations и superseded decision cards сохранены намеренно.
- 2026-07-13: связанный `TD-007` закрыт отдельной dependency-only волной; `pnpm audit` не обнаруживает известных уязвимостей, полный regression gate и production runtime smoke зелёные.
- 2026-07-13: production остаётся pre-launch без ценных пользовательских данных, поэтому DB dump перед текущим cutover осознанно исключён из rollout gate.
- 2026-07-13: production preflight подтверждён: VPS находится на `439d271`, новые migrations не применены, текущие логины совместимы с canonicalization, TeX Live base `07e6616549b9` сохранён, свободно 15G. Для первого cutover выбран полный reset PostgreSQL/Redis, ручной SSH rollout и отдельная student identity для постоянного auth smoke.
- 2026-07-13: выявлены и включены в rollout устаревший host Node 20, отсутствующие `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, публичный production debug route и Nginx без deny для `/api/internal/*`. Reusable deploy не выполняет destructive reset и не пересобирает TeX Live base без отдельного явного разрешения.
- 2026-07-13: production prebuild обнаружил несовместимость старого `NEXT_PUBLIC_API_BASE_URL=/api` с SSR-валидацией Better Auth client. Production web build переведён на абсолютный `https://<APP_DOMAIN>/api`; сбой произошёл до Docker build и остановки сервисов.

## 9. Осталось до закрытия плана

- Применить expand + cleanup migrations на production; для текущего pre-launch cutover backup не требуется.
- Настроить production `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, trusted origins и deploy secrets для auth smoke.
- Выполнить `bootstrap:admin` и внешний HTTPS/Nginx auth smoke на целевом окружении.
- После успешного production rollout переместить план в `completed` и обновить индексы.
