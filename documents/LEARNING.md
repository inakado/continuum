# LEARNING

Статус: `Draft` (источник истины — код).

## Scope

- Attempts (auto-check)
- Task state (3+3 locks, auto-credit, teacher credit/unblock)
- Unit availability + progress snapshots
- Overrides (open unit)
- Notifications (teacher)
- Photo tasks (manual review) — частично

## Core invariants (`Implemented`)

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
  - пишутся domain events `TaskAutoCreditedWithoutProgress` (+ `RequiredTaskSkippedFlagSet` для required)
- Если задача заблокирована (`locked_until > now`) — Attempt **не создаётся**.

### Task revision switching

- `StudentTaskState.activeRevisionId` должен следовать за `Task.activeRevisionId` для “не засчитанных” задач.
- Если active revision изменилась, а задача ещё не в credited статусе, state сбрасывается в `not_started` и счётчики обнуляются.

## Progress & availability (`Implemented`)

### Snapshots model

- Availability считается на уровне section:
  - загружаются published units/edges/tasks,
  - используются `StudentTaskState.status` и факт attempts,
  - считается снапшот по каждому unit (`locked|available|in_progress|completed` + counters/percents).
- Снапшоты persisted в `student_unit_state` через upsert.
- Пересчёт вызывается:
  - в student views (например graph, unit view),
  - перед/внутри submit attempt (в транзакции),
  - после teacher actions (override/credit/unblock),
  - после publish/unpublish и graph update (через `LearningRecomputeService`).

### Counted vs solved

- `counted` статусы (completion): `correct | accepted | credited_without_progress | teacher_credited`
- `solved` статусы (solved%): `correct | accepted | teacher_credited`

### Completion gate

- Required gate: все required задачи должны быть counted.
- Optional gate: `optionalCountedTasks >= effectiveMinOptionalCountedTasksToComplete`.
- Guard против “нулевого гейта”: если в unit нет required задач и `minOptionalCountedTasksToComplete=0`, то effective threshold становится “все optional задачи”.

### Unit status

- `completed` если completion gate выполнен.
- иначе:
  - `available` если все prereq units `completed` или есть override
  - `in_progress` если unit открыт и есть хотя бы 1 attempt в задачах юнита
  - `locked` иначе

## Teacher actions (`Implemented`)

- Override open unit (навсегда): создаёт `unit_unlock_overrides` и пересчитывает section availability.
- Teacher credit task: переводит задачу в `teacher_credited` (counted+solved) и пересчитывает availability.
- Teacher unblock task: снимает `locked_until` (если было) и пересчитывает availability.

## Notifications (`Implemented`)

- В БД есть `NotificationType`:
  - `task_locked`, `required_task_skipped` — реально используются сейчас.
  - `photo_reviewed`, `unit_override_opened` — есть в enum, но пока не эмитятся кодом.

## Photo tasks (`Implemented` частично)

- Student:
  - presign upload + submit photo попытки
  - list submissions + presign view
- Teacher:
  - inbox + detail
  - accept/reject (domain events `PhotoAttemptAccepted|Rejected`)

## Tech debt / Planned

- Нормализация event payload: сейчас местами дублируются snake_case + camelCase ключи.
- Review: writes-on-read для `student_unit_state` (решить, оставляем или эволюционируем).
- Notification coverage для photo review и unit override (если нужно по продукту).

## Source links

- Availability snapshots:
  - `apps/api/src/learning/learning-availability.service.ts`
  - `apps/api/src/learning/learning-recompute.service.ts`
- Attempts + teacher actions:
  - `apps/api/src/learning/learning.service.ts`
- Photo tasks:
  - `apps/api/src/learning/photo-task.service.ts`
- Prisma models:
  - `apps/api/prisma/schema.prisma` (`StudentTaskState`, `StudentUnitState`, `Attempt`, `UnitUnlockOverride`, `PhotoTaskSubmission`, `Notification`)
