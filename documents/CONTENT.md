# CONTENT

Статус: `Draft` (источник истины — код).

## Scope

- Course/Section/Unit/Task CRUD
- publish/unpublish + правила видимости
- unit graph (edges/layout)
- task revisions (active revision)
- LaTeX → PDF pipeline (unit theory/method)
- LaTeX → HTML pipeline (unit theory/method, task solution)

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

- `Course`: содержит `lockDurationMinutes`, может хранить `coverImageAssetKey`.
- `Section`: внутри course, хранит `description`, сортировку, unit graph и может хранить `coverImageAssetKey`.
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
  - `methodGuidance` — plain text методические указания для teacher-authored task hint
  - render asset keys: `solutionHtmlAssetKey`
  - HTML asset manifests: `solutionHtmlAssetsJson`
  - auto-check данные: numeric parts / choices / correct choices

### Section ordering

- `Section.sortOrder` внутри `Course` является teacher-facing порядком разделов.
- На create-path backend сам назначает следующий `sortOrder = max(existing sortOrder) + 1`; клиентский `sortOrder` при создании раздела не считается source of truth.
- Read-path курса сортирует разделы по `sortOrder`, а при равенстве дополнительно по `createdAt`, чтобы legacy-данные с одинаковым `sortOrder` оставались детерминированными.

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
- `POST /teacher/debug/latex/compile-and-upload` → enqueue debug job (`target=debug_pdf`) и возвращает `jobId` + `statusUrl`.

### Job status / apply

- `GET /teacher/latex/jobs/:jobId`:
  - если `succeeded`, всегда возвращает `assetKey`;
  - для unit job дополнительно возвращает `presignedUrl` на PDF preview;
  - для `task_solution` `presignedUrl` не возвращается (preview читается через rendered-content endpoint);
  - если `failed`, возвращает `error` с полями:
    - `code`, `message`
    - `log`
    - `logTruncated`
    - `logLimitBytes`
    - `logSnippet` для legacy-совместимости.
- `POST /teacher/latex/jobs/:jobId/apply`:
  - для unit → пишет `Unit.theoryPdfAssetKey|methodPdfAssetKey`
  - для task solution → пишет `TaskRevision.solutionHtmlAssetKey|solutionHtmlAssetsJson`
  - для debug jobs endpoint возвращает `LATEX_JOB_APPLY_UNSUPPORTED`.
- Worker делает auto-apply через internal endpoint:
  - `POST /internal/latex/jobs/:jobId/apply` (`x-internal-token`).

### Stale protection

- Apply защищается от stale-ключей (`shouldApplyIncomingPdfKey`): старый результат не должен перезатереть новый.
- Для `task_solution` используется timestamped HTML key, для unit — timestamped PDF+HTML keys.

### Compile compatibility policy (`Implemented`)

- Backend compile runtime работает на `TeX Live` и считает canonical только `pdflatex`-совместимый source.
- TeX binaries установлены только в `worker` контейнере; `api` не компилирует LaTeX локально.
- Если teacher source не содержит полного document envelope, backend оборачивает его repo-canonical `pdflatex` preamble.
- Если source содержит XeTeX/LuaTeX-only preamble или команды вне текущего runtime scope, compile fail-fast завершается `LATEX_COMPILE_FAILED`.
- Current denylist включает:
  - `fontspec`
  - `unicode-math`
  - `polyglossia`
  - `minted`
  - `svg` / `\includesvg`
  - `\defaultfontfeatures`, `\setmainfont`, `\setsansfont`, `\setmonofont`, `\setmathfont`, `\newfontfamily`
  - `\directlua`
  - `\write18`
  - `\tikzexternalize`
  - bibliography/index toolchain (`\bibliography`, `\addbibresource`, `\printbibliography`, `\makeindex`, `\printindex`)
- `shell-escape` не используется.
- XColor compatibility fallback остаётся: при unknown TikZ color compile retry добавляет `dvipsnames,svgnames,x11names`.

### Presigned PDF preview (web) (`Implemented`)

- Unit PDF preview во фронтенде рендерится через `PdfCanvasPreview` (presign из `GET /teacher/latex/jobs/:jobId` и `.../pdf-presign`).
- Загрузка PDF по storage URL выполняется без credentials (`withCredentials = false`).

## Cover Images (`Implemented`)

- Teacher authoring для `Course` и `Section` использует S3-compatible upload flow:
  - `presign-upload`
  - прямой `PUT` в storage
  - `apply assetKey`
  - `presign-view`
- Asset keys для обложек хранятся в доменных сущностях:
  - `Course.coverImageAssetKey`
  - `Section.coverImageAssetKey`
- Dev runtime использует тот же MinIO/S3-compatible contour, что и остальные object storage assets.
- Student dashboard overview (`GET /student/dashboard`) подписывает course cover image URLs на read-path и не даёт UI прямой доступ к bucket.

## LaTeX → HTML Pipeline (`Implemented`)

### Dual-render для unit theory/method

- Для unit-target `theory|method` worker из одного `tex` собирает:
  - PDF;
  - HTML fragment;
  - связанные TikZ SVG assets.
- Apply обновляет unit-артефакты атомарно:
  - `theoryPdfAssetKey` + `theoryHtmlAssetKey` + `theoryHtmlAssetsJson`
  - либо `methodPdfAssetKey` + `methodHtmlAssetKey` + `methodHtmlAssetsJson`

### Task solution HTML render path

- Для `task_solution` worker собирает HTML fragment + связанные TikZ SVG assets.
- Apply обновляет active revision:
  - `solutionHtmlAssetKey`
  - `solutionHtmlAssetsJson`
- Legacy `solutionPdfAssetKey` остаётся в БД, но не участвует в новом compile/read path.

### Student read path

- `GET /units/:id/rendered-content?target=theory|method`
  - проверяет student access к published unit;
  - читает HTML из storage;
  - подписывает SVG URLs по `*HtmlAssetsJson`;
  - возвращает final `html` fragment + optional `pdfUrl`.
- Если HTML ещё не собран, но PDF есть, web использует legacy PDF fallback.
- В student HTML panel скачивание PDF всегда должно запрашивать свежий presigned URL через backend read-path перед открытием файла; это защищает от `Request has expired` при долгом открытии вкладки.
- Для решения задачи student read path:
  - `GET /student/tasks/:taskId/solution/rendered-content`
  - проверяет доступ (published chain, unit unlocked, задача зачтена);
  - читает `solutionHtmlAssetKey` из storage;
  - подписывает URLs для `solutionHtmlAssetsJson`.
- Published unit/task payload также несёт `TaskRevision.methodGuidance`; student UI может использовать это поле без отдельного write/read расширения.

### Teacher read path

- `GET /teacher/units/:id/rendered-content?target=theory|method`
  - использует teacher RBAC;
  - читает тот же HTML asset из storage;
  - подписывает связанные TikZ asset URLs;
  - возвращает HTML fragment для teacher preview.
- Teacher editor preview для `theory|method` поддерживает два режима:
  - `PDF` — legacy canvas preview;
  - `HTML` — backend-rendered HTML fragment.
- Для решения задачи teacher read path:
  - `GET /teacher/tasks/:taskId/solution/rendered-content`
  - возвращает HTML fragment решения с заменёнными TikZ placeholder URLs;
  - при отсутствии HTML возвращает `SOLUTION_RENDER_MISSING`.

### Rich math / TikZ notes

- Inline/block math в HTML panel typeset'ится локальным MathJax runtime в web.
- TikZ figures в HTML panel остаются image-based assets из worker render path.
- Для multi-column LaTeX layout поддерживается `minipage`:
  - worker извлекает `minipage` из document body и рендерит их как адаптивные HTML rows;
  - ширина вида `0.42\linewidth`, `0.48\textwidth` переносится в HTML как proportional flex-basis;
  - optional position spec `[t]`, `[b]` и default alignment нормализуются в vertical align classes для HTML.
- Текущий production path для TikZ assets:
  - `pdflatex --output-format=dvi`
  - `dvisvgm --exact-bbox --font-format=woff`
- Для standalone TikZ compile worker дополнительно переносит поддерживаемые декларации из `document` body (`\newcommand`, `\def`, `\pgfmathsetmacro`, `\tikzset`, `\definecolor`, `\colorlet`) перед рендером блока, чтобы body-defined макросы были доступны в HTML asset path.
- Compile/runtime helper живёт в `packages/latex-runtime` и используется в worker compile contour.
- Для theorem-like theory blocks HTML path поддерживает repo-canonical boxes:
  - `DefinitionBox`
  - `RemarkBox`
  - `ExampleBox`
  - макросы `\DEF`, `\opr`, `\Opr`, `\Oprf`, `\DEFlabel`, `\zm`
- Extraction этих боксов выполняется только из `\begin{document}...\end{document}`:
  - preamble и macro definitions (`\newcommand{\DEF}[2]{...}` и т.п.) не считаются source для HTML box rendering;
  - это invariant против ложного захвата `#1/#2` из macro bodies.
- Figure references в HTML render path нормализуются так:
  - ссылки на `fig:*` в обычном тексте становятся кликабельными anchor links (`href="#fig:..."`);
  - `\ref/\autoref` на `fig:*` внутри math-контекста не превращаются в HTML links, а подставляются как plain text reference (`рис. N`) до MathJax typeset, чтобы не ломать формулу.
- Текстовая типографика HTML path дополнительно нормализует LaTeX-style punctuation вне math-контекста:
  - `---` → `—`
  - `--` → `–`
  - `<<...>>` → `«...»`
- HTML pipeline считается semantic/rendered representation, а не pixel-perfect эквивалентом PDF:
  - текущий контур сохраняет основной текст, формулы, figure references и image-based TikZ figures;
  - итоговый HTML может типографически отличаться от исходного PDF/LaTeX layout, особенно в figure-heavy theory content.
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
  - `apps/api/src/learning/student-task-solutions.controller.ts`
  - `apps/api/src/learning/student-units.controller.ts`
  - `apps/worker/src/latex-html/render-latex-to-html.ts`
