# CONTENT

Статус: `Draft` (источник истины — код).

## Scope

- Course/Section/Unit/Task CRUD
- publish/unpublish + правила видимости
- unit graph (edges/layout)
- task revisions (active revision)
- LaTeX → PDF pipeline (unit theory/method, task solution)

## Visibility & Publishing (`Implemented`)

- Student видит только `published` контент по цепочке:
  - `Course.status=published`
  - `Section.status=published`
  - `Unit.status=published`
  - `Task.status=published`
- Publish имеет parent-gate:
  - нельзя publish `Section`, если `Course` draft
  - нельзя publish `Unit`, если `Section` draft
  - нельзя publish `Task`, если `Unit` draft
- Unpublish переводит сущность в `draft`. История attempts/events сохраняется.

### Publishing troubleshooting (`Implemented`)

- **Симптом:** `POST /api/teacher/units/<unitId>/publish` отвечает `409 Conflict`.
- **Причина:** в `ContentService.publishUnit` срабатывает parent-gate — unit нельзя publish, пока parent section в `draft` (`UNIT_PARENT_SECTION_DRAFT`).
- **Фикс:** сначала publish parent section и parent course, затем повторить publish unit.
- **Проверка:** publish unit возвращает `200`, `unit.status = published`.

## Content Entities (`Implemented`)

- `Course`: содержит `lockDurationMinutes`.
- `Section`: внутри course, хранит `description`, сортировку и unit graph.
- `Unit`:
  - контент: `theoryRichLatex`, `methodRichLatex`, `videosJson`, `attachmentsJson`
  - PDF keys: `theoryPdfAssetKey`, `methodPdfAssetKey`
  - completion gate: `minOptionalCountedTasksToComplete`
- `Task`:
  - `isRequired`
  - `activeRevisionId` указывает на `TaskRevision`
- `TaskRevision`:
  - statement/solution поля
  - auto-check данные: numeric parts / choices / correct choices

## Unit Graph (`Implemented`)

- Directed edges: `UnitGraphEdge` (A → B означает “A prerequisite для B”).
- Layout: `UnitGraphLayout` (x/y для UI).
- В teacher graph node payload приходит `createdAt`.
- Валидации на update:
  - self-loop запрещён
  - duplicate edges запрещены
  - cycles запрещены

## LaTeX → PDF Pipeline (`Implemented`)

### Compile (teacher)

- `POST /teacher/units/:id/latex/compile` → enqueue BullMQ job (`latex.compile`).
- `POST /teacher/tasks/:taskId/solution/latex/compile` → сохраняет `solutionRichLatex` в active revision и enqueue job.

### Job status / apply

- `GET /teacher/latex/jobs/:jobId`:
  - если `succeeded`, возвращает presigned URL на PDF;
  - если `failed`, возвращает `error` с полями:
    - `code`, `message`
    - `log`
    - `logTruncated`
    - `logLimitBytes`
    - `logSnippet` для legacy-совместимости.
- `POST /teacher/latex/jobs/:jobId/apply`:
  - для unit → пишет `Unit.theoryPdfAssetKey|methodPdfAssetKey`
  - для task solution → пишет `TaskRevision.solutionPdfAssetKey`
- Worker делает auto-apply через internal endpoint:
  - `POST /internal/latex/jobs/:jobId/apply` (`x-internal-token`).

### Stale protection

- Apply защищается от stale-ключей (`shouldApplyIncomingPdfKey`): старый результат не должен перезатереть новый.

### Presigned PDF preview (web) (`Implemented`)

- Presigned URL из `GET /teacher/latex/jobs/:jobId` и `.../pdf-presign` рендерятся во фронтенде через `PdfCanvasPreview`.
- Загрузка PDF по storage URL выполняется без credentials (`withCredentials = false`).

## Source Links

- Prisma models:
  - `apps/api/prisma/schema.prisma`
- Content CRUD + graph:
  - `apps/api/src/content/content.service.ts`
  - `apps/api/src/content/content-write.service.ts`
  - `apps/api/src/content/content-graph.service.ts`
  - `apps/api/src/content/task-revision-payload.service.ts`
  - `apps/api/src/content/teacher-*.controller.ts`
- LaTeX queue + apply:
  - `apps/api/src/content/latex-compile-queue.service.ts`
  - `apps/api/src/content/teacher-latex.controller.ts`
  - `apps/api/src/content/internal-latex.controller.ts`
  - `apps/api/src/content/unit-pdf.constants.ts`
