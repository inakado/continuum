# ER-MODEL.md
**Проект:** «Континуум» закрытая платформа обучения (Teachers + Students)  
**Назначение:** ER-модель для MVP (PostgreSQL + Prisma), включая PK/FK, ключевые уникальности/индексы.  
**Дата:** 2026-02-01

---

## 0) Нотация
- PK — Primary Key
- FK — Foreign Key
- UQ — Unique constraint
- IDX — Index
- Типы: `uuid`, `text`, `int`, `bool`, `timestamptz`, `jsonb`, `enum`

---

## 1) Identity & Access

### 1.1 `users`
- **id** uuid PK
- **role** enum(`teacher`,`student`) NOT NULL
- **login** text NOT NULL
- **password_hash** text NOT NULL
- **is_active** bool NOT NULL default true
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

UQ:
- UQ(users.login)

IDX:
- IDX(users.role)

---

### 1.2 `student_profile`
- **user_id** uuid PK, FK → users.id (ON DELETE CASCADE)
- **lead_teacher_id** uuid NOT NULL, FK → users.id
- **display_name** text NULL
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(student_profile.lead_teacher_id)

---

### 1.3 `auth_sessions` (если server-side sessions; при JWT можно не делать)
- **id** uuid PK
- **user_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **created_at** timestamptz NOT NULL
- **expires_at** timestamptz NOT NULL
- **revoked_at** timestamptz NULL

IDX:
- IDX(auth_sessions.user_id, auth_sessions.expires_at)

---

## 2) Content (Course → Section → Unit → Task)

### 2.1 `courses`
- **id** uuid PK
- **title** text NOT NULL
- **description** text NULL
- **status** enum(`draft`,`published`) NOT NULL
- **lock_duration_minutes** int NOT NULL  (глобальная блокировка X минут)
- **created_by** uuid NOT NULL, FK → users.id
- **updated_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(courses.status)

---

### 2.2 `sections`
- **id** uuid PK
- **course_id** uuid NOT NULL, FK → courses.id (ON DELETE CASCADE)
- **title** text NOT NULL
- **status** enum(`draft`,`published`) NOT NULL
- **position** int NOT NULL default 0
- **created_by** uuid NOT NULL, FK → users.id
- **updated_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(sections.course_id, sections.status)
- IDX(sections.course_id, sections.position)

---

### 2.3 `units`
- **id** uuid PK
- **section_id** uuid NOT NULL, FK → sections.id (ON DELETE CASCADE)
- **title** text NOT NULL
- **status** enum(`draft`,`published`) NOT NULL
- **min_counted_tasks** int NOT NULL  (абсолютное число)
- **theory_rich_latex** text NOT NULL
- **theory_pdf_asset_id** uuid NULL, FK → assets.id
- **created_by** uuid NOT NULL, FK → users.id
- **updated_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(units.section_id, units.status)

---

### 2.4 `unit_graph_edges`
> Граф юнитов внутри section. AND по входящим prereq.

- **id** uuid PK
- **section_id** uuid NOT NULL, FK → sections.id (ON DELETE CASCADE)
- **prereq_unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **created_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL

UQ:
- UQ(unit_graph_edges.section_id, unit_graph_edges.prereq_unit_id, unit_graph_edges.unit_id)

IDX:
- IDX(unit_graph_edges.section_id, unit_graph_edges.unit_id)
- IDX(unit_graph_edges.section_id, unit_graph_edges.prereq_unit_id)

---

## 3) Tasks & Revisions

### 3.1 `tasks`
> Task = контейнер ревизий. Статус публикации — на уровне Task.  
> Любая правка = новая ревизия (`task_revisions`), активная хранится здесь.

- **id** uuid PK
- **unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **status** enum(`draft`,`published`) NOT NULL
- **is_required** bool NOT NULL default false
- **active_revision_id** uuid NOT NULL, FK → task_revisions.id
- **created_by** uuid NOT NULL, FK → users.id
- **updated_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(tasks.unit_id, tasks.status)
- IDX(tasks.unit_id, tasks.is_required)

---

### 3.2 `task_revisions`
- **id** uuid PK
- **task_id** uuid NOT NULL, FK → tasks.id (ON DELETE CASCADE)
- **revision_no** int NOT NULL  (1..N)
- **answer_type** enum(`numeric`,`single_choice`,`multi_choice`,`photo`) NOT NULL
- **statement_lite** text NOT NULL
- **solution_rich_latex** text NULL
- **solution_pdf_asset_id** uuid NULL, FK → assets.id
- **created_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL

UQ:
- UQ(task_revisions.task_id, task_revisions.revision_no)

IDX:
- IDX(task_revisions.task_id, task_revisions.created_at)

---

### 3.3 `task_revision_numeric_parts`
> numeric всегда только через parts (даже одна часть).

- **id** uuid PK
- **task_revision_id** uuid NOT NULL, FK → task_revisions.id (ON DELETE CASCADE)
- **part_key** text NOT NULL
- **label_lite** text NULL
- **correct_value** text NOT NULL

UQ:
- UQ(task_revision_numeric_parts.task_revision_id, task_revision_numeric_parts.part_key)

IDX:
- IDX(task_revision_numeric_parts.task_revision_id)

---

### 3.4 `task_revision_choices`
> Варианты для single/multi. Перемешивание — на фронтенде.

- **id** uuid PK
- **task_revision_id** uuid NOT NULL, FK → task_revisions.id (ON DELETE CASCADE)
- **choice_key** text NOT NULL
- **content_lite** text NOT NULL

UQ:
- UQ(task_revision_choices.task_revision_id, task_revision_choices.choice_key)

IDX:
- IDX(task_revision_choices.task_revision_id)

---

### 3.5 `task_revision_correct_choices`
> Правильные ключи для single/multi.

- **id** uuid PK
- **task_revision_id** uuid NOT NULL, FK → task_revisions.id (ON DELETE CASCADE)
- **choice_key** text NOT NULL

UQ:
- UQ(task_revision_correct_choices.task_revision_id, task_revision_correct_choices.choice_key)

IDX:
- IDX(task_revision_correct_choices.task_revision_id)

---

## 4) Concepts

### 4.1 `concepts`
- **id** uuid PK
- **title** text NOT NULL
- **status** enum(`active`,`archived`) NOT NULL default `active`
- **created_by** uuid NOT NULL, FK → users.id
- **updated_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

UQ:
- UQ(concepts.title)

IDX:
- IDX(concepts.status)

---

### 4.2 `concept_aliases`
- **id** uuid PK
- **concept_id** uuid NOT NULL, FK → concepts.id (ON DELETE CASCADE)
- **alias** text NOT NULL

UQ:
- UQ(concept_aliases.concept_id, concept_aliases.alias)

IDX:
- IDX(concept_aliases.alias)

---

### 4.3 `unit_concepts`
- **unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **concept_id** uuid NOT NULL, FK → concepts.id (ON DELETE CASCADE)

PK:
- PK(unit_concepts.unit_id, unit_concepts.concept_id)

IDX:
- IDX(unit_concepts.concept_id)

---

## 5) Files & Assets (S3)

### 5.1 `assets`
- **id** uuid PK
- **kind** enum(`unit_attachment`,`task_attachment`,`attempt_photo`,`render_pdf`,`other`) NOT NULL
- **s3_key** text NOT NULL
- **mime_type** text NOT NULL
- **size_bytes** bigint NOT NULL
- **uploaded_by** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL

UQ:
- UQ(assets.s3_key)

IDX:
- IDX(assets.kind)
- IDX(assets.uploaded_by, assets.created_at)

---

### 5.2 `entity_assets`
> Универсальная привязка файлов к объектам.

- **id** uuid PK
- **asset_id** uuid NOT NULL, FK → assets.id (ON DELETE CASCADE)
- **entity_type** enum(`unit`,`task_revision`,`attempt`) NOT NULL
- **entity_id** uuid NOT NULL
- **slot** text NULL
- **created_at** timestamptz NOT NULL

IDX:
- IDX(entity_assets.entity_type, entity_assets.entity_id)
- IDX(entity_assets.asset_id)

---

## 6) Rendering (Rich LaTeX)

### 6.1 `render_jobs`
- **id** uuid PK
- **entity_type** enum(`unit_theory`,`task_solution`) NOT NULL
- **entity_id** uuid NOT NULL
- **revision_id** uuid NULL
- **status** enum(`idle`,`queued`,`rendering`,`ok`,`error`) NOT NULL
- **error_log** text NULL
- **pdf_asset_id** uuid NULL, FK → assets.id
- **created_at** timestamptz NOT NULL
- **updated_at** timestamptz NOT NULL

IDX:
- IDX(render_jobs.status, render_jobs.updated_at)
- IDX(render_jobs.entity_type, render_jobs.entity_id)

---

## 7) Learning (Progress, Attempts, Overrides)

### 7.1 `student_unit_state`
- **student_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **status** enum(`locked`,`available`,`in_progress`,`completed`) NOT NULL
- **override_opened** bool NOT NULL default false

- **counted_tasks** int NOT NULL default 0
- **solved_tasks** int NOT NULL default 0
- **total_tasks** int NOT NULL default 0
- **completion_percent** int NOT NULL default 0
- **solved_percent** int NOT NULL default 0

- **became_available_at** timestamptz NULL
- **started_at** timestamptz NULL
- **completed_at** timestamptz NULL
- **updated_at** timestamptz NOT NULL

PK:
- PK(student_unit_state.student_id, student_unit_state.unit_id)

IDX:
- IDX(student_unit_state.unit_id, student_unit_state.status)
- IDX(student_unit_state.student_id, student_unit_state.status)

---

### 7.2 `student_task_state`
> Текущее состояние задачи ученика + счётчики по активной ревизии.  
> Если задача засчитана — остаётся засчитанной при новых ревизиях.

- **student_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **task_id** uuid NOT NULL, FK → tasks.id (ON DELETE CASCADE)

- **status** enum(
  `not_started`,`in_progress`,
  `correct`,`pending_review`,`rejected`,
  `blocked`,
  `credited_without_progress`,
  `teacher_credited`
) NOT NULL

- **active_revision_id** uuid NOT NULL, FK → task_revisions.id
- **wrong_attempts** int NOT NULL default 0
- **locked_until** timestamptz NULL

- **required_skipped** bool NOT NULL default false

- **credited_revision_id** uuid NULL, FK → task_revisions.id
- **credited_at** timestamptz NULL
- **updated_at** timestamptz NOT NULL

PK:
- PK(student_task_state.student_id, student_task_state.task_id)

IDX:
- IDX(student_task_state.student_id, student_task_state.status)
- IDX(student_task_state.task_id, student_task_state.status)
- IDX(student_task_state.locked_until)

---

### 7.3 `attempts`
> История попыток. Для choice типов хранится только набор ключей (без порядка).  
> Attempt **не создаётся**, если задача заблокирована (`locked_until > now`).

- **id** uuid PK
- **student_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **task_id** uuid NOT NULL, FK → tasks.id (ON DELETE CASCADE)
- **task_revision_id** uuid NOT NULL, FK → task_revisions.id
- **attempt_no** int NOT NULL  (в рамках student+task_revision)
- **created_at** timestamptz NOT NULL

- **kind** enum(`numeric`,`single_choice`,`multi_choice`,`photo`) NOT NULL

- **numeric_answers** jsonb NULL
- **selected_choice_key** text NULL
- **selected_choice_keys** jsonb NULL

- **result** enum(`correct`,`incorrect`,`pending_review`,`accepted`,`rejected`) NOT NULL

UQ:
- UQ(attempts.student_id, attempts.task_revision_id, attempts.attempt_no)

IDX:
- IDX(attempts.student_id, attempts.created_at)
- IDX(attempts.task_id, attempts.created_at)
- IDX(attempts.task_revision_id, attempts.created_at)

---

### 7.4 `photo_review_decisions`
- **attempt_id** uuid PK, FK → attempts.id (ON DELETE CASCADE)
- **decided_by_teacher_id** uuid NOT NULL, FK → users.id
- **decision** enum(`accepted`,`rejected`) NOT NULL
- **comment** text NULL
- **decided_at** timestamptz NOT NULL

IDX:
- IDX(photo_review_decisions.decided_by_teacher_id, photo_review_decisions.decided_at)

---

### 7.5 `unit_unlock_overrides`
- **id** uuid PK
- **student_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **unit_id** uuid NOT NULL, FK → units.id (ON DELETE CASCADE)
- **opened_by_teacher_id** uuid NOT NULL, FK → users.id
- **created_at** timestamptz NOT NULL

UQ:
- UQ(unit_unlock_overrides.student_id, unit_unlock_overrides.unit_id)

IDX:
- IDX(unit_unlock_overrides.unit_id)

---

## 8) Notifications

### 8.1 `notifications`
- **id** uuid PK
- **recipient_user_id** uuid NOT NULL, FK → users.id (ON DELETE CASCADE)
- **type** enum(`photo_reviewed`,`unit_override_opened`,`required_task_skipped`,`task_locked`) NOT NULL
- **payload** jsonb NOT NULL
- **created_at** timestamptz NOT NULL
- **read_at** timestamptz NULL

IDX:
- IDX(notifications.recipient_user_id, notifications.read_at, notifications.created_at)

---

## 9) Audit / Domain Events Log

### 9.1 `domain_event_log`
- **id** uuid PK
- **category** enum(`admin`,`learning`,`system`) NOT NULL
- **event_type** text NOT NULL
- **actor_user_id** uuid NULL, FK → users.id
- **entity_type** text NOT NULL
- **entity_id** uuid NOT NULL
- **payload** jsonb NOT NULL
- **occurred_at** timestamptz NOT NULL

IDX:
- IDX(domain_event_log.occurred_at)
- IDX(domain_event_log.category, domain_event_log.occurred_at)
- IDX(domain_event_log.event_type, domain_event_log.occurred_at)
- IDX(domain_event_log.actor_user_id, domain_event_log.occurred_at)
- IDX(domain_event_log.entity_type, domain_event_log.entity_id)

---