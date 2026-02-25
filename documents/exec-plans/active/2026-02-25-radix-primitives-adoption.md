# 2026-02-25 — Radix primitives adoption (web)

Статус: `Active` (реализация выполнена, verification заблокирован окружением)

## Цель

Внедрить в `apps/web` Radix primitives для сложных интерактивных UI-паттернов (`Dialog`, `AlertDialog`, `DropdownMenu`, `Select`, `Switch`, `Tabs`) без изменения визуального языка продукта, с сохранением текущей дизайн-системы на CSS variables.

## Контекст

Текущий UI-kit содержит базовые кастомные компоненты (`Button`, `Input`, `Textarea`, `Checkbox`, `Tabs`) и ряд самописных паттернов (`dialog`, контекстные меню, confirm через `window.confirm`, нативные `select`).

Это создает:
- дублирование a11y/focus-management логики по экранам;
- риск регрессий в keyboard/focus/overlay поведении;
- неоднородный UX (нативные confirm/select против кастомного UI).

## Scope

### In scope

- Добавить Radix зависимости в `apps/web/package.json`.
- Создать/обновить UI-компоненты в `apps/web/components/ui/`:
  - `Dialog`
  - `AlertDialog`
  - `DropdownMenu`
  - `Select`
  - `Switch`
  - `Tabs` (миграция на Radix internals при сохранении текущего внешнего API)
- Миграция экранов:
  - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx`
  - `apps/web/features/teacher-students/TeacherStudentsPanel.tsx`
  - `apps/web/features/teacher-review/TeacherReviewInboxPanel.tsx`
  - `apps/web/features/teacher-content/tasks/TaskForm.tsx`
  - `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`
  - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`
  - `apps/web/features/teacher-settings/TeacherSettingsScreen.tsx`
- Замена `window.confirm` на единый confirm-паттерн на базе `AlertDialog`.
- Проверка `pnpm --filter web typecheck`.
- Обновление SoR-доков (`FRONTEND.md`, `DESIGN-SYSTEM.md`).

### Out of scope

- Полная замена простых базовых полей (`Input`, `Textarea`, `Button`, `Checkbox`) на Radix equivalents.
- Редизайн визуального языка, цветовой палитры, типографики.
- Изменения API/backend логики.

## Шаги реализации

1. Добавить зависимости Radix.
2. Реализовать UI wrappers и стили, привязанные к текущим design tokens.
3. Внедрить wrappers в выбранные экраны.
4. Вынести подтверждение действий в общий `AlertDialog`-паттерн.
5. Прогнать typecheck.
6. Обновить документацию и закрыть план.

## Decision log

- Используем Radix только для сложных интерактивных паттернов; простые примитивы остаются кастомными.
- Styling strategy: CSS Modules + текущие CSS variables, без Tailwind.
- Анимации: сохраняем совместимость с `framer-motion`, не дублируем анимационные цепочки между Radix и motion.

## Риски

- Риск визуальных расхождений между нативными и новыми контролами.
- Риск регрессии в keyboard/focus сценариях при частичной миграции.
- Риск роста сложности при внедрении confirm-flow на уровне нескольких экранов.

## Откат

- Откатить изменения по конкретному экрану (feature-by-feature), т.к. миграция делается инкрементально.
- Старые компоненты/паттерны удалять только после прохождения typecheck и ручного smoke.

## Критерии завершения

- В проекте нет `window.confirm` в `apps/web`.
- Целевые экраны используют Radix wrappers для dialog/menu/select/switch/tabs.
- Typecheck `web` проходит.
- Документация синхронизирована с кодом.

## Фактический прогресс (`Implemented`)

- Добавлены Radix-зависимости в `apps/web/package.json`.
- Добавлены UI wrappers:
  - `apps/web/components/ui/Dialog.tsx`
  - `apps/web/components/ui/AlertDialog.tsx`
  - `apps/web/components/ui/DropdownMenu.tsx`
  - `apps/web/components/ui/Select.tsx`
  - `apps/web/components/ui/Switch.tsx`
  - `apps/web/components/ui/Tabs.tsx` (перевод на Radix internals)
- Переведены экраны:
  - `TeacherStudentsPanel`: `DropdownMenu`, `Select`, `AlertDialog`
  - `TeacherReviewInboxPanel`: `Select`
  - `TaskForm`: `Select`
  - `TeacherUnitDetailScreen`: `Switch`, `Dialog`, `AlertDialog`
  - `TeacherSectionGraphPanel`: `Dialog`
  - `TeacherDashboardScreen`: `AlertDialog`
  - `TeacherSettingsScreen`: `AlertDialog`
- Удалены `window.confirm` и нативные `<select>` из `apps/web`.
- Обновлены SoR-доки: `documents/FRONTEND.md`, `documents/DESIGN-SYSTEM.md`.

## Troubleshooting (во время выполнения)

- Где упало:
  - `pnpm --filter web typecheck`
- Что увидели:
  - `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsc" not found`
- Почему:
  - ранее `pnpm install --filter web` / `CI=true pnpm install --filter web --force` пересоздали общий `node_modules`, после чего install новых зависимостей упёрся в отсутствие сети до npm registry.
- Как чинить:
  1. Выполнить install в окружении с доступом к npm registry:
     - `pnpm install --filter web --no-frozen-lockfile`
  2. Затем вернуть строгий режим:
     - `pnpm install --frozen-lockfile`
  3. Прогнать проверку:
     - `pnpm --filter web typecheck`
- Как проверить:
  - `apps/web/node_modules/.bin/tsc` существует,
  - `pnpm --filter web typecheck` завершается без ошибок,
  - `pnpm-lock.yaml` синхронизирован с `apps/web/package.json`.
