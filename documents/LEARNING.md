# LEARNING

Статус: `Draft` (источник истины — код).

## Scope

- Attempts (auto-check)
- Task state (3+3 locks, auto-credit, teacher credit/unblock)
- Unit availability + progress snapshots
- Overrides (open unit)
- Notifications (teacher)
- Photo tasks (manual review)

## UI Terminology Mapping (`Implemented`)

- В доменной модели и API сохраняется `required`-нейминг (`isRequired`, `required_skipped`, `required_task_skipped`).
- Во фронтовом user-facing тексте required-задача отображается как `Ключевая задача`; это терминологический mapping без изменения бизнес-логики.

## Core Invariants (`Implemented`)

### Auto-check task types

- Auto-check submit endpoint принимает только `numeric | single_choice | multi_choice`.
- `photo` задачи обрабатываются отдельным manual review pipeline.

### 3+3 policy (lock + auto-credit)

- После 3-й неправильной попытки:
  - выставляется `student_task_state.locked_until = now + course.lockDurationMinutes`
  - создаётся notification для lead teacher (`NotificationType.task_locked`)
  - пишется domain event `TaskLockedForStudent`
- После 6-й неправильной попытки:
  - статус задачи становится `credited_without_progress`
  - для required задачи выставляется `required_skipped=true`
  - создаётся notification для lead teacher (`NotificationType.required_task_skipped`)
  - пишутся domain events `TaskAutoCreditedWithoutProgress` и `RequiredTaskSkippedFlagSet` для required-задачи.
- Если задача заблокирована (`locked_until > now`) — Attempt не создаётся.

### Task revision switching

- `StudentTaskState.activeRevisionId` должен следовать за `Task.activeRevisionId` для не засчитанных задач.
- Если active revision изменилась, а задача ещё не в credited статусе, state сбрасывается в `not_started`, а счётчики обнуляются.

### Task navigation inside unit

- Внутри открытого student unit задачи доступны для выбора в любом порядке.
- Ограничения остаются доменные: unit-level availability и per-task блокировки по 3+3.

## Progress & Availability (`Implemented`)

### Snapshots model

- Availability считается на уровне section:
  - загружаются published units/edges/tasks;
  - используются `StudentTaskState.status` и факт attempts;
  - считается снапшот по каждому unit (`locked|available|in_progress|completed` + counters/percents).
- Снапшоты persisted в `student_unit_state` через upsert.
- Пересчёт вызывается:
  - в student views;
  - перед или внутри submit attempt;
  - после teacher actions;
  - после publish/unpublish и graph update через `LearningRecomputeService`.

### Последовательность разделов курса

- Student read-path для `Course.sections` считает не только `completionPercent`, но и student-specific `accessStatus` раздела:
  - `available` — текущий открытый раздел;
  - `completed` — раздел полностью завершён;
  - `locked` — раздел пока закрыт предыдущей последовательностью.
- Первый опубликованный раздел курса открыт сразу.
- Каждый следующий раздел открывается только после полного завершения предыдущего раздела.
- Published section без published units не должен блокировать последовательность следующих разделов.
- `GET /sections/:id` и `GET /sections/:id/graph` для student fail-fast отвечают `SECTION_LOCKED`, если раздел ещё не открыт по последовательности курса.
- Direct access к `GET /units/:id` также защищён section-level gate, чтобы student не обходил последовательность разделов прямой ссылкой.

### Counted vs solved

- `counted` статусы: `correct | accepted | credited_without_progress | teacher_credited`
- `solved` статусы: `correct | accepted | teacher_credited`

### Completion gate

- Required gate: все required задачи должны быть counted.
- Optional gate: `optionalCountedTasks >= effectiveMinOptionalCountedTasksToComplete`.
- Guard против “нулевого гейта”: если в unit нет required задач и `minOptionalCountedTasksToComplete=0`, effective threshold становится “все optional задачи”.

### Unit status

- `completed`, если completion gate выполнен.
- иначе:
  - `available`, если все prereq units completed или есть override;
  - `in_progress`, если unit открыт и есть хотя бы 1 attempt в задачах юнита;
  - `locked` иначе.

## Teacher Actions (`Implemented`)

- Override open unit: создаёт `unit_unlock_overrides` и пересчитывает section availability.
- Teacher credit task: переводит задачу в `teacher_credited` и пересчитывает availability.
- Teacher unblock task: снимает `locked_until` и пересчитывает availability.

## Notifications (`Implemented`)

- В БД есть `NotificationType`:
  - `task_locked`, `required_task_skipped` — реально используются сейчас;
  - `photo_reviewed`, `unit_override_opened` — есть в enum.

## Photo Tasks (`Implemented` частично)

- Student:
  - presign upload + submit photo попытки;
  - list submissions + presign view.
- Teacher:
  - inbox + detail;
  - accept/reject с domain events `PhotoAttemptAccepted|Rejected`.

## Source Links

- Availability snapshots:
  - `apps/api/src/learning/learning-availability.service.ts`
  - `apps/api/src/learning/learning-recompute.service.ts`
- Attempts + teacher actions:
  - `apps/api/src/learning/learning.service.ts`
  - `apps/api/src/learning/learning-attempts-write.service.ts`
  - `apps/api/src/learning/learning-teacher-actions.service.ts`
  - `apps/api/src/learning/learning-audit-log.service.ts`
- Photo tasks:
  - `apps/api/src/learning/photo-task.service.ts`
  - `apps/api/src/learning/photo-task-read.service.ts`
  - `apps/api/src/learning/photo-task-review-write.service.ts`
  - `apps/api/src/learning/photo-task-policy.service.ts`
- Prisma models:
  - `apps/api/prisma/schema.prisma`
