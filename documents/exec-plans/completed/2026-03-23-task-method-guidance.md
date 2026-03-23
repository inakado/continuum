# Execution Plan: Методические указания для задач

Статус плана: `Completed`

> `2026-03-23`: план завершён и перенесён в `documents/exec-plans/completed/`.

## 1. Цель

Добавить task-level поле методических указаний, которое teacher может задавать при создании и редактировании задачи в интерфейсе юнита.

## 2. Контекст

- Методические указания должны храниться вместе с содержимым задачи и версионироваться как часть `TaskRevision`.
- Поле должно проходить через teacher create/update/read path и быть доступным на student read path для последующего UI-использования.
- Teacher authoring flow должен позволять задать методические указания, изображение условия и LaTeX-решение без повторного ручного входа в редактор после первого создания draft-задачи.

## 3. In scope

- Prisma schema для `TaskRevision`
- teacher task DTO/write/read path
- teacher task form и unit editor flow
- runtime/web task types
- тесты для write path и teacher unit flow
- обновление профильного SoR-документа

## 4. Out of scope

- визуальный показ методических указаний в student unit screen
- отдельный rich-text/LaTeX editor для методических указаний
- backfill legacy revisions

## 5. Decision log

1. Методические указания хранятся в `TaskRevision`, а не в `Task`, потому что это часть content snapshot и должна ревизироваться вместе с условием и ответами.
2. Формат поля на первом шаге: nullable plain text (`string | null`) без отдельного render pipeline.
3. Teacher create-flow после первого `Создать` остаётся в том же editor session и автоматически переключается на edit-mode новой draft-задачи; это минимальный способ открыть image/solution actions без отдельного unsaved asset pipeline.
4. Возврат из task editor в список задач идёт через explicit `К задачам`: форма делает best-effort autosave только если изменения валидны и отличаются от initial snapshot, чтобы не создавать пустые/no-op revisions.
5. Локальные `numericParts` и `choices` в `TaskForm` используют внутренние уникальные ключи form-state; transport payload по-прежнему нормализуется отдельно и не зависит от React render keys.

## 6. Риски

- Несогласованность teacher/student task mapping при неполном обновлении read-path.
- Лишний scope creep в rich text / preview flow, если не ограничить поле plain text.
- Потенциальные no-op save paths при `К задачам`, если не сравнивать форму с initial snapshot.

## 7. Критерии завершения

- Teacher может создать и отредактировать задачу с методическими указаниями.
- Teacher может после первого создания draft сразу перейти к загрузке изображения условия и компиляции HTML-решения в том же editor session.
- API возвращает поле в task payload.
- Все релевантные проверки зелёные.

## 8. Progress log

- `2026-03-23`: добавлено поле `TaskRevision.methodGuidance` в Prisma schema и migration.
- `2026-03-23`: обновлены teacher DTO, mapping/write/read path и web/runtime task types.
- `2026-03-23`: в `TaskForm` добавлено поле методических указаний; позже секция перенесена после блока редактирования ответов по финальному UX-требованию.
- `2026-03-23`: create-flow teacher task editor изменён так, чтобы после первого `Создать` экран оставался в editor session и переходил в edit-mode новой draft-задачи.
- `2026-03-23`: кнопка возврата `К задачам` получила best-effort autosave для валидных и реально изменённых данных.
- `2026-03-23`: устранён React warning про duplicate keys при смене типа задачи за счёт уникальных локальных ключей form-state.
- `2026-03-23`: убрана пустая stub-секция для `Фото-ответ` в teacher task form.

## 9. Проверки

- `pnpm lint:boundaries` — `OK`
- `pnpm --filter web typecheck` — `OK`
- `pnpm exec vitest run --config vitest.config.ts features/teacher-content/tasks/TaskForm.test.tsx features/teacher-content/units/TeacherUnitDetailScreen.test.tsx` в `apps/web` — `OK`
- `pnpm exec vitest run --config vitest.config.ts test/content-write-tasks.test.ts` в `apps/api` — `OK`
- `pnpm --filter web test` — `OK`
- `pnpm test` — `OK`

## 10. Troubleshooting

- Если backend читает старую схему и поле `method_guidance` отсутствует в контейнерной БД, нужно прогнать Prisma migration внутри `api` контейнера, а не через host build path.
