# 2026-02-25 — Auth refresh stability + diagnostics

Статус: `Completed`

## Цель

Устранить разлогин пользователя спустя время жизни access-token и добавить диагностику, чтобы быстро локализовать будущие сбои в refresh-цепочке.

## Контекст

По текущему коду refresh-rotation реализован (`auth_sessions` + `auth_refresh_tokens`), но в прод-сценариях возможны ложные `401` из-за:
- гонок refresh (вкладки/параллельные запросы),
- legacy cookies с тем же именем и другим `path`,
- недостаточной наблюдаемости (ошибка теряется на клиенте и в API логах).

## Scope

In scope:
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.config.ts`
- `apps/web/lib/api/client.ts`
- SoR-доки (`documents/SECURITY.md`, `documents/FRONTEND.md`, `documents/DEVELOPMENT.md`)

Out of scope:
- миграция на BetterAuth,
- смена доменной модели пользователей/ролей,
- изменение API versioning/route base.

## Шаги реализации

1. Добавить tolerant-обработку stale refresh token (без немедленной ревокации сессии в race-сценариях).
2. Добавить cleanup legacy refresh-cookie paths, чтобы убрать дубли cookie с одинаковым именем.
3. Добавить структурные warn-логи в refresh/logout/login критических ветках.
4. Улучшить клиентскую обработку refresh-ошибок (не терять коды причин, retry для stale).
5. Прогнать smoke (`apps/api/scripts/smoke-auth-refresh.sh`) и обновить SoR-доки.

## Риски

- Ослабление security-модели при `REFRESH_TOKEN_REUSED` (false-negative на атакующий replay).
- Избыточная очистка cookies может преждевременно завершать сессию.
- Дополнительный retry на клиенте может скрывать реальные backend ошибки при плохой диагностике.

## Решения (Decision log)

- 2026-02-25: использовать grace-подход для `usedAt + replacedByTokenId` как race-tolerant ветку.
- 2026-02-25: очищать refresh-cookie по набору legacy paths, а не только по текущему path.
- 2026-02-25: в клиенте возвращать ошибки refresh с оригинальным `code`, не маскировать исходной 401.

## Критерии завершения

- Пользователь остаётся в сессии после истечения access-token при нормальном refresh-потоке.
- Race-сценарий не приводит к полной ревокации активной сессии.
- Логи явно содержат причину refresh отказа (`code`, контекст запроса).
- SoR-доки отражают новое поведение как `Implemented`.

## Выполнение и проверка

- Реализовано: race-tolerant stale-ветка refresh, cleanup legacy cookie paths, structured auth logging, клиентский stale-retry, обновление smoke-script.
- Команда проверки: `sh apps/api/scripts/smoke-auth-refresh.sh`
- Результат: `All refresh auth smoke checks passed.`

## Trouble Notes (во время выполнения)

- Где упало: `pnpm --filter @continuum/api exec tsc -p tsconfig.json --noEmit`
- Что увидели: массовые ошибки `Module '@prisma/client' has no exported member ...` / `Property ... does not exist on type 'PrismaService'`.
- Почему: в текущем локальном окружении Prisma client не синхронизирован для host-side typecheck (известный инфраструктурный контекст).
- Как чинить:
  - выполнить генерацию Prisma в рабочем окружении API: `docker compose exec -T api sh -lc "pnpm --filter @continuum/api exec prisma generate"`
  - повторить typecheck в согласованной среде.
- Как проверить: `pnpm --filter @continuum/api exec tsc -p tsconfig.json --noEmit` без ошибок импорта Prisma.
