# Execution Plan: Teacher Dashboard Design-System Normalization

Статус плана: `Completed`

## 1. Цель

Привести teacher dashboard и связанные teacher sections к единой дизайн-системе с каноническим glass baseline:
- нормализовать typography roles и type scale;
- сократить ad hoc CSS overrides и повторяемые panel/button/container patterns;
- выделить reusable shared primitives поверх текущего UI-kit;
- сохранить архитектурные принципы `SRP`, `server-state discipline`, `effect isolation` и `convention over duplication`.

## 2. Контекст

- Основной teacher UX уже живёт в `DashboardShell` и feature screens: `edit`, `students`, `review`, `settings`, `unit`, `graph`.
- В коде используется единый glass teacher stack (`TeacherDashboardScreen`, `TeacherStudentsPanel`, `TeacherReviewInboxPanel`, `TeacherSettingsScreen`, `TeacherUnitDetailScreen`) без параллельного legacy CRUD-flow для курсов/разделов.
- Текущая типографика опирается на локально подключённые `Unbounded`, `Onest`, `Inter`, но фактически роли и размеры заданы непоследовательно.

## 3. In scope

- Семантические typography/layout/action tokens в `apps/web/app/globals.css`.
- Shared presentation primitives для page headers, surfaces, labels, statuses и empty states.
- Typed `Button` variant/size API.
- Миграция teacher dashboard screens на новые primitives и semantic scale.
- Обновление SoR-доков `DESIGN-SYSTEM.md`, `FRONTEND.md`, `PLANS.md`, `DOCS-INDEX.md`.

## 4. Out of scope

- Смена шрифтового стека.
- Изменение backend API или transport contracts.
- Полный student redesign.
- Изменение backend API или transport contracts сверх UI/design-system scope.

## 5. Decision log

1. Канонический visual baseline = `DashboardShell` + glass tokens + CSS Modules + shared UI primitives.
2. `Unbounded` остаётся только brand/logo face; `Onest` фиксируется как heading/accent face; `Inter` — body/interface face.
3. Общие typographic roles и layout rhythm задаются семантическими токенами, а не локальными `font-size`/`letter-spacing` на каждом экране.
4. Shared presentation primitives размещаются в `apps/web/components/ui/*` и могут использоваться всеми teacher features без доменной логики.
5. Teacher dashboard использует единый `react-query`-based read-path; `useEffect + useState` CRUD-read flow не остаётся в каноническом teacher web baseline.

## 6. Волны реализации

### Wave 1. Foundation

- Добавить semantic tokens:
  - `--text-title-*`, `--text-body-*`, `--text-label-*`, `--text-mono-*`;
  - `--space-*`, `--surface-*`, `--action-*`, `--layout-*`, `--motion-*`.
- Расширить `Button` до semantic variants/sizes.
- Нормализовать базовые UI styles (`Button`, `Input`, `Textarea`, `Dialog`, `AlertDialog`, `Tabs`, `Select`) под новые токены.

### Wave 2. Shared presentation primitives

- Добавить reusable компоненты:
  - `PageHeader`;
  - `SectionCard` / `InsetCard`;
  - `FieldLabel`;
  - `InlineStatus`;
  - `EmptyState`;
  - `Kicker`.
- Ограничить их responsibility presentation-only props без data loading.

### Wave 3. Teacher screens migration

- Перевести `TeacherDashboardScreen`, `TeacherStudentsPanel`, `TeacherReviewInboxPanel`, `TeacherSettingsScreen`, `TeacherUnitDetailScreen` на shared primitives и semantic typography.
- Удалить часть локальных button/status/empty/error overrides там, где они дублируют новый shared слой.
- Довести teacher screens и shared UI до состояния, где в active web codepath нет параллельного legacy teacher CRUD слоя.

### Wave 4. Docs + quality

- Синхронизировать фактическую модель в `DESIGN-SYSTEM.md` и `FRONTEND.md`.
- Обновить execution-plan lifecycle в `PLANS.md`.
- Прогнать `pnpm lint`, `pnpm lint:boundaries`, `pnpm typecheck`, `pnpm --filter web test`.

## 7. Риски

- Риск: новые tokens/primitives станут ещё одним параллельным слоем вместо консолидации.
  Контроль: каждый новый primitive должен сразу использоваться минимум в одном teacher flow.
- Риск: typography tokens будут объявлены, но screens продолжат жить на локальных значениях.
  Контроль: мигрировать в первую очередь page headers, labels, status/meta, empty/error blocks и actions.
- Риск: переработка `Button` сломает существующие ожидания тестов и скриншотов.
  Контроль: сохранить backward-compatible defaults (`primary`, `md`) и менять behavior через явные variants/sizes.

## 8. Критерии завершения

- Teacher screens используют единый semantic type scale и общие shared presentation primitives.
- `Button` имеет typed semantic variant/size API, а локальных `--button-*` overrides стало существенно меньше.
- Empty/error/status/header/container patterns в teacher UI визуально и структурно консистентны.
- SoR-доки отражают фактический teacher dashboard baseline и lifecycle execution plans.

## 9. Progress log

- `2026-03-09`: инициатива открыта после закрытия active student-dashboard plan со статусом `Superseded`.
- `2026-03-09`: добавлены semantic tokens в `apps/web/app/globals.css` (`--text-*`, `--space-*`, `--layout-*`, `--surface-*`, `--action-*`, `--motion-*`).
- `2026-03-09`: расширен `Button` до typed variants/sizes (`primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`) и выровнены базовые `Input`/`Textarea`/`Dialog`/`AlertDialog`/`Tabs`.
- `2026-03-09`: добавлены shared presentation primitives `PageHeader`, `SurfaceCard`, `FieldLabel`, `InlineStatus`, `EmptyState`, `Kicker`.
- `2026-03-09`: teacher screens `TeacherDashboardScreen`, `TeacherReviewInboxPanel`, `TeacherSettingsScreen`, `TeacherStudentsPanel` переведены на новый baseline без изменения backend API.
- `2026-03-09`: `TeacherDashboardScreen` дополнительно выровнен по create-section payload (`sortOrder = selectedCourse.sections.length`) для совместимости с существующим teacher flow и tests.
- `2026-03-09`: teacher typography дополнительно нормализована в `TeacherStudentsPanel`, `TeacherStudentProfilePanel`, `TeacherStudentUnitPreviewPanel`, `TeacherReviewInboxPanel`, `TeacherReviewSubmissionDetailPanel`: identity headers, drilldown headings, table/card titles, meta copy и status pills переведены на единый semantic scale.
- `2026-03-09`: button semantics дополнительно нормализованы по teacher routes: `primary = save/confirm`, `secondary = utility/open/create-in-context`, `ghost = quiet nav/edit`, `danger = destructive`; удалена часть локальных blue/neutral `--button-*` overrides в `students/review/graph/unit`.
- `2026-03-09`: завершён audit teacher action hierarchy: page-level create/save/accept CTA закреплены за `primary`, utility/open/refresh actions за `secondary`, destructive за `danger`, dismiss и quiet icon-actions за `ghost`; удалён оставшийся container-level override у `TeacherStudentProfilePanel`, чтобы button semantics шли только через variant API.
- `2026-03-09`: semantic rule уточнено после teacher dashboard sweep: entity-creation CTA (`Создать курс/раздел/юнит/задачу/преподавателя`, `Добавить ученика`) остаются `primary`; maintenance-save actions вроде `Сохранить граф` и прочие utility actions остаются `secondary`.
- `2026-03-09`: shared UI baseline дополнительно стабилизирован:
  - добавлен `ButtonLink` для button-styled route navigation;
  - `Select` перестал брать accessible name из `placeholder` и получил `ariaLabel`;
  - `Dialog` / `AlertDialog` получили `overscroll-behavior: contain`;
  - root surface/control tokens выровнены под glass baseline без локальных anti-border фиксов.
- `2026-03-09`: teacher navigation semantics частично переведены на native links:
  - `TeacherStudentsPanel` карточка ученика и action `К проверке фото`;
  - `TeacherStudentProfilePanel` review CTA и `Открыть раздел`;
  - header back action `Назад к ученикам` в `TeacherDashboardScreen`.
- `2026-03-09`: для `TeacherUnitDetailScreen` добавлен shared dirty-form guard (`beforeunload` + confirm dialog на breadcrumb/back exit), чтобы несохранённые изменения не терялись при выходе из editor.
- `2026-03-09`: `TeacherStudentsPanel` переведён на windowed rendering для длинных списков, а login-поля в teacher `students/settings` приведены к единой form semantics (`name`, `autocomplete`, `spellCheck={false}`, example placeholders с `…`).
- `2026-03-09`: мёртвые legacy teacher CRUD-экраны `TeacherCoursesScreen` и `TeacherCourseDetailScreen` вместе с их локальными CSS удалены из репозитория; teacher dashboard baseline остался единственным active web flow для управления курсами и разделами.
- `2026-03-11`: teacher `students` remaster довёл секцию до более минималистичного workspace baseline:
  - список учеников переведён в compact registry rows;
  - профиль ученика уплотнён до короткого identity header;
  - drilldown `courses -> sections -> units` получил последовательный density ladder без oversized cards и дублирующих stage headings.
- `2026-03-09`: проверки:
  - `pnpm lint` — `OK` (warnings only вне текущего scope);
  - `pnpm lint:boundaries` — `OK`;
  - `pnpm typecheck` — `OK`;
  - targeted web tests:
    - `TeacherDashboardScreen.test.tsx` — `OK`
    - `TeacherSettingsScreen.test.tsx` — `OK`
    - `TeacherStudentsPanel.test.tsx` — `OK`
    - `TeacherReviewInboxPanel.test.tsx` — `OK`
  - полный `pnpm --filter web test` остаётся нестабильным вне текущего scope: зафиксированы множественные pre-existing/unrelated timeouts в student/review/profile/unit suites и один vitest worker startup timeout.
- `2026-03-12`: план закрыт и переносится в `completed/`:
  - design-system baseline teacher routes стабилизирован;
  - дальнейшие structural/UI улучшения должны открываться отдельными инициативами, а не продолжать этот normalization plan.

## 10. Troubleshooting

- Пока пусто.
