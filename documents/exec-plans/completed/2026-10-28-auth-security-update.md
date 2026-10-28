# Исправление high/critical без исключений

Статус: Completed локально, 28.10.2026. SEC-02 закрыт. GitHub Actions и production-выпуск не выполнялись.

Последующий [production-выпуск](2026-10-28-production-release.md) подтвердил настоящий CI quality/security и совместимость авторизации в production; ниже сохранены результаты локального security-этапа.

## Цель и границы

Убрать high/critical обновлением опубликованных исправленных пакетов и проверить реальные инварианты авторизации. Сохранить существующие cookies/сессии/Argon2-пароли, роли, Origin/CSRF/rate limits, изоляцию reviewer keys и пользовательские данные. Новые способы входа, сброс сессий, production-публикация и исключения advisory не входят в задачу.

## Порядок

1. Снять актуальный audit и проверить npm/release metadata, совместимость Nest/Prisma/клиента/API-key.
2. Точечно обновить согласованный Better Auth граф и совместимый qs; сверить schemas и release notes.
3. Проверить вход/выход, неверный пароль, сохранение старой сессии/старого пароля, роли, блокировку/сброс/удаление ученика, Origin, rate limit, API-key broker/revocation/изоляцию.
4. Выполнить проверки quality/security jobs локально: docs/lint/boundaries/typecheck/tests/builds/audit/Trivy. Не выдавать локальную проверку за запуск GitHub Actions.
5. Обновить SoR/tracker и завершить план с результатами и ограничениями.

## Решения и риски

- Registry и GitHub подтверждают стабильный 1.7.14; фраза старого advisory «1.7.7 not available yet» устарела. Ориентир — реально опубликованный пакет и исходники релиза.
- Backend build/typecheck только в Docker. На хосте frozen install запрещён; host dependency sync — обычный pnpm install, без ослабления проверок.
- Предыдущие изменения working tree сохраняются. Данные/секреты production не читаются и не меняются.
- Временная копия исходных manifests/lockfile для точечного отката: /tmp/continuum-security-rollback. Новый код/тесты откатываются отдельно, не через reset всего working tree.

## Прогресс и проверки

До обновления: 4 high / 2 critical / 1 moderate / 5 low occurrences. После: **0 high / 0 critical / 0 moderate / 1 low**. Включены username/api-key и Prisma; OAuth/Magic Link/device authorization не включены, но пакеты обновлены без allowlist.

- `better-auth` в API/web и `@better-auth/api-key`: 1.6.23 → **1.7.14**; `qs`: 6.16.0 → **6.16.1**. Остальные прямые зависимости и конфигурация авторизации не менялись.
- Обновление закрывает [device authorization](https://github.com/advisories/GHSA-q84f-53jg-9ppm), [OAuth Proxy](https://github.com/advisories/GHSA-r4xp-prcw-77qf), [Magic Link/OAuth state](https://github.com/advisories/GHSA-965c-763c-88jm), [adapter rate limiting](https://github.com/advisories/GHSA-44jh-23m7-hpcf) и [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw). Стабильный релиз подтверждён [upstream 1.7.14](https://github.com/better-auth/better-auth/releases/tag/v1.7.14) и npm registry.
- Точная команда CI `pnpm audit --audit-level=high` завершилась **exit 0** с живым registry. Полный JSON подтверждает severity выше; JSON-режим pnpm возвращает exit 1 из-за оставшегося low и не используется как severity gate.
- Удалён `ignore-unfixed: true` у Trivy. Тот же Trivy **0.69.3**, который задан pinned action 0.35.0, проверил исходники будущего checkout: vulnerability и secret scanners включены, HIGH/CRITICAL **0**, exit 0. Нет новых ignore-файлов, advisory allowlist, `continue-on-error` или отключения защиты.
- Оставшийся [KaTeX low](https://github.com/advisories/GHSA-238p-pmpm-9mq7) виден в audit и остаётся SEC-01. Несовместимая подмена версии 0.x ради исчезновения предупреждения не выполнялась.

### Проверка совместимости схемы

Официальный [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide) уточняет, что обязательный Account.issuer из 1.7.0–1.7.2 отменён в 1.7.3. Для выбранного 1.7.14 schema Account соответствует 1.6 (providerId/accountId), миграция issuer не требуется. Существующие API-key configId/referenceId и Prisma adapter сверяются с установленными исходниками; новые OAuth плагины не включаются. Nest integration 2.7.0 принимает better-auth >=1.5 <2.0.

### Авторизация и сохранение данных

- Новый `auth-security.integration.test.ts` проверяет настоящий HTTP username/password login, teacher/student/admin/anonymous boundaries, подделанную cookie, закрытые signup/email/update-user/API-key routes, чужой Origin, logout и реальный лимит 5 попыток входа. Валидный серверный API-key отдельно проверен: ни Bearer, ни x-api-key не дают session/teacher-доступ.
- Прежние integration tests прошли на новом API: сброс/отзыв сессий, деактивация, удаление/восстановление ученика, ownership банка/работ/фото, reviewer scopes, TTL, отзыв ключа и публикация точных ревизий. Role matrix с mock-сессиями дополнена новым реальным HTTP-набором, а не выдана за полную проверку auth-плагина.
- Дополнительная проверка перехода 1.6.23 → 1.7.14: два временных пользователя, сессии и reviewer-ключ созданы старым локальным API, затем использованы новым Docker API. Старые cookies и ключ работают, роли сохранены; Argon2-хеши, ID и expiry сессий не изменились, повторный вход прежними паролями успешен. Старый reviewer-ключ открывает только reviewer API, не `/me`.
- Runtime auth factory, trusted origins, Argon2, TTL, guards и session-for-API-key policy не ослаблялись. Перенос или reset пользовательских данных не требовались.

### Quality gates

| Проверка | Результат |
| --- | --- |
| Web tests | 72 файла / 268 тестов |
| Shared tests | 16 файлов / 57 тестов |
| API unit tests в Docker | 25 файлов / 89 тестов |
| API integration, новый API + PostgreSQL + S3 | 14 файлов / 77 тестов |
| Reviewer CLI | 6 тестов |
| Lint / boundaries | 0 ошибок; прежние 9 complexity warnings |
| Web/shared и Docker API typecheck | passed |
| Production backend image, web/shared build | passed; frozen lockfile принят Docker build |
| Audit / Trivy | passed без исключений |

Всего **497 тестов**. `pnpm docs:check` и `git diff --check` прошли. Production backend image собран штатным `pnpm build:backend`; основной локальный API 1.6.23 не заменялся, отдельный QA-контейнер использовал 1.7.14. Локальные проверки не являются запуском GitHub Actions или production-приёмкой.

### Task-specific troubleshooting

- Builder image не содержит `examples`, нужных одному unit test: fixtures скопированы только в временный QA-контейнер. Production Dockerfile не расширялся ради тестовых файлов.
- Новые тесты сначала предполагали несуществующий `/admin/teachers`, стандартный `Retry-After` вместо фактического `X-Retry-After` и 60-секундный API-key ниже минимального срока 1 день. Исправлены тестовые предположения; production guards/rate limit/TTL не менялись. Финальный полный integration suite прошёл.

## Откат и оставшиеся границы

Откатываются только версии в трёх manifests и согласованный lockfile относительно снимка `/tmp/continuum-security-rollback`, новый regression test и документы этого пакета. Такой откат вернёт известные уязвимости и должен снова сделать security gate красным; исключения не являются вариантом отката. Не применять reset всего накопленного working tree. Миграция/восстановление БД для этого dependency update не нужны.

Временные учётные записи/ключи удалены (проверено: осталось 0 QA-пользователей), отдельный QA-контейнер удалён. Файлы временной проверки с cookies/паролями/ключом удалены; реальные пользователи, ответы и S3-файлы не менялись. Для выпуска отдельно нужны конкретный commit, зелёный GitHub Actions и production-приёмка входа/ролей/фото. Остаются SEC-01 и прежние пункты пилотного roadmap.
