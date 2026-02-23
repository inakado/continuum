# 2026-02-23 — Full-Log Error Modal для LaTeX compile в Unit Editor

## Контекст
- Проблема: при невалидном LaTeX в unit editor (теория/методика) фронт показывал только короткое/склеенное сообщение без прозрачного server-side лога.
- Цель: вывести понятный, полный (tail) лог компиляции через overlay modal поверх интерфейса, без внедрения постоянного отдельного блока.

## Scope
- `apps/worker`: расширение compile error payload (`log`, `logTruncated`, legacy `logSnippet`).
- `apps/api`: расширение parse/response для `GET /teacher/latex/jobs/:jobId` при `failed`.
- `apps/web`: единая modal UX для `theory`, `method`, `task_solution`.
- `documents/*`: SoR-обновления по контракту ошибок.

## Не входит в scope
- Новый отдельный API endpoint для скачивания полного лога.
- Переработка очереди/retry модели compile jobs.
- Визуальный редизайн экрана вне области compile-error UX.

## Инварианты и решения
1. `Implemented`: Backend остаётся backward-compatible — поле `error.logSnippet` сохраняется.
2. `Implemented`: Новый контракт ошибки включает `error.log` (tail до ~256KB) и `error.logTruncated`.
3. `Implemented`: Модалка открывается автоматически на `failed` во всех LaTeX compile flow в `TeacherUnitDetailScreen`.
4. `Implemented`: Inline-ошибка остаётся короткой (`"Компиляция не удалась. Откройте лог."`) и не содержит длинный лог.

## Шаги реализации
1. Worker compile: заменить snippet-only формат на `log + logSnippet + logTruncated`.
2. Worker processor: сериализовать новые поля в `failedReason` JSON.
3. API controller: парсить и отдавать новые поля в job-status response.
4. Web types: расширить тип `LatexCompileJobStatusResponse.error`.
5. Unit editor UI: внедрить overlay modal (Esc, backdrop close, copy log, `role="dialog"`, `aria-modal`).
6. Обновить `documents/CONTENT.md` и `documents/ARCHITECTURE.md`.

## Риски
- Большой лог может ухудшить UX на слабых устройствах.
  - Митигировано: tail limit и скроллируемый `pre` в модалке.
- Потенциальная регрессия из-за изменения compile-flow веток.
  - Митигировано: сохранена существующая ветка `succeeded`, изменена только fail-обработка.

## Проверка
- `pnpm --filter @continuum/api typecheck`
- `pnpm --filter @continuum/worker typecheck`
- `pnpm --filter web typecheck`
- Ручной smoke: невалидный LaTeX для theory/method/task_solution -> модалка с code/message/log.

## Decision log
- Отдельный endpoint логов отложен: избыточно для текущего объёма задачи.
- Выбран overlay/modal, а не постоянный блок в layout, согласно продуктовой задаче.

## Troubleshooting notes
- Где упало: `docker compose exec -T api sh -lc "pnpm --filter @continuum/api typecheck"`.
- Что увидели: `TS2353 ... 'description' does not exist in type ... SectionCreateInput`.
- Причина: устаревший Prisma Client в контейнере API после изменений schema/типов.
- Как чинить:
  1. `docker compose exec -T api sh -lc "pnpm --filter @continuum/api exec prisma generate"`
  2. повторить `docker compose exec -T api sh -lc "pnpm --filter @continuum/api typecheck"`
- Критерий проверки: `typecheck` проходит без ошибок.
- Где упало: runtime API (`P2022`, `column sections.description does not exist`) при `GET /teacher/courses/:id`.
- Что увидели: Prisma запущен с актуальной schema, но миграция `20260222032000_section_description` не была применена к БД.
- Причина: schema/client обновлены, а БД отстала по миграциям.
- Как чинить:
  1. `docker compose exec -T api sh -lc "pnpm --filter @continuum/api exec prisma migrate deploy"`
  2. проверить статус: `docker compose exec -T api sh -lc "pnpm --filter @continuum/api exec prisma migrate status"`
  3. при необходимости проверить колонку: `docker compose exec -T postgres psql -U continuum -d continuum -c "SELECT column_name FROM information_schema.columns WHERE table_name='sections' AND column_name='description';"`
- Критерий проверки: `Database schema is up to date` и колонка `description` существует в `sections`.
