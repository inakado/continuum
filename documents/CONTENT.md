# CONTENT

Статус: `Draft` (источник истины — код).

## Scope

- Course/Section/Unit/Task CRUD
- publish/unpublish + правила видимости
- unit graph (edges/layout)
- task revisions (active revision)
- LaTeX → PDF pipeline (unit theory/method, task solution)

## Visibility & publishing (`Implemented`)

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

## Content entities (`Implemented`)

- `Course`: содержит `lockDurationMinutes` (используется в Learning для таймера блокировки 3+3).
- `Section`: внутри course, хранит сортировку и unit graph.
- `Unit`:
  - контент: `theoryRichLatex`, `methodRichLatex`, `videosJson`, `attachmentsJson`
  - PDF keys: `theoryPdfAssetKey`, `methodPdfAssetKey`
  - completion gate: `minOptionalCountedTasksToComplete`
- `Task`:
  - `isRequired` (required gate в Learning)
  - `activeRevisionId` указывает на `TaskRevision`
- `TaskRevision`:
  - statement/solution поля
  - auto-check данные: numeric parts / choices / correct choices

## Unit graph (`Implemented`)

- Directed edges: `UnitGraphEdge` (A → B означает “A prerequisite для B”).
- Layout: `UnitGraphLayout` (x/y для UI).
- Валидации на update:
  - self-loop запрещён
  - duplicate edges запрещены
  - cycles запрещены

## LaTeX → PDF pipeline (`Implemented`)

### Compile (teacher)

- `POST /teacher/units/:id/latex/compile` → enqueue BullMQ job (`latex.compile`).
- `POST /teacher/tasks/:taskId/solution/latex/compile` → сохраняет `solutionRichLatex` в active revision и enqueue job.

### Job status / apply

- `GET /teacher/latex/jobs/:jobId`:
  - если `succeeded`, возвращает presigned URL на PDF.
- `POST /teacher/latex/jobs/:jobId/apply`:
  - для unit → пишет `Unit.theoryPdfAssetKey|methodPdfAssetKey`
  - для task solution → пишет `TaskRevision.solutionPdfAssetKey`
- Worker также делает auto-apply через internal endpoint:
  - `POST /internal/latex/jobs/:jobId/apply` (auth: `x-internal-token`)

### Stale protection

- Apply защищается от “stale” ключей (`shouldApplyIncomingPdfKey`): старый результат не должен перезатереть новый.

## Planned / TODO

- Унификация assets model (сейчас ключи в доменных сущностях; “entity_assets” пока planned).
- Документирование формата assetKey (timestamp + randomness) как контракта, если начнём опираться на него вне `shouldApplyIncomingPdfKey`.

## Source links

- Prisma models:
  - `apps/api/prisma/schema.prisma`
- Content CRUD + graph:
  - `apps/api/src/content/content.service.ts`
  - `apps/api/src/content/teacher-*.controller.ts`
- LaTeX queue + apply:
  - `apps/api/src/content/latex-compile-queue.service.ts`
  - `apps/api/src/content/teacher-latex.controller.ts`
  - `apps/api/src/content/internal-latex.controller.ts`
  - `apps/api/src/content/unit-pdf.constants.ts`
