# HANDLER-MAP.md
**Проект:** «Континуум» закрытая платформа обучения (Teachers + Students)  
**Назначение:** карта обработчиков команд/событий/джобов (API → domain → events → jobs/projections).  
**Дата:** 2026-02-01

---

## 0) Сквозные принципы обработки

### P1 — Domain events + audit log
- После успешной команды пишем событие в `domain_event_log` (см. DOMAIN-EVENTS.md).
- Категории событий: `admin | learning | system`.

### P2 — Unlock/Progress консистентно и сразу (DEC-11)
- Для интерактивных путей (attempts, photo accepted, teacher credit, override):
  - обновляем state/метрики в транзакции,
  - инкрементально пересчитываем availability “вперёд” по section-графу,
  - эмитим `UnitBecameAvailableForStudent` при переходе в available (“reach”).

### P3 — Rendering отдельно
- Rich LaTeX компиляция через BullMQ + отдельный worker (Tectonic). API не блокируется.

### P4 — Projections eventual
- Search/Analytics/Notifications можно строить обработчиками событий (event handlers).

---

## 1) API Command Handlers (вход из UI)

> Команды и их обработчики в NestJS Application Layer.
> В скобках указан BC.

### 1.1 Identity & Access (BC1)
- **AuthenticateHandler**
  - события: `UserAuthenticated (system)`
- **LogoutHandler**
  - события: `UserLoggedOut (system)`
- **ChangeOwnPasswordHandler**
  - события: `UserPasswordChanged (admin|learning)`
- **CreateTeacherHandler**
  - события: `TeacherCreated (admin)`
- **CreateStudentHandler**
  - события: `StudentCreated (admin)`, `LeadTeacherAssignedToStudent (admin)`
- **ResetStudentPasswordHandler**
  - события: `StudentPasswordReset (admin)`
- **ReassignLeadTeacherHandler**
  - эффект: смена ведущего учителя, прогресс сохраняется
  - события: `LeadTeacherReassignedForStudent (admin)`

---

### 1.2 Content (BC2)
- **CreateCourseHandler / UpdateCourseHandler**
  - события: `CourseCreated` / `CourseUpdated`
- **PublishCourseHandler / UnpublishCourseHandler**
  - события: `CoursePublished` / `CourseUnpublished`
  - orchestration: batch recompute (см. jobs)
- **CreateSectionHandler / UpdateSectionHandler**
  - события: `SectionCreated` / `SectionUpdated`
- **PublishSectionHandler / UnpublishSectionHandler**
  - события: `SectionPublished` / `SectionUnpublished`
  - orchestration: batch recompute
- **CreateUnitHandler / UpdateUnitHandler**
  - включает: `min_counted_tasks`, media, concepts, theory source
  - события: `UnitCreated` / `UnitUpdated`
- **PublishUnitHandler / UnpublishUnitHandler**
  - события: `UnitPublished` / `UnitUnpublished`
  - orchestration: batch recompute
- **SetUnitGraphEdgesHandler**
  - события: `UnitGraphUpdated` (или edge add/remove)
  - orchestration: batch recompute availability
- **CreateTaskHandler**
  - эффект: Task + initial TaskRevision(active)
  - события: `TaskCreated`
- **UpdateTaskHandler**
  - эффект: новая TaskRevision (любая правка), активируем её
  - события: `TaskRevised`
- **PublishTaskHandler / UnpublishTaskHandler**
  - события: `TaskPublished` / `TaskUnpublished`
  - orchestration: batch recompute
- **SetTaskRequiredHandler**
  - события: `TaskRequiredFlagChanged`
- **UpsertConceptHandler**
  - события: `ConceptCreated` / `ConceptUpdated`
- **AttachConceptToUnitHandler / DetachConceptFromUnitHandler**
  - события: `ConceptLinkedToUnit` / `ConceptUnlinkedFromUnit`

---

### 1.3 Files & Assets (BC5)
- **CreateUploadSessionHandler**
  - события: `UploadSessionCreated (system)`
- **FinalizeUploadHandler**
  - события: `AssetUploaded (system)`
- **AttachAssetToEntityHandler**
  - события: `AssetAttachedToEntity (admin|system)`
- **GetAssetDownloadUrlHandler**
  - проверяет права → выдаёт signed URL

---

### 1.4 Rendering (BC6) — постановка задач
- **RequestRenderUnitTheoryHandler**
  - создаёт RenderJob(status=queued)
  - события: `RenderRequested`, `RenderJobQueued`
- **RequestRenderTaskSolutionHandler**
  - события: `RenderRequested`, `RenderJobQueued`

---

### 1.5 Learning (BC3) — core интерактивные команды
- **SubmitAttemptNumericHandler**
- **SubmitAttemptSingleChoiceHandler**
- **SubmitAttemptMultiChoiceHandler**

Общий pipeline обработки:
1) **Guard**: если `student_task_state.locked_until > now` → отказ (Attempt НЕ создаём).
2) Создать `attempt` с `task_revision_id = tasks.active_revision_id`.
3) Оценить ответ:
   - numeric: нормализация, проверка всех частей
   - single/multi: проверка по ключам (порядок вариантов не хранится)
4) Записать `AttemptSubmitted`.
5) Если correct:
   - обновить `student_task_state` → `correct`
   - инкремент `solved_tasks` и `counted_tasks`
   - событие `AttemptEvaluatedCorrect`
6) Если incorrect:
   - увеличить `wrong_attempts` по активной ревизии
   - событие `AttemptEvaluatedIncorrect`
   - если это 3-я ошибка → выставить `locked_until`, событие `TaskLockedForStudent`
   - если это 6-я ошибка → `credited_without_progress`, событие `TaskAutoCreditedWithoutProgress`
     - если required → `required_skipped=true`, событие `RequiredTaskSkippedFlagSet`
     - показать решение/ответ (UI условие)
7) Если это первый Attempt в юните → `student_unit_state.status = in_progress`, событие `UnitProgressStartedForStudent`.
8) Пересчитать `student_unit_state` метрики (counted/solved/percents).
9) Если условия выполнены → `student_unit_state.status = completed`, событие `UnitCompletedByStudent`.
10) Инкрементально пересчитать availability в section-графе “вперёд”.
    - при переходе locked→available: событие `UnitBecameAvailableForStudent` (reach).

---

### 1.6 Learning (BC3) — teacher actions
- **OverrideOpenUnitHandler**
  - эффект: создать `unit_unlock_overrides`, `student_unit_state.override_opened=true`, установить `available`
  - события: `UnitOverrideOpenedForStudent`
  - если впервые стал available → `UnitBecameAvailableForStudent`

- **TeacherCreditTaskHandler**
  - эффект: выставить `student_task_state.status = teacher_credited` (counted+solved)
  - можно в любой момент
  - события: `TaskTeacherCreditedForStudent`
  - orchestration: пересчёт метрик юнита + completion + availability

---

### 1.7 Manual Review (BC4)
- **SubmitPhotoAttemptHandler** (Student)
  - создаёт Attempt(result=`pending_review`)
  - события: `PhotoAttemptSubmitted`
- **AcceptPhotoAttemptHandler** (Lead Teacher)
  - проверка: actor == lead_teacher_id
  - эффект: attempt accepted; task становится solved+counted
  - события: `PhotoAttemptAccepted`
  - orchestration: пересчёт метрик + completion + availability
- **RejectPhotoAttemptHandler** (Lead Teacher)
  - эффект: attempt rejected; ошибок не добавлять
  - события: `PhotoAttemptRejected`

---

### 1.8 Search / Analytics / Audit (read handlers)
- **SearchUnitsByConceptStudentHandler**
  - published-only + статусы доступности (из Learning state)
- **SearchUnitsByConceptTeacherHandler**
  - includes draft
- **GetUnitAnalyticsHandler / GetTaskAnalyticsHandler**
- **QueryDomainEventsHandler** (audit)
  - фильтры: category, type, actor, entity, period

---

## 2) Event Handlers (оркестрация / проекции)

> Эти обработчики подписываются на доменные события (внутрипроцессный bus или polling из domain_event_log).

### 2.1 Notifications (BC?)
- **OnTaskLockedForStudent** → создать notification `task_locked`
- **OnPhotoAttemptAccepted/Rejected** → notification ученику `photo_reviewed`
- **OnUnitOverrideOpenedForStudent** → notification ученику `unit_override_opened`
- **OnRequiredTaskSkippedFlagSet** → notification учителю `required_task_skipped`

### 2.2 Search projections (BC7)
- **OnConceptCreated/Updated** → обновить индекс понятий
- **OnConceptLinkedToUnit/UnlinkedFromUnit** → обновить связи
- **OnCourse/Section/Unit/Task Published/Unpublished** → обновить видимость в выдаче
- (опционально) **OnUnitBecameAvailableForStudent** → ускорение выдачи статуса доступности

### 2.3 Analytics projections (BC8)
- **OnUnitBecameAvailableForStudent** → reach count
- **OnAttemptEvaluatedIncorrect/Correct** → wrong counts, first-try, avg attempts
- **OnTaskAutoCreditedWithoutProgress** → skip stats (credited), required_skipped stats
- **OnPhotoAttemptSubmitted/Rejected/Accepted** → pending/rejected/accepted stats
- **OnTaskTeacherCreditedForStudent** → “вернул в solved” stats
- **OnUnitCompletedByStudent** → completion metrics

### 2.4 Audit normalization (BC9)
- **OnAnyDomainEvent** → (если нужно) нормализация category/type/payload

---

## 3) Job Handlers (workers)

### 3.1 Rendering worker (BullMQ queue: `render`)
- **RenderJobWorkerHandler**
  1) pick job → `RenderJobStarted`
  2) compile Tectonic в sandbox
  3) upload PDF → `assets`
  4) mark job ok → `RenderJobSucceeded`
  5) attach pdf_asset_id к unit/task_revision → `RenderResultAttachedToEntity`
  6) on error → `RenderJobFailed` + `render_jobs.error_log`

---

### 3.2 Batch recompute worker (BullMQ queue: `batch`)
> Причина: publish/unpublish и graph updates требуют массового пересчёта,
> потому что unpublish = “объекта нет и не учитывается”.

- **RebuildStudentProgressForScopeJob**
  - вход: `{ scope_type, scope_id }`
  - действие:
    - определить затронутых учеников
    - пересчитать `total_tasks`, `counted_tasks`, `solved_tasks`, проценты
    - пересчитать unit availability по section-графам
  - события:
    - `StudentProgressRecomputedDueToUnpublish`
    - `UnitAvailabilityRecomputedDueToPublishChange`

- **RebuildAvailabilityAfterGraphUpdateJob**
  - вход: `{ section_id }`
  - действие:
    - пересчитать unlock по section-графу для учеников, у кого есть доступ к курсу/разделу
  - событие:
    - `UnitAvailabilityRecomputedDueToGraphChange`

---

## 4) Контуры данных (что читают обработчики)

### SubmitAttempt* handlers читают:
- `tasks.active_revision_id`
- `task_revisions` + numeric_parts/choices/correct_choices
- `student_task_state` (wrong_attempts, locked_until, credited flags)
- `student_unit_state` (status, counters)
- content visibility (только published контент у ученика)

### Photo review handlers читают:
- `student_profile.lead_teacher_id` (для проверки прав)
- `attempts` + `entity_assets` (фото)
- `student_task_state` / `student_unit_state`

### Rendering worker читает:
- `render_jobs`
- `units.theory_rich_latex` или `task_revisions.solution_rich_latex`
- пишет `assets`, обновляет `render_jobs`

---

## 5) Mini-gap-check (для реализации)

1) Заблокированная задача: **Attempt не создаётся**, только ошибка-ответ UI.
2) Shuffle вариантов: backend хранит только выбранные ключи, порядок не хранится.
3) Reach (“дошли”): событие `UnitBecameAvailableForStudent` — при первом переходе в `available`.
4) Unpublish: UI ученика не видит объект, статистика пересчитывается batch job, audit/attempts остаются.