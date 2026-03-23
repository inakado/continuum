# Execution Plan: Production-ready dark theme foundation

Статус плана: `Completed`

> `2026-03-23`: реализация завершена и план перенесён в `documents/exec-plans/completed/`.

## 1. Цель

Пересобрать dark theme для student и teacher dashboard как часть дизайн-системы, сохранив light theme без визуальных изменений и убрав ad hoc role-specific dark overrides.

## 2. Контекст

- В коде уже есть split на `StudentDashboardShell` и `TeacherDashboardShell`, а также role theme modules.
- Текущая dark theme читалась нестабильно: в feature CSS было много raw neutral literals и локальных `[data-theme="dark"]` фиксов.
- `code.html` использовался как референс для канонической dark palette и читаемости student unit detail.

## 3. In scope

- Foundation dark tokens в `apps/web/app/globals.css`.
- Role-level semantic mapping в `student-dashboard-theme.module.css` и `teacher-dashboard-theme.module.css`.
- Student routes: `/student`, `/student/courses*`, `/student/sections/[id]`, `/student/units/[id]`.
- Teacher dark migration: shell, dashboard, section graph, unit detail.
- Обновление SoR-доков `FRONTEND.md` и `DESIGN-SYSTEM.md`.

## 4. Out of scope

- Изменение layout/composition light theme.
- Переписывание public TS API компонентов без необходимости.
- Пересборка teacher/student visual language в одну систему.

## 5. Decision log

1. Общий dark foundation хранится в `globals.css`, а role-specific mapping живёт только в role theme modules.
2. Новые role CSS не используют raw neutral literals вне foundation/theme layers.
3. Student и teacher используют одну dark palette basis, но разные interaction mappings (`accent/nav/button`).

## 6. Волны реализации

### Wave 1. Foundation

- Добавить semantic dark tokens для surface/outline/text/status/paper/canvas shadows.
- Перевести shared primitives (`button`, `switch`, `pdf-canvas-preview` и близкие helpers) на foundation tokens.

### Wave 2. Student

- Расширить `student-dashboard-theme.module.css` role tokens.
- Перевести `student-dashboard/*`, `student-content/courses|sections|units/*` на semantic aliases.
- Для `student-unit-detail.module.css` завести локальные aliases по зонам и убрать raw neutral colors.

### Wave 3. Teacher

- Расширить `teacher-dashboard-theme.module.css` role tokens.
- Перевести `teacher-dashboard/*` и `teacher-content/units/*` на semantic aliases без light regressions.

### Wave 4. Docs + checks

- Обновить `FRONTEND.md` и `DESIGN-SYSTEM.md`.
- Прогнать `pnpm lint:boundaries`, `pnpm --filter web typecheck`, `pnpm --filter web test`.

## 7. Риски

- Риск: потеря точного light baseline.
  Контроль: не менять `[data-theme="light"]` semantics, только вводить алиасы с тем же визуальным результатом.

- Риск: смешение foundation и role-логики.
  Контроль: foundation хранит только нейтральные dark tokens; accent/nav/button остаются в role theme modules.

- Риск: пользовательские незакоммиченные правки в student/teacher CSS.
  Контроль: интегрировать изменения поверх текущего diff, без отката чужих правок.

## 8. Проверки

- `pnpm lint:boundaries`
- `pnpm --filter web typecheck`
- `pnpm --filter web test`
- `rg` на raw neutral literals в role CSS после миграции

## 9. Progress log

- `2026-03-23`: открыт active plan для production-ready dark theme foundation.
- `2026-03-23`: подтверждён wave order `student first -> teacher second`.
- `2026-03-23`: добавлен общий semantic dark foundation в `apps/web/app/globals.css`:
  - `--foundation-surface*`, `--foundation-outline*`, `--foundation-text*`, `--foundation-success*`, `--foundation-paper-bg*`, `--foundation-shadow*`.
- `2026-03-23`: `student-dashboard-theme.module.css` и `teacher-dashboard-theme.module.css` расширены role aliases (`--role-surface*`, `--role-outline*`, `--role-success*`, `--role-paper-bg*`) поверх общего dark foundation.
- `2026-03-23`: shared primitives (`button`, `switch`, `pdf-canvas-preview`, `entity-editor-inline`, `entity-list`) переведены на foundation/role tokens без raw neutral literals.
- `2026-03-23`: student routes (`student-dashboard`, `student-content/courses`, `student-content/sections`, `student-content/units`) переведены на semantic dark aliases; `student-unit-detail.module.css` получил локальные zone tokens для progress/task/content/media/answer states.
- `2026-03-23`: teacher routes (`teacher-dashboard`, `teacher-section-graph-panel`, `teacher-unit-detail`) переведены на тот же dark foundation через teacher-specific mapping без изменения light baseline.
- `2026-03-23`: SoR-доки `FRONTEND.md` и `DESIGN-SYSTEM.md` обновлены: добавлен dark foundation contract и правило запрета raw neutral literals в role CSS вне foundation/theme layers.
- `2026-03-23`: проверки завершены успешно:
  - `pnpm lint:boundaries` — `OK`
  - `pnpm --filter web typecheck` — `OK`
  - `pnpm --filter web test` — `OK` (`27` test files, `112` tests)
