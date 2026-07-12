# 2026-07-12 — Runtime performance optimization

Статус: `Completed`

## Цель и контекст

Ускорить student dashboard и первый вход в Excalidraw внутри юнита без изменения learning-контрактов, availability semantics и визуального поведения.

Исходный анализ:

- React Doctor `0.7.6`, performance category: `42/100`; практический frontend finding — анимация progress bar через `width`.
- Next experimental analyzer: route graph `/student/units/[id]` содержит около `3.7 MB gzip`, из них Excalidraw около `1.44 MB gzip`; chunk асинхронный и не входит целиком в initial load.
- Production initial assets: `/login` около `307 KB gzip`, `/student/units/[id]` около `421 KB gzip` без асинхронного Excalidraw chunk.
- `GET /student/dashboard` последовательно пересчитывает каждый section; один section recompute выполняет чтения learning context и последовательный `upsert` каждого `StudentUnitState`.
- `getPublishedUnitForStudent()` повторно пересчитывает target section после section-sequence recompute.

## In scope

1. Ограниченно параллельный section recompute на dashboard.
2. Пропуск записи неизменившихся `StudentUnitState`.
3. Устранение повторного target-section recompute при открытии юнита.
4. Transform-based progress animation.
5. Idle-prefetch Excalidraw только для юнитов с развернутыми задачами и только на подходящем соединении.

## Out of scope

- Worker/read-model migration.
- Изменение API schemas и Prisma schema.
- Перенос глобальных Excalidraw/KaTeX CSS: они сохраняются как intentional preload.
- Пересмотр font loading и низкоэффектные React Doctor findings.

## Порядок выполнения

1. Добавить regression tests для persistence, dashboard concurrency и unit recompute count.
2. Оптимизировать backend, сохранив synchronous freshness.
3. Добавить frontend animation и board prefetch tests.
4. Реализовать frontend изменения.
5. Выполнить typecheck/tests/build, повторить React Doctor и Next analyzer.

## Decision log

- `2026-07-12`: availability продолжает вычисляться синхронно; меняется только orchestration и no-op persistence.
- `2026-07-12`: глобальные Excalidraw/KaTeX CSS не переносятся, чтобы первый вход в content flow использовал уже прогретые стили.
- `2026-07-12`: Excalidraw JS prefetch запускается в idle только при наличии подходящей задачи; `Save-Data` и медленные соединения исключаются.

## Риски и rollback

- Риск stale snapshots снижается сохранением synchronous recompute; no-op определяется сравнением всех persisted полей.
- Риск DB burst ограничивается небольшими batch-группами, без unbounded `Promise.all`.
- Риск конкуренции Excalidraw с основным контентом ограничивается idle scheduling и network policy.
- Rollback выполняется отдельным откатом orchestration/prefetch; контрактов и миграций нет.

## Критерии завершения

- Повторный recompute неизменившегося section выполняет `0` записей `StudentUnitState`.
- Dashboard запускает независимые section recomputes конкурентно в ограниченной группе.
- Target section при открытии юнита не пересчитывается второй раз.
- React Doctor width-animation finding отсутствует.
- Board prefetch соблюдает relevance/network policy и не ломает lazy fallback.
- Все обязательные проверки проходят; публичные response shapes и learning semantics не изменены.

## Проверки

- `pnpm lint:boundaries`
- `pnpm --filter web typecheck`
- `pnpm --filter web test`
- релевантные `@continuum/api` unit tests
- API typecheck/build в Docker-контуре
- `pnpm --filter web build`
- React Doctor performance scan
- Next experimental analyzer

## Progress log

- `2026-07-12`: baseline и решения зафиксированы; реализация начата.
- `2026-07-12`: dashboard recompute ограничен batch-размером `4`; unchanged snapshots больше не создают `upsert`.
- `2026-07-12`: unit access использует snapshot, уже вычисленный section sequence; повторный target-section recompute устранён.
- `2026-07-12`: общий cached loader и network-aware idle-prefetch Excalidraw подключены только для юнитов с `photo` technical answer type.
- `2026-07-12`: React Doctor finding по width animation оказался мёртвым кодом; неиспользуемый `ProgressBar` и его CSS удалены.
- `2026-07-12`: React Doctor performance scan изменился с `2 errors + 12 warnings` до `0 errors + 12 warnings`; оставшиеся findings не входят в эту волну.
- `2026-07-12`: web production build и Next analyzer прошли; глобальные Excalidraw/KaTeX CSS и async chunk boundary сохранены.
- `2026-07-12`: smoke `login → dashboard → unit → task 6 → board` пройден; Excalidraw отрисован. MinIO не запускался, поэтому asset requests к `localhost:9000` ожидаемо завершались ошибкой.
- `2026-07-12`: `136` web tests, `64` API tests, web/API typecheck, boundary lint и production build прошли.
