# DOMAIN-EVENTS.md
**Проект:** «Континуум» закрытая платформа обучения (Teachers + Students)  
**Назначение:** единый каталог доменных событий (фактов домена) для audit log, проекций (analytics/search), отладки.  
**Принцип:** событие = “факт в домене”, не “insert/update”.  
**Категории:** `admin | learning | system`  


---

## 0) Общие правила

1) **Событие пишется после успешного выполнения команды** (обычно в той же транзакции).
2) У события есть минимум:
   - `event_type` (строка)
   - `category` (admin|learning|system)
   - `actor_user_id` (nullable)
   - `entity_ref` (`entity_type`, `entity_id`)
   - `occurred_at`
   - `payload` (jsonb, минимальный)
3) События используются:
   - для audit log (чтение/фильтрация),
   - для инкрементальных проекций (analytics/search),
   - для batch/диагностики пересчётов (publish/unpublish/graph updates).

---

## 1) Identity & Access (BC1)

### Admin
- **TeacherCreated** (admin)
- **TeacherUpdated** (admin)
- **StudentCreated** (admin)
- **StudentPasswordReset** (admin)
- **LeadTeacherAssignedToStudent** (admin) — первичное назначение
- **LeadTeacherReassignedForStudent** (admin) — передача ученика другому ведущему

### System
- **UserAuthenticated** (system)
- **UserLoggedOut** (system)

### Admin / Learning
- **UserPasswordChanged** (admin|learning) — по роли/контексту

---

## 2) Content Authoring & Publishing (BC2)

### Courses
- **CourseCreated** (admin)
- **CourseUpdated** (admin)
- **CoursePublished** (admin)
- **CourseUnpublished** (admin)

### Sections
- **SectionCreated** (admin)
- **SectionUpdated** (admin)
- **SectionPublished** (admin)
- **SectionUnpublished** (admin)

### Units
- **UnitCreated** (admin)
- **UnitUpdated** (admin)
- **UnitPublished** (admin)
- **UnitUnpublished** (admin)

### Unit Graph (внутри section)
- **UnitGraphEdgeAdded** (admin)
- **UnitGraphEdgeRemoved** (admin)
- **UnitGraphUpdated** (admin) — если применяем команду “set edges” пачкой

### Tasks / Revisions
- **TaskCreated** (admin)
- **TaskPublished** (admin)
- **TaskUnpublished** (admin)
- **TaskRevised** (admin) — любое изменение → новая ревизия, активируется новая
- **TaskRequiredFlagChanged** (admin)

### Concepts
- **ConceptCreated** (admin)
- **ConceptUpdated** (admin)
- **ConceptArchived** (admin) — на будущее
- **ConceptLinkedToUnit** (admin)
- **ConceptUnlinkedFromUnit** (admin)

---

## 3) Learning Progress & Unlock (BC3)

### Unit availability / reach
- **UnitBecameAvailableForStudent** (system)
  - смысл: юнит впервые перешёл в `available` для ученика (это и есть метрика “дошли”)
  - payload: `{ student_id, unit_id, reason: "unlock"|"override"|"recompute" }`

### Unit state transitions
- **UnitProgressStartedForStudent** (learning)
  - смысл: первый Attempt внутри юнита (строгий триггер)
  - payload: `{ student_id, unit_id, first_attempt_id }`

- **UnitCompletedByStudent** (learning|system)
  - смысл: выполнены required-гейты + min_counted_tasks (counted)
  - payload: `{ student_id, unit_id, counted_tasks, solved_tasks, total_tasks }`

### Attempts (auto-check: numeric/single/multi)
- **AttemptSubmitted** (learning)
  - payload: `{ attempt_id, student_id, task_id, task_revision_id, kind }`
- **AttemptEvaluatedCorrect** (learning)
  - payload: `{ attempt_id, task_id, task_revision_id }`
- **AttemptEvaluatedIncorrect** (learning)
  - payload: `{ attempt_id, task_id, task_revision_id, wrong_attempts_after }`

### Locks / auto-credit (3+3)
- **TaskLockedForStudent** (system)
  - смысл: 3-я неправильная попытка → `locked_until`
  - payload: `{ student_id, task_id, task_revision_id, locked_until }`

- **TaskAutoCreditedWithoutProgress** (system)
  - смысл: 6-я неправильная попытка → `credited_without_progress` + показ решения/ответа
  - payload: `{ student_id, task_id, task_revision_id, required: bool }`

- **RequiredTaskSkippedFlagSet** (system)
  - смысл: required-задача была auto-credited → `required_skipped=true`
  - payload: `{ student_id, task_id, task_revision_id }`

### Teacher actions on progress
- **UnitOverrideOpenedForStudent** (admin)
  - payload: `{ teacher_id, student_id, unit_id }`

- **TaskTeacherCreditedForStudent** (admin)
  - смысл: учитель зачёл задачу так, чтобы она учитывалась в solved% (teacher_credited)
  - payload: `{ teacher_id, student_id, task_id, task_revision_id, from_status }`

---

## 4) Manual Review (Photo) (BC4)

- **PhotoAttemptSubmitted** (learning)
  - payload: `{ attempt_id, student_id, task_id, task_revision_id, asset_ids[] }`

- **PhotoAttemptAccepted** (admin)
  - payload: `{ attempt_id, decided_by_teacher_id, student_id, task_id, task_revision_id, comment? }`

- **PhotoAttemptRejected** (admin)
  - payload: `{ attempt_id, decided_by_teacher_id, student_id, task_id, task_revision_id, comment? }`

---

## 5) Files & Assets (BC5)

- **UploadSessionCreated** (system)
- **AssetUploaded** (system)
  - payload: `{ asset_id, kind, s3_key, mime_type, size_bytes, uploaded_by }`

- **AssetAttachedToEntity** (admin|system)
  - payload: `{ asset_id, entity_type, entity_id, slot }`

> `AssetDeleted` — только если вводим удаление ассетов. Сейчас не фиксируем как обязательное событие.

---

## 6) Rendering (Rich LaTeX) (BC6)

- **RenderRequested** (admin|system)
  - payload: `{ entity_type: "unit_theory"|"task_solution", entity_id, revision_id? }`

- **RenderJobQueued** (system)
  - payload: `{ render_job_id, entity_type, entity_id, revision_id? }`

- **RenderJobStarted** (system)
  - payload: `{ render_job_id }`

- **RenderJobSucceeded** (system)
  - payload: `{ render_job_id, pdf_asset_id }`

- **RenderJobFailed** (system)
  - payload: `{ render_job_id, error_summary }`

- **RenderResultAttachedToEntity** (system)
  - payload: `{ entity_type, entity_id, pdf_asset_id }`

---

## 7) Analytics & Search projections (BC8/BC7) — system events

> Это не “факты домена”, а “факты проекций”. Логируем только если нужно для диагностики.

- **AnalyticsProjectionUpdated** (system)
  - payload: `{ projection_name, scope, cursor? }`

- **SearchIndexUpdated** (system)
  - payload: `{ index_name, scope, cursor? }`

---

## 8) Visibility / Recompute effects (system)

> Нужны из-за правила: unpublish = “объекта нет и он не учитывается”, требуется пересчёт.

- **StudentProgressRecomputedDueToUnpublish** (system)
  - payload: `{ scope_type, scope_id, affected_students_count }`

- **UnitAvailabilityRecomputedDueToPublishChange** (system)
  - payload: `{ scope_type, scope_id, affected_students_count }`

- **UnitAvailabilityRecomputedDueToGraphChange** (system)
  - payload: `{ section_id, affected_students_count }`

---

## 9) Mini-gap-check (для реализации)

1) Событие **UnitBecameAvailableForStudent** пишем **однократно** на ученика/юнит при первом переходе в available (reach).
2) `TaskLockedForStudent` пишем, `TaskUnlockedForStudent` не обязателен (unlock вычисляем по `locked_until`).
3) `AttemptSubmitted` не создаётся, если задача заблокирована (`locked_until > now`) — это важно для честной статистики попыток.