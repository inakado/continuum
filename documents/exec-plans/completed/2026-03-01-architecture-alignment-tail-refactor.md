# 2026-03-01 — Architecture alignment tail refactor

Статус: `Completed`

## Цель

Закрыть остаточные архитектурные хвосты после foundation-refactor:
- убрать manual boundary parsing в отдельных API ветках;
- убрать manual server-state во frontend вне migration-срезов;
- физически разрезать слишком крупные модули, которые уже декомпозированы логически, но оставались тяжёлыми по размеру и ответственности.

## Контекст

На старте этой инициативы основной foundation-refactor уже был завершён, но кодовая база ещё держала локальные отклонения от `P1/P2/P3/P4/P8/P9/P10`:
- ручной boundary parsing в `content/statement-image` и LaTeX ветках;
- ручной server-state в отдельных teacher web flows;
- слишком крупные сервисы и экраны, которые уже были улучшены логически, но ещё не доведены до физически устойчивой композиции.

Инициатива была завершена без изменения доменных инвариантов, response shape и legacy error semantics.

## Scope

### In scope

- API boundary cleanup:
  - `apps/api/src/content/teacher-tasks.controller.ts`
  - `apps/api/src/content/teacher-latex.controller.ts`
  - `apps/api/src/content/internal-latex.controller.ts`
- Frontend server-state cleanup:
  - `apps/web/features/teacher-content/events/TeacherEventsScreen.tsx`
  - `apps/web/features/teacher-content/shared/use-teacher-identity.ts`
  - `apps/web/features/teacher-content/units/hooks/use-teacher-task-statement-image.ts`
- Physical decomposition:
  - `apps/api/src/students/students.service.ts`
  - `apps/api/src/content/content-write.service.ts`
  - `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`
  - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`
  - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`
  - `apps/api/src/learning/photo-task-read.service.ts`
  - `apps/api/src/learning/photo-task-review-write.service.ts`

### Out of scope

- Изменение продуктового поведения.
- Переписывание уже стабилизированных migration-срезов без явной необходимости.
- Performance profiling и runtime-optimization без baseline-замеров.

## Выполнено

### 1. Manual boundary parsing в API удалён

Закрыты API хвосты с ручным parse-layer:
- `teacher-tasks.controller.ts`
  - statement-image endpoints переведены на `ZodValidationPipe` и shared contracts;
  - добавлен `packages/shared/src/contracts/content-assets.ts`;
  - сохранены `INVALID_TTL`, `TTL_TOO_LARGE`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `INVALID_ASSET_KEY`.
- `teacher-latex.controller.ts` и `internal-latex.controller.ts`
  - внешний и internal LaTeX boundary переведён на общий helper/contract слой;
  - добавлен `apps/api/src/content/latex-boundary.contracts.ts`;
  - устранено дублирование `parseJobPayload/parseJobResult`;
  - сохранены `INVALID_PDF_TARGET`, `INVALID_LATEX_INPUT`, `LATEX_TOO_LARGE`, `INVALID_TTL`, `TTL_TOO_LARGE`, `LATEX_JOB_PAYLOAD_INVALID`, `LATEX_JOB_RESULT_INVALID`.

Safety-net:
- `apps/api/test/integration/task-statement-image-boundary.integration.test.ts`
- `apps/api/test/integration/latex-boundary.integration.test.ts`
- `packages/shared/test/content-assets-contracts.test.ts`

### 2. Manual server-state во frontend удалён

Read-path и teacher content hooks переведены на query/mutation model:
- `TeacherEventsScreen.tsx`
- `use-teacher-identity.ts`
- `use-teacher-task-statement-image.ts`

Что сделано:
- общий query cache для `teacherMe`;
- `TeacherEventsScreen` переведён на `useQuery`;
- statement-image preview/upload/delete переведены на `useQuery` / `useMutation`;
- сохранён текущий UX и совместимость teacher unit editor.

Safety-net:
- `TeacherEventsScreen.test.tsx`
- `use-teacher-identity.test.tsx`
- `use-teacher-task-statement-image.test.tsx`

### 3. Крупные модули физически декомпозированы

`students.service.ts`:
- выделены:
  - `teacher-accounts.service.ts`
  - `teacher-students.service.ts`
  - `students.shared.ts`
- `students.service.ts` оставлен фасадом.

Safety-net:
- `students-teacher-accounts.service.test.ts`
- `students-teacher-students.service.test.ts`

`content-write.service.ts`:
- выделены:
  - `content-write-course-section.service.ts`
  - `content-write-unit.service.ts`
  - `content-write-task.service.ts`
- `content-write.service.ts` оставлен фасадом.

Safety-net:
- `content-write-course-section.test.ts`
- `content-write-units.test.ts`
- `content-write-tasks.test.ts`

Web/learning tails:
- `TeacherSectionGraphPanel.tsx`
- `TeacherDashboardScreen.tsx`
- `TeacherStudentProfilePanel.tsx`
- `photo-task-read.service.ts`
- `photo-task-review-write.service.ts`

Что сделано:
- вынесены route/history/action/editor orchestration hooks;
- read/write photo services разрезаны по actor/read-model ответственности;
- фасадные public contracts сохранены.

Safety-net:
- `TeacherSectionGraphPanel.test.tsx`
- `TeacherDashboardScreen.test.tsx`
- `TeacherStudentProfilePanel.test.tsx`
- `photo-task-read.service.test.ts`
- `photo-task-review-write.service.test.ts`

## Decision log

- `TanStack Query` внедрялся только там, где источник сложности был в manual server-state orchestration; локальный UI state не переводился насильно.
- Крупные сервисы и экраны резались через facade-first подход: внешний контракт для контроллеров и экранов сохранялся, а декомпозиция выполнялась внутренними сервисами/hooks/helpers.
- API boundary cleanup выполнялся с обязательным сохранением текущих `error.code` и legacy HTTP semantics.

## Проверки

### Repo-level

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:check`

### Backend-in-Docker

- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec tsc -p tsconfig.json --noEmit"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm build"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`

### Frontend targeted

- `pnpm --filter web test -- <suite>`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`

## Итог

Инициатива закрыла остаточные architectural tails после foundation-refactor:
- manual boundary parsing убран;
- manual server-state в target frontend ветках убран;
- ключевые крупные модули доведены до более устойчивой композиции.

Следующий этап вынесен в отдельный active plan и посвящён только performance profiling и targeted optimization.
