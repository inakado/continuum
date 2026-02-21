# Execution Plan: Teacher Dashboard Editing UX + Metadata

Статус плана: `Completed`

## 1. Цель

Сделать teacher dashboard удобным для повседневной работы:
- сократить проблемный пункт сайдбара до `Курсы`;
- добавить редактирование `title/description` для `Course` и `Section`;
- показывать дату создания в карточках `Course/Section/Unit`;
- сделать очевидной область создания связи в графе юнитов.

## 2. Scope

### In scope
- `apps/web/features/teacher-dashboard/*`
- `apps/web/components/DashboardShell.tsx` (через nav labels в feature-экранах)
- `apps/web/lib/api/teacher.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/content/dto/section.dto.ts`
- `apps/api/src/content/content.service.ts`
- Prisma migration для `sections.description`
- Обновление SoR-доков (`documents/CONTENT.md`, `documents/generated/db-schema.md`)

### Out of scope
- Изменение student UI
- Массовый редизайн teacher dashboard

## 3. Decision log

1) `Section.description` добавляется в модель БД, DTO и API-контракт (не имитируем поле только на фронте).  
2) Редактирование курса/раздела делается через встроенную inline-форму с иконкой `Pencil` рядом с publish/delete.  
3) Дата создания выводится в карточках и узлах графа в формате `ru-RU` (`dd.mm.yyyy`).  
4) Для графа используется hover/focus affordance на source-handle (подсветка зоны + hint), без смены библиотеки/паттерна взаимодействия.

## 4. Шаги реализации

- [x] Добавить `Section.description` в Prisma schema + migration.
- [x] Расширить section DTO/service (`createSection`, `updateSection`) под description.
- [x] Протянуть `createdAt` узла в `teacher section graph` API response.
- [x] Обновить web API types (`Section`, `GraphNode`, section create/update payload).
- [x] Обновить Teacher Dashboard:
  - [x] nav label `Создание и редактирование` → `Курсы`;
  - [x] формы create course/section с `description`;
  - [x] иконка редактирования + сохранение title/description;
  - [x] createdAt в карточках курсов и разделов.
- [x] Обновить Teacher Section Graph:
  - [x] createdAt в node-card;
  - [x] явная hover/focus-зона для source handle.
- [x] Обновить SoR-доки по фактическому коду.

## 5. Риски и откат

- Риск: несовпадение Prisma schema и фактической БД без миграции.  
  Контроль: отдельная migration `20260222032000_section_description`.

- Риск: UI-регресс в карточках из-за добавленной мета-информации.  
  Контроль: компактные стили, без изменения структуры данных selection/navigation.

- Откат: откатить migration и соответствующие изменения DTO/service/UI в одном релизе.

## 6. Критерии завершения

- В teacher sidebar пункт `Курсы` отображается без обрезки.
- Course/Section можно создать и отредактировать с `title/description`.
- В карточках Course/Section и узлах Unit отображается дата создания.
- В графе юнитов по hover/focus видна кликабельная зона для протягивания ребра.

## 7. Troubleshooting (во время выполнения)

1) Где упало: `pnpm --filter web typecheck`  
Что увидели: ошибки `Cannot find module '@/components/StudentShell'` и `@/components/EntityList` в `student-content/*`, плюс несовпадение `StudentUnitStatus` в `StudentSectionDetailScreen.tsx`.  
Почему: legacy student screens ссылались на удалённые shared-компоненты и устаревший union типа статуса в node data.  
Как чинили: добавили совместимые `apps/web/components/StudentShell.tsx` и `apps/web/components/EntityList.tsx`, а в `StudentSectionDetailScreen` заменили status-тип на `StudentUnitStatus` + `getStudentUnitStatusLabel`.  
Как проверить: `pnpm --filter web typecheck` проходит без ошибок.
