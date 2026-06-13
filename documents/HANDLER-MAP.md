# HANDLER-MAP
**Проект:** «Континуум»  
**Назначение:** карта реальных обработчиков (HTTP controllers → services → БД/очереди → domain events).  

Статус: `Draft` (источник истины — код).

Полный route inventory генерируется отдельно в `documents/generated/api-routes.md`.
Этот документ фиксирует смысловые цепочки `controller → service → БД/очередь → domain event/side effect`, а не полный список endpoints.

## 0) Принципы (`Implemented`)

- Source of truth: код (`apps/api/src/**`, `apps/worker/src/**`).
- Для механического списка HTTP method + path использовать `documents/generated/api-routes.md`.
- После успешных write-операций часто пишется событие в `domain_event_log` через `EventsLogService`.
- “Published-only” доступ для student реализован через фильтры Prisma-запросов (проверка `status` по цепочке).

## 1) Auth (BC1-ish) (`Implemented`)

- `POST /auth/login` → `AuthService.login()` → cookies (access+refresh).
- `POST /auth/refresh` → `AuthService.refresh()` → refresh rotation + session family revoke на reuse.
- `POST /auth/logout` → `AuthService.logoutByRefreshToken()` → revoke session family.
- `GET /auth/me` → читает профили teacher/student.

Источник: `apps/api/src/auth/*`.

## 2) Content (BC2) (`Implemented`)

### Teacher endpoints (write + events)

- `teacher/courses` → `ContentService` + events `Course*`
- `teacher/sections` → `ContentService` + events `Section*`
- `teacher/units` → `ContentService` + events `Unit*`
- `teacher/tasks` → `ContentService` + events `Task*` (+ statement image presign)
- `GET|PUT /teacher/sections/:id/graph` → `ContentService.updateSectionGraph()` + event `UnitGraphUpdated`
- `teacher/latex/*` → постановка compile job в очередь `latex.compile`

### Student endpoints (read-only published content)

- `GET /courses`, `GET /courses/:id`, `GET /sections/:id`, `GET /sections/:id/graph` → published-only queries with student access checks.
- `GET /units/:id` живёт в learning-контуре, потому что должен учитывать availability/progress и возвращать `UNIT_LOCKED` для закрытых юнитов.

Источник: `apps/api/src/content/*`.

## 3) Learning: attempts / progress / availability (BC3) (`Implemented`)

- Auto-check submit: `LearningService.submitAttempt()`:
  - write-path делегируется в `LearningAttemptsWriteService` (фасад в `LearningService` сохранён для совместимости),
  - проверка доступности юнита для student (`LearningAvailabilityService.recomputeSectionAvailability()`),
  - создание `Attempt`,
  - обновление `StudentTaskState`,
  - события: `AttemptSubmitted`, `AttemptEvaluatedCorrect|Incorrect`, `TaskLockedForStudent`, `TaskAutoCreditedWithoutProgress`, `RequiredTaskSkippedFlagSet`.
- Teacher actions: `LearningService.overrideOpenSection|overrideOpenUnit|creditTask|unblockTask()`:
  - write-path делегируется в `LearningTeacherActionsService`,
  - события: `SectionOverrideOpenedForStudent`, `UnitOverrideOpenedForStudent`, `TaskTeacherCreditedForStudent`, `TaskUnblockedForStudent`.

- Unit status/metrics для student UI вычисляются через `LearningAvailabilityService` (снапшоты по section) и persisted в `student_unit_state`.
- Student dashboard:
  - `GET /student/dashboard` → aggregated read-model для `/student`.
- Teacher student management:
  - `GET|POST /teacher/students`, `GET|PATCH|DELETE /teacher/students/:id`
  - `POST /teacher/students/:id/reset-password`
  - `PATCH /teacher/students/:id/transfer`
  - `GET|PATCH /teacher/me`, `POST /teacher/me/change-password`
  - `GET|POST /teacher/teachers`, `DELETE /teacher/teachers/:id`

Источник:
- `apps/api/src/learning/learning.service.ts` (facade)
- `apps/api/src/learning/learning-attempts-write.service.ts`
- `apps/api/src/learning/learning-teacher-actions.service.ts`
- `apps/api/src/learning/learning-availability.service.ts`
- `apps/api/src/learning/learning-audit-log.service.ts`

## 4) Manual review (photo) (BC4) (`Implemented`)

- Student:
  - `POST /student/tasks/:taskId/photo/presign-upload` → presigned PUT URLs
  - `POST /student/tasks/:taskId/photo/submit` → создаёт submission + attempt, event `PhotoAttemptSubmitted`
  - `GET /student/tasks/:taskId/photo/submissions` → список
  - `GET /student/tasks/:taskId/photo/presign-view` → presigned GET URL (с проверками)

- Teacher (lead teacher only):
  - `GET /teacher/photo-submissions` → inbox
  - `GET /teacher/photo-submissions/:submissionId` → detail
  - review actions (accept/reject) → events `PhotoAttemptAccepted|Rejected`

Источник:
- `apps/api/src/learning/photo-task.service.ts` (facade)
- `apps/api/src/learning/photo-task-read.service.ts` (read-path: inbox/detail/queue/list/presign-view)
- `apps/api/src/learning/photo-task-review-write.service.ts` (write-path: presign-upload/submit/accept/reject)
- соответствующие controllers в `apps/api/src/learning/*`.

## 5) Rendering / LaTeX (worker + internal apply) (`Implemented`)

- API queue:
  - `LatexCompileQueueService` добавляет jobs в BullMQ.
  - `POST /teacher/debug/latex/compile-and-upload` не компилирует локально и только ставит debug job в `latex.compile`.
- Worker:
  - компилирует через `pdflatex`,
  - для TikZ HTML assets использует `pdflatex --output-format=dvi -> dvisvgm`,
  - для unit загружает `PDF + HTML + SVG assets`, для `task_solution` загружает `HTML + SVG assets`,
  - вызывает `POST /internal/latex/jobs/:jobId/apply` с `x-internal-token`.
- API internal apply:
  - применяет `Unit.theoryPdfAssetKey|theoryHtmlAssetKey|theoryHtmlAssetsJson` или `Unit.methodPdfAssetKey|methodHtmlAssetKey|methodHtmlAssetsJson`,
  - для `task_solution` применяет `TaskRevision.solutionHtmlAssetKey|solutionHtmlAssetsJson`,
  - debug jobs не применяются (`LATEX_JOB_APPLY_UNSUPPORTED`),
  - защищается от stale-результатов,
  - пишет event `TaskSolutionHtmlCompiled` (для task solution).

- Teacher rendered-content read path:
  - `GET /teacher/units/:id/rendered-content?target=theory|method`
  - `GET /teacher/tasks/:taskId/solution/rendered-content`
- Student rendered-content read path:
  - `GET /units/:id/rendered-content?target=theory|method`
  - `GET /student/tasks/:taskId/solution/rendered-content`

Источник: `apps/api/src/content/internal-latex.controller.ts`, `apps/worker/src/latex/*`.

## 6) Audit log (read) (`Implemented`)

- `EventsLogService.list()` читает `domain_event_log` по фильтрам.

Источник: `apps/api/src/events/events-log.service.ts`, `apps/api/src/events/teacher-events.controller.ts`.
