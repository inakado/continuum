# Execution Plan: React Doctor Remediation

Статус плана: `Active`

## 1. Цель

Привести `apps/web` к более чистому и предсказуемому baseline после прогона React Doctor:
- убрать `error`-уровень и high-signal warnings, связанные с `state/effect` anti-patterns;
- выровнять Next.js/App Router boundaries (`Suspense`, metadata, redirect semantics);
- сократить a11y и bundle/perf предупреждения без регресса текущего UX;
- убрать мёртвый код и несвязанные с runtime хвосты `knip`.

## 2. Контекст

- React Doctor нашёл `3 errors` и `130 warnings` по `68/160` файлам в `apps/web`.
- Самые рискованные сигналы затрагивают `TeacherStudentsPanel`, `TeacherStudentProfilePanel`, `TeacherReviewSubmissionDetailPanel`, `PdfCanvasPreview` и несколько route/page boundaries.
- Работа должна соответствовать `SRP`, `server-state discipline`, `effect isolation`, `server-first rendering by default` и не ломать существующие teacher/student flows.

## 3. In scope

- `apps/web/components/**` и `apps/web/features/**`, затронутые React Doctor diagnostics.
- `apps/web/app/**` page metadata и route composition.
- Локальная чистка unused files/exports/types, если они реально не участвуют в активном codepath.
- Обновление execution plan и связанных SoR-доков, если меняется фактический frontend baseline.

## 4. Out of scope

- Backend API, Prisma schema, доменные инварианты и transport contracts.
- Полный redesign экранов.
- Массовый refactor только ради метрик, если он не даёт понятного architectural win.

## 5. Волны реализации

### Wave 1. Errors + high-signal state/effect fixes

- Убрать `no-derived-state-effect` / `no-derived-useState` в `TeacherStudentProfilePanel`, `TeacherReviewSubmissionDetailPanel`, `PdfCanvasPreview`.
- Сократить каскадные `setState` и перенести reset/derived logic ближе к render boundary или key boundary.

### Wave 2. Next.js/App Router boundaries

- Добавить `<Suspense>` boundaries там, где `useSearchParams()` может вызывать CSR bailout.
- Проверить и при необходимости добавить route metadata для страниц, где это оправдано.
- Сохранить server-first поведение и не превращать server routes в client-only без причины.

### Wave 3. Accessibility + media/render safety

- Убрать очевидные a11y проблемы (`autoFocus`, click handlers на non-interactive wrappers, labels, semantic controls).
- Перевести подходящие `<img>` на `next/image` с учётом private/presigned assets.
- Явно отделить trusted HTML render paths от произвольного HTML injection.

### Wave 4. Dead code + structural cleanup

- Удалить реально неиспользуемые файлы/экспорты/типы.
- Выполнить точечную декомпозицию и/или локальный `useReducer` там, где это реально снижает orchestration complexity, а не просто гасит warning.

### Wave 5. Structural refactor after stabilization

- Выполнить крупные structural refactor'ы отдельными малыми волнами, не смешивая их с bugfix sweep.
- Явно отделять:
  - `server-state` → `@tanstack/react-query`;
  - локальный `UI state` → `useState` / `useReducer` / focused hooks;
  - presentation → leaf components без data orchestration.
- Не переносить ephemeral UI state в query cache.
- Каждый подэтап завершать tests + typecheck до перехода к следующему.

## 6. Decision log

1. React Doctor используется как источник сигналов, но не как абсолютный KPI: в приоритете correctness и architectural fit.
2. `error`-уровень и warnings, влияющие на App Router rendering model, исправляются первыми.
3. `dangerouslySetInnerHTML` допустим только для явно доверенных backend/KaTeX HTML paths с понятным инвариантом происхождения.
4. `next/image` внедряется только там, где оно совместимо с текущим asset flow и не ломает private/presigned preview semantics.
5. Удаление dead code выполняется только после быстрой проверки, что файл/экспорт действительно не участвует в активном или planned codepath.
6. Следующая волна после React Doctor remediation не является “массовым переводом на TanStack всего подряд”: в TanStack переводится только `server-state` и network orchestration.
7. Большие компоненты разбиваются только по естественным responsibility boundaries; запрещён mechanical refactor ради счётчика warnings.

## 7. Риски

- Риск: большой sweep сломает teacher/student navigation state.
  Контроль: идти малыми волнами и прогонять targeted tests после каждого блока.
- Риск: формальное устранение warnings ухудшит читаемость.
  Контроль: не делать механические `useReducer`/decomposition refactors без ясной выгоды по ответственности.
- Риск: `metadata` и `Suspense` изменения затронут route composition.
  Контроль: сохранять page contracts минимальными и не переносить логику из server page в client feature без нужды.

## 8. Критерии завершения

- React Doctor не показывает `error`-уровень проблем в `apps/web`.
- Исправлены high-signal warnings по `Suspense`, redirect semantics, a11y и явному dead code в текущем scope.
- Teacher/student flows сохраняют текущее поведение под tests.
- Документация и active plan отражают фактические решения и оставшиеся компромиссы.

## 9. Progress log

- `2026-03-12`: инициатива открыта после анализа React Doctor diagnostics; выделены четыре волны remediation: state/effect, App Router boundaries, a11y/media safety, dead code cleanup.
- `2026-03-12`: устранены `error`-уровень проблемы из React Doctor:
  - route-scoped reset state в `TeacherStudentProfilePanel` и `TeacherReviewSubmissionDetailPanel` заменён на key-boundaries вместо `useEffect` reset;
  - `PdfCanvasPreview` переведён с prop-sync `currentUrl` на local refresh override state без derived-state effect.
- `2026-03-12`: локальные `Suspense`-границы добавлены вокруг `useSearchParams`-driven feature entrypoints (`student dashboard`, `teacher review`, `teacher student profile`) без изменения их внешнего API.
- `2026-03-12`: выполнена волна App Router/a11y/media cleanup:
  - page-level metadata добавлены для active `app/**/page.tsx`;
  - student/teacher image previews переведены на `next/image` там, где это не ломает presigned flow;
  - убраны `autoFocus`, raw non-interactive click wrapper и часть raw `<label>` wrappers заменена на shared `FieldLabel`.
- `2026-03-12`: очищены safe dead-code хвосты:
  - удалены неиспользуемые tracked файлы `apps/web/app/page.module.css`, `TeacherStudentUnitPreviewPanel.*`, `apps/web/types/uiw-react-codemirror.ts`;
  - убраны лишние exports/types в shared UI, hooks и `lib/api/student.ts`, которые не использовались вне своих модулей.
- `2026-03-12`: повторный React Doctor после remediation показал улучшение с исходных `82/100, 3 errors, 130 warnings` до `93/100, 0 errors, 21 warnings` на изменённом срезе.
- `2026-03-12`: зафиксирована следующая последовательность structural refactor wave:
  1. `TeacherStudentsPanel` — primary target для выпрямления `server-state`/mutation orchestration и локального reducer-based UI state;
  2. `PdfCanvasPreview` — изоляция document loading / rendering / inertial scroll в focused hooks;
  3. `TeacherUnitDetailScreen` — dynamic split editor path и декомпозиция tab content;
  4. `StudentDashboardScreen` — только после стабилизации teacher-side refactors, отдельно от product redesign.
- `2026-03-12`: выполнен первый подэтап structural wave для `TeacherStudentsPanel`:
  - локальный dialog/action/confirm/search state вынесен в `useTeacherStudentsUiState`;
  - `@tanstack/react-query` сохранён источником истины только для students/teachers read-path и CRUD/reset mutations;
  - root panel оставлен orchestration/composition слоем без возврата к derived-state effects;
  - подтверждено, что create/edit/transfer/delete/reset password сценарии проходят на существующем test coverage.
- `2026-03-12`: выполнен technical split для `PdfCanvasPreview`:
  - `document loading`, refresh просроченной PDF URL, viewport width sync и inertial scroll вынесены в focused hooks;
  - публичный API `PdfCanvasPreview` сохранён без изменений;
  - smoke tests по загрузке/refresh error/refresh retry остались зелёными.
- `2026-03-12`: выполнен safe bundle split для `TeacherUnitDetailScreen`:
  - editor-only stack вынесен в lazy leaf `TeacherLatexEditor`;
  - `TeacherUnitDetailScreen` больше не импортирует `@codemirror/view` / `StreamLanguage` напрямую;
  - `TeacherUnitTabContent` разделён на latex/tasks branches без изменения compile/save contracts.
- `2026-03-12`: для `StudentDashboardScreen` закрыт безопасный performance slice без переписывания history model:
  - прямой `motion` заменён на `LazyMotion + m`;
  - существующий restore/navigation UX сохранён на тестах;
  - более глубокое разделение navigation/history state оставлено следующей отдельной волной.

## 10. Следующая последовательность

### Step 1. `TeacherStudentsPanel`

- Цель:
  - вынести query/mutation orchestration в focused hooks;
  - локальный modal/action state собрать в reducer или несколько малых hooks;
  - оставить root component как composition layer.
- В TanStack переводим/нормализуем:
  - students list read-path;
  - teachers list read-path;
  - create/reset/transfer/edit/delete mutations;
  - invalidation/update strategy.
- В локальном UI state оставляем:
  - открытие/закрытие dialog;
  - текущие draft values формы;
  - selection/open menu state;
  - confirm dialog state.
- Safety-net:
  - `TeacherStudentsPanel.test.tsx`
  - `TeacherStudentProfilePanel.test.tsx`
  - targeted lint/typecheck.

### Step 2. `PdfCanvasPreview`

- Цель:
  - выделить `usePdfDocumentLoader`;
  - выделить `usePdfCanvasRenderer`;
  - выделить `useInertialScrollViewport`.
- Не менять user-facing contract компонента.
- Проверки:
  - `typecheck`;
  - affected integration/component tests;
  - повторный React Doctor по changed files.

### Step 3. `TeacherUnitDetailScreen`

- Цель:
  - изолировать `CodeMirror`/editor stack через `dynamic` там, где это реально режет initial bundle;
  - разнести `TeacherUnitTabContent` на tab-specific components;
  - не трогать backend contracts и compile flow.
- Проверки:
  - `TeacherUnitDetailScreen.test.tsx`;
  - targeted typecheck/lint.

### Step 4. `StudentDashboardScreen`

- Цель:
  - отделить history/navigation state model от presentation;
  - отдельно рассмотреть `LazyMotion`;
  - не смешивать с visual redesign.
- Проверки:
  - `StudentDashboardScreen.test.tsx`;
  - smoke React Doctor на changed files.

## 11. Проверки

- `pnpm --filter web exec eslint ...` по изменённому срезу — `OK` (кроме pre-existing complexity warning в `TeacherUnitDetailScreen`, не связанного с регрессией поведения).
- `pnpm --filter web typecheck` — `OK`.
- `pnpm exec eslint features/teacher-students/TeacherStudentsPanel.tsx features/teacher-students/hooks/use-teacher-students-ui-state.ts` в `apps/web` — `OK`.
- `pnpm exec tsc --noEmit` в `apps/web` — `OK`.
- `pnpm exec eslint components/PdfCanvasPreview.tsx components/pdf-preview-hooks.ts` в `apps/web` — `OK`.
- `pnpm exec vitest run --config vitest.config.ts components/PdfCanvasPreview.test.tsx` — `OK`.
- `pnpm exec eslint features/teacher-content/units/TeacherUnitDetailScreen.tsx features/teacher-content/units/components/TeacherUnitLatexPanel.tsx features/teacher-content/units/components/TeacherLatexEditor.tsx` в `apps/web` — `OK`.
- `pnpm exec vitest run --config vitest.config.ts features/teacher-content/units/TeacherUnitDetailScreen.test.tsx` — `OK`.
- `pnpm exec eslint features/student-dashboard/StudentDashboardScreen.tsx` в `apps/web` — `OK`.
- `pnpm exec vitest run --config vitest.config.ts features/student-dashboard/StudentDashboardScreen.test.tsx` — `OK`.
- targeted `vitest` для wave 5 / step 1:
  - `features/teacher-students/TeacherStudentsPanel.test.tsx` — `OK`
  - `features/teacher-students/TeacherStudentProfilePanel.test.tsx` — `OK`
- targeted `vitest`:
  - `features/student-dashboard/StudentDashboardScreen.test.tsx` — `OK`
  - `features/teacher-dashboard/TeacherDashboardScreen.test.tsx` — `OK`
  - `features/teacher-dashboard/TeacherSectionGraphPanel.test.tsx` — `OK`
  - `features/teacher-review/TeacherReviewInboxPanel.test.tsx` — `OK`
  - `features/teacher-review/TeacherReviewSubmissionDetailPanel.test.tsx` — `OK`
  - `features/teacher-students/TeacherStudentProfilePanel.test.tsx` — `OK`
  - `features/teacher-students/TeacherStudentsPanel.test.tsx` — `OK`
  - `features/teacher-content/units/TeacherUnitDetailScreen.test.tsx` — `OK`
- повторный `React Doctor` по `apps/web` — `93/100`, `0 errors`, `21 warnings`, отчёт в `/var/folders/d_/qz451mk15hx9jgrjtwtzkyyr0000gp/T/react-doctor-a5c75a5f-54c3-4c61-a5ee-877e7ecd95e7`.

## 12. Troubleshooting

- Пока пусто.
