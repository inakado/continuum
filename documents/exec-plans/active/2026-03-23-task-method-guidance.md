# 2026-03-23 — Методические указания для задач

## Цель и контекст

Добавить task-level поле методических указаний, которое teacher может задавать при создании и редактировании задачи в интерфейсе юнита.

Поле должно:
- храниться вместе с контентом задачи;
- версионироваться как часть `TaskRevision`;
- проходить через teacher create/update/read path;
- быть доступным на student read path для последующего UI-использования.

## In scope

- Prisma schema для `TaskRevision`
- teacher task DTO/write/read path
- teacher task form
- runtime/web task types
- тесты для write path и teacher unit flow
- обновление профильного SoR-документа

## Out of scope

- визуальный показ методических указаний в student unit screen
- отдельный rich-text/LaTeX editor для методических указаний
- backfill legacy revisions

## Порядок выполнения

1. Добавить новое nullable revision field в schema и mapping layer.
2. Протянуть поле через teacher create/update/read path.
3. Добавить textarea в `TaskForm` и wiring в unit screen actions.
4. Обновить тесты и документацию.
5. Прогнать `lint:boundaries`, `typecheck`, релевантные тесты.

## Decision log

- Методические указания хранятся в `TaskRevision`, а не в `Task`, потому что это часть content snapshot и должна ревизироваться вместе с условием/ответом.
- Формат поля на первом шаге: nullable plain text (`string | null`) без отдельного render pipeline.
- Teacher create-flow после первого `Создать` остаётся в том же editor session и автоматически переключается на edit-mode новой draft-задачи; это минимальный способ открыть image/solution actions без отдельного unsaved asset pipeline.
- Возврат из task editor в список задач идёт через explicit `К задачам`: форма делает best-effort autosave только если изменения валидны и отличаются от initial snapshot, чтобы не создавать пустые/no-op revisions.

## Риски

- Несогласованность teacher/student task mapping при неполном обновлении read-path.
- Лишний scope creep в rich text / preview flow, если не ограничить поле plain text.

## Критерии завершения

- Teacher может создать и отредактировать задачу с методическими указаниями.
- API возвращает поле в task payload.
- Все релевантные проверки зелёные.
