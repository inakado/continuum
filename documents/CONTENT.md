# CONTENT

Статус: `Draft` (источник истины — код).

## Scope

- Course/Section/Unit/Task CRUD
- publish/unpublish + правила видимости
- unit graph (edges/layout)
- task revisions (active revision)
- LaTeX → PDF pipeline (unit theory/method, task solution)
- LaTeX → HTML pipeline для student unit content (unit theory/method)

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
  - render asset keys: `theoryPdfAssetKey`, `theoryHtmlAssetKey`, `methodPdfAssetKey`, `methodHtmlAssetKey`
  - HTML asset manifests: `theoryHtmlAssetsJson`, `methodHtmlAssetsJson`
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

### Compile compatibility fallback (`Implemented`)

- При T2A/font metric ошибках compile retry переписывает legacy encoding preamble на Unicode-вариант:
  - убирает `cmap`, `fontenc`, `inputenc`;
  - переключает `\fontencoding{TU}`;
  - добавляет `\usepackage{fontspec}` и `\defaultfontfeatures{Ligatures=TeX}`;
  - использует `\setmainfont{Noto Serif}` как runtime fallback для учебных PDF.

### Presigned PDF preview (web) (`Implemented`)

- Presigned URL из `GET /teacher/latex/jobs/:jobId` и `.../pdf-presign` рендерятся во фронтенде через `PdfCanvasPreview`.
- Загрузка PDF по storage URL выполняется без credentials (`withCredentials = false`).

## LaTeX → HTML Pipeline (`Implemented`)

### Dual-render для unit theory/method

- Для unit-target `theory|method` worker из одного `tex` собирает:
  - PDF;
  - HTML fragment;
  - связанные TikZ SVG assets.
- Apply обновляет unit-артефакты атомарно:
  - `theoryPdfAssetKey` + `theoryHtmlAssetKey` + `theoryHtmlAssetsJson`
  - либо `methodPdfAssetKey` + `methodHtmlAssetKey` + `methodHtmlAssetsJson`
- `task solution` остаётся PDF-only.

### Student read path

- `GET /units/:id/rendered-content?target=theory|method`
  - проверяет student access к published unit;
  - читает HTML из storage;
  - подписывает SVG URLs по `*HtmlAssetsJson`;
  - возвращает final `html` fragment + optional `pdfUrl`.
- Если HTML ещё не собран, но PDF есть, web использует legacy PDF fallback.

### Teacher read path

- `GET /teacher/units/:id/rendered-content?target=theory|method`
  - использует teacher RBAC;
  - читает тот же HTML asset из storage;
  - подписывает связанные TikZ asset URLs;
  - возвращает HTML fragment для teacher preview.
- Teacher editor preview для `theory|method` поддерживает два режима:
  - `PDF` — legacy canvas preview;
  - `HTML` — backend-rendered HTML fragment.

### Rich math / TikZ notes

- Inline/block math в HTML panel typeset'ится локальным MathJax runtime в web.
- TikZ figures в HTML panel остаются image-based assets из worker render path.
- Текущий production path для TikZ assets:
  - `tectonic --outfmt xdv`
  - `dvisvgm --exact-bbox --font-format=woff`
- Известное ограничение текущего SVG path:
  - math accent-команды вида `\vec{...}` внутри TikZ labels могут рендериться браузером с некорректным положением accent glyph;
  - проблема признана как engineering debt и вынесена в `documents/exec-plans/tech-debt-tracker.md`.

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
  - `apps/api/src/learning/student-units.controller.ts`
  - `apps/worker/src/latex-html/render-latex-to-html.ts`
