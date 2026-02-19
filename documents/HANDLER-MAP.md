# HANDLER-MAP
**Проект:** «Континуум»  
**Назначение:** карта реальных обработчиков (HTTP controllers → services → БД/очереди → domain events).  

Статус: `Draft` (источник истины — код).

## 0) Принципы (`Implemented`)

- Source of truth: код (`apps/api/src/**`, `apps/worker/src/**`).
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
- `teacher/section-graph` → `ContentService.updateSectionGraph()` + event `UnitGraphUpdated`
- `teacher/latex/*` → постановка compile job в очередь `latex.compile`

### Student endpoints (read-only published content)

- `student/courses`, `student/sections`, `student/units` → published-only queries.

Источник: `apps/api/src/content/*`.

## 3) Learning: attempts / progress / availability (BC3) (`Implemented`)

- Auto-check submit: `LearningService.submitAttempt()`:
  - проверка доступности юнита для student (`LearningAvailabilityService.recomputeSectionAvailability()`),
  - создание `Attempt`,
  - обновление `StudentTaskState`,
  - события: `AttemptSubmitted`, `AttemptEvaluatedCorrect|Incorrect`, `TaskLockedForStudent`, `TaskAutoCreditedWithoutProgress`, `RequiredTaskSkippedFlagSet`.

- Unit status/metrics для student UI вычисляются через `LearningAvailabilityService` (снапшоты по section) и persisted в `student_unit_state`.

Источник: `apps/api/src/learning/learning.service.ts`, `apps/api/src/learning/learning-availability.service.ts`.

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

Источник: `apps/api/src/learning/photo-task.service.ts` + соответствующие controllers.

## 5) Rendering / LaTeX (worker + internal apply) (`Implemented`)

- API queue:
  - `LatexCompileQueueService` добавляет jobs в BullMQ.
- Worker:
  - компилирует через `tectonic`,
  - загружает PDF в object storage,
  - вызывает `POST /internal/latex/jobs/:jobId/apply` с `x-internal-token`.
- API internal apply:
  - применяет `Unit.theoryPdfAssetKey|methodPdfAssetKey` или `TaskRevision.solutionPdfAssetKey`,
  - защищается от stale-результатов,
  - пишет event `TaskSolutionPdfCompiled` (для task solution).

Источник: `apps/api/src/content/internal-latex.controller.ts`, `apps/worker/src/latex/*`.

## 6) Audit log (read) (`Implemented`)

- `EventsLogService.list()` читает `domain_event_log` по фильтрам.

Источник: `apps/api/src/events/events-log.service.ts`, `apps/api/src/events/teacher-events.controller.ts`.
