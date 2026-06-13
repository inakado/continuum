# 2026-03-02 — Performance profiling and optimization

Статус плана: `Completed`

## Назначение

Провести performance triage ключевых teacher/student сценариев, найти основные узкие места и закрыть безопасные optimization slices без изменения доменных контрактов.

## Итог

- Зафиксирован baseline profiling для teacher unit editor и student dashboard graph read-path.
- Оптимизации выполнялись инкрементально, с проверкой UI и server-state behavior.
- Доменные правила progress/unlock/attempts не менялись.
- Оставшиеся performance-направления не стали SoR-фактами и должны оформляться как отдельные initiatives при появлении реального запроса.

## Ключевые решения

- Performance-работа не должна менять response shape и learning semantics.
- Frontend bottlenecks устраняются через decomposition, server-state discipline и устранение лишних render/recompute paths.
- Backend bottlenecks по availability recompute фиксируются отдельно как `TD-006`, если потребуется batch/worker contour.

## Проверки

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:check`
- релевантные API integration/smoke checks внутри Docker при backend-изменениях
- релевантные `web` typecheck/lint/test при frontend-изменениях

## Остаточные ссылки

- `documents/exec-plans/tech-debt-tracker.md` — `TD-006`.
- `documents/FRONTEND.md` — текущие frontend performance/server-state правила.
- `documents/ARCHITECTURE-PRINCIPLES.md` — server-state discipline и effect isolation.
