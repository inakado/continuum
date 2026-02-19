# generated/db-schema

Статус: `Draft` (ручной срез; источник истины — Prisma schema).

## Source of truth

- `apps/api/prisma/schema.prisma`

## Enums (`Implemented`)

- `Role`: `teacher | student`
- `ContentStatus`: `draft | published`
- `EventCategory`: `admin | learning | system`
- `TaskAnswerType`: `numeric | single_choice | multi_choice | photo`
- `StudentTaskStatus`: `not_started | in_progress | correct | pending_review | accepted | rejected | blocked | credited_without_progress | teacher_credited`
- `StudentUnitStatus`: `locked | available | in_progress | completed`
- `AttemptKind`: `numeric | single_choice | multi_choice | photo`
- `AttemptResult`: `correct | incorrect | pending_review | accepted | rejected`
- `PhotoTaskSubmissionStatus`: `submitted | accepted | rejected`
- `NotificationType`: `photo_reviewed | unit_override_opened | required_task_skipped | task_locked`

## Core models (`Implemented`)

### Identity & access

- `User` (`users`): `role`, `login`, `password_hash`, `is_active`, timestamps.
- `TeacherProfile` (`teacher_profile`): 1:1 с `User`.
- `StudentProfile` (`student_profile`): `lead_teacher_id` → `User`.
- `AuthSession` (`auth_sessions`): server-side session с `expires_at`, `revoked_at`, ip/user-agent метаданными.
- `AuthRefreshToken` (`auth_refresh_tokens`): refresh token hash, `used_at` + replacement link (rotation).

### Content

- `Course` (`courses`): `status`, `lock_duration_minutes`.
- `Section` (`sections`): `status`, `sort_order`, `course_id`.
- `Unit` (`units`): `status`, `sort_order`, `min_optional_counted_tasks_to_complete`, контент (`theory_rich_latex`, `method_rich_latex`), asset keys (`theory_pdf_asset_key`, `method_pdf_asset_key`), media json.
- `UnitGraphEdge` (`unit_graph_edges`): directed prereq edges внутри section.
- `UnitGraphLayout` (`unit_graph_layout`): позиции узлов графа (x/y) для UI.
- `Task` (`tasks`): `status`, `is_required`, `sort_order`, `active_revision_id`.
- `TaskRevision` (+ `TaskRevisionNumericPart` / `TaskRevisionChoice` / `TaskRevisionCorrectChoice`): ревизии задач и данные для auto-check.

### Learning / progress

- `StudentUnitState` (`student_unit_state`): снапшот прогресса по юниту (status + counters + percents + timestamps).
- `StudentTaskState` (`student_task_state`): статус по задаче, wrong attempts, `locked_until`, `required_skipped`, credited revision.
- `Attempt` (`attempts`): попытки по task_revision с `attempt_no` + результат.
- `UnitUnlockOverride` (`unit_unlock_overrides`): teacher override “открыть навсегда”.

### Manual review (photo)

- `PhotoTaskSubmission` (`photo_task_submissions`): asset keys, status, reviewer, timestamps, связка с `Attempt`.

### Audit / notifications

- `DomainEventLog` (`domain_event_log`): append-only события (`event_type`, `category`, actor, entity ref, payload json).
- `Notification` (`notifications`): уведомления (payload json, `read_at`).

## Notes (`Implemented`)

- Asset keys сейчас хранятся прямо в доменных сущностях (а не в универсальной таблице связей).
- `StudentUnitState` пересчитывается и persisted через вычисление снапшотов availability (см. `LearningAvailabilityService`).
