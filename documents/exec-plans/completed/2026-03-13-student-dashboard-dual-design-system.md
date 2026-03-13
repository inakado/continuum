# Execution Plan: Student Dashboard Dual Design System

Статус плана: `Completed`

> `2026-03-13`: план завершён и перенесён в `documents/exec-plans/completed/`.

## 1. Цель

Зафиксировать и реализовать архитектуру, в которой teacher dashboard и student dashboard развиваются как разные дизайн-системы, без смешивания visual primitives, токенов и UX-паттернов.

## 2. Контекст

- План нормализации teacher UI завершён (`completed/2026-03-09-teacher-dashboard-design-system-normalization.md`), и teacher baseline стабилен.
- По student направлению начата новая визуальная линия с главной страницы `/student`, но она ещё не завершена.
- В коде одновременно существуют:
  - новый student dashboard flow в `apps/web/features/student-dashboard/*` (hero-first, overview + sections + graph внутри `/student`);
  - legacy student content flow в `apps/web/features/student-content/courses|sections/*` и маршрутах `/student/courses*`, `/student/sections/[id]`.
- Без явной архитектурной фиксации легко смешать teacher primitives и student WIP-слой, что создаёт путаницу и дублирование.

## 3. Целевая архитектура

### 3.1 Role-scoped UI systems

1. Shared foundation (общий слой):
- `apps/web/app/globals.css` — foundation tokens, reset, базовые семантические роли.
- `apps/web/components/ui/*` — role-neutral primitives (Button/Input/Dialog/Tabs/...).
- `apps/web/lib/api/*`, `apps/web/lib/query/*` — transport/server-state слой.

2. Teacher design system (`Implemented`):
- Канонический baseline для teacher маршрутов.
- Shared presentation primitives (`PageHeader`, `SurfaceCard`, `InlineStatus`, ...) используются как teacher-first слой.

3. Student design system (`In progress`):
- Живёт в `apps/web/features/student-dashboard/*`.
- Имеет отдельную визуальную лексику и композицию; не обязан повторять teacher glass baseline.
- Текущая точка входа и экспериментальный baseline: `/student`.

### 3.2 Dependency guardrails

- Student feature-слой не импортирует teacher feature-слой и teacher-specific presentation blocks.
- Teacher feature-слой не импортирует student feature-слой.
- Общий код переиспользуется только через role-neutral primitives/helpers/contracts.

### 3.3 Routing model на переходный период

- Канонический student dashboard UX = `/student` (новый flow).
- `/student/courses*` и `/student/sections/[id]` остаются как compatibility routes до завершения миграции, но не считаются целевым design-system baseline.

## 4. Scope

### In scope

- Архитектурная фиксация dual-design-system модели в SoR-доках.
- План миграции student dashboard с явными границами слоёв.
- Документирование статуса legacy student routes как transitional.

### Out of scope

- Полный редизайн student unit screen (`/student/units/[id]`).
- Изменение backend доменных инвариантов прогресса.
- Рефактор teacher dashboard visual baseline.

## 5. Decision log

1. Teacher и student dashboard развиваются как разные визуальные системы в рамках одного frontend-кода.
2. `components/ui/*` остаётся role-neutral слоем; role-specific presentation остаётся внутри соответствующих feature-модулей.
3. `student-dashboard` — единственная целевая точка развития student dashboard UX; legacy student content routes помечаются как transitional.
4. Любые новые student visual primitives добавляются в `features/student-dashboard/*`, а не в teacher-specific shared presentation слой.

## 6. Волны реализации

### Wave 0. Архитектурная фиксация (текущая)

- Создать active execution plan.
- Синхронизировать `ARCHITECTURE.md`, `FRONTEND.md`, `DESIGN-SYSTEM.md`, `DOCS-INDEX.md`.

### Wave 1. Student DS boundaries в коде

- Уточнить структуру `features/student-dashboard/*` (container/hooks/presentational blocks).
- Вынести student-specific visual primitives из монолитного screen-файла в отдельные компоненты внутри student feature.
- Не переносить teacher presentation primitives в student flow.

### Wave 2. Migration hygiene

- Зафиксировать migration policy для `/student/courses*` и `/student/sections/[id]` (compatibility-only).
- Удалять/сворачивать legacy student routes только после parity по функциональности и навигации в `/student`.

### Wave 3. Enforced boundaries

- Добавить/уточнить lint guardrails на уровне frontend feature-зависимостей (teacher ↔ student).
- Держать read/write разделение и server-state discipline в student dashboard refactor.

## 7. Риски и меры контроля

- Риск: случайное смешивание teacher и student visual primitives.
  Контроль: role-scoped ownership + explicit docs + lint guardrails.

- Риск: параллельное существование legacy и нового student flow создаст двойной SoR.
  Контроль: каноническим объявляется `/student`; legacy routes фиксируются как transitional.

- Риск: student redesign уедет в ad hoc CSS без архитектуры.
  Контроль: декомпозиция на hooks/container/presentational blocks и локальный набор student primitives.

## 8. Критерии завершения

- В SoR-доках зафиксирована dual-design-system модель без противоречий.
- Для student dashboard определён и соблюдается отдельный feature-level visual baseline.
- У команды нет неопределённости, где развивать teacher UI, а где student UI.
- Legacy student routes формально описаны как transitional до миграции.

## 9. Проверки

- Документация согласована между `ARCHITECTURE.md`, `FRONTEND.md`, `DESIGN-SYSTEM.md`, `DOCS-INDEX.md`.
- `pnpm lint:boundaries` остаётся зелёным после связанных кодовых изменений (в следующих волнах).

## 10. Progress log

- `2026-03-13`: создан active plan для dual-design-system архитектуры student/teacher dashboard.
- `2026-03-13`: зафиксирован переходный статус student dashboard: `/student` = целевой путь, `/student/courses*` и `/student/sections/[id]` = compatibility routes.
- `2026-03-13`: добавлены enforced guardrails в `eslint.config.mjs`:
  - запрет cross-import `student-* ↔ teacher-*` через `eslint-plugin-boundaries`;
  - запрет прямого импорта `@/components/DashboardShell` в role-specific feature-код;
  - введены role-specific wrappers `StudentDashboardShell` и `TeacherDashboardShell`.
- `2026-03-13`: `TeacherDashboardShell` вынесен в отдельную реализацию с собственным CSS-модулем (`teacher-dashboard-shell.module.css`), чтобы teacher sidebar дизайн/анимации менялись независимо от student sidebar.
- `2026-03-13`: `StudentDashboardShell` также вынесен в самостоятельную реализацию с собственным CSS-модулем (`student-dashboard-shell.module.css`); общий `DashboardShell` переведён в deprecated compatibility alias.
- `2026-03-13`: добавлен role-scoped theme layer для dashboard shell:
  - `student-dashboard-theme.module.css` и `teacher-dashboard-theme.module.css` подключаются на root shell;
  - semantic UI tokens (`--bg-accent`, `--button-hover-*`, `--nav-*`) теперь переопределяются по роли в пределах соответствующего subtree, без cross-impact между teacher/student.

## 11. Troubleshooting

- Пока пусто.
