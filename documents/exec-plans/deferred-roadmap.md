# deferred-roadmap

Назначение: единое место для неактивных future items, которые не являются техдолгом и не вынесены в active execution plan.

## Правила записи

- Здесь хранятся только отложенные инициативы и направления.
- Файл не хранит progress logs и не заменяет active execution plans.
- Как только item становится активной инициативой, он переезжает в `documents/exec-plans/active/*`.

## Формат записи

- ID
- Область
- Описание
- Почему отложено
- Trigger / когда вернуться
- Источник
- Статус: `deferred`

## Категории

### Architecture

#### DR-001

- Область: Security / Architecture
- Описание: собрать отдельный threat model по trust boundaries `web ↔ api`, `api ↔ db/redis/s3`, `worker ↔ api/s3`.
- Почему отложено: не является текущим blocking work для runtime или docs cleanup.
- Trigger: отдельная security initiative или заметное изменение trust boundaries.
- Источник: `documents/SECURITY.md`
- Статус: `deferred`

#### DR-002

- Область: Learning / Product
- Описание: расширить notification coverage для `photo_reviewed` и `unit_override_opened`, если это понадобится продукту.
- Почему отложено: текущая функциональность работает без этих событий.
- Trigger: продуктовый запрос на расширение teacher/student feedback.
- Источник: `documents/LEARNING.md`
- Статус: `deferred`

### Product

#### DR-003

- Область: Design / UX
- Описание: формализовать teacher/student user journeys (happy path + error/empty states).
- Почему отложено: сначала stabilizing architecture and docs governance.
- Trigger: отдельная UX/product initiative.
- Источник: `documents/DESIGN.md`
- Статус: `deferred`

#### DR-004

- Область: Design system / UX
- Описание: зафиксировать визуальные и interaction principles после стабилизации дизайн-системы.
- Почему отложено: текущая дизайн-система ещё продолжает оформляться в коде.
- Trigger: отдельная design-system initiative.
- Источник: `documents/DESIGN.md`
- Статус: `deferred`

### Documentation

#### DR-005

- Область: Security / Docs
- Описание: добавить минимальный security checklist для CI/docs governance.
- Почему отложено: это улучшение quality contour, но не обязательный шаг текущего cleanup.
- Trigger: отдельная security/docs automation initiative.
- Источник: `documents/SECURITY.md`
- Статус: `deferred`

### Frontend

#### DR-006

- Область: Frontend
- Описание: формализовать UI state patterns, accessibility baseline и retry/backoff conventions для list screens.
- Почему отложено: текущий frontend SoR уже должен отражать только стабильную модель, а не backlog.
- Trigger: отдельная frontend quality initiative.
- Источник: `documents/FRONTEND.md`
- Статус: `deferred`

#### DR-007

- Область: Content / Teacher authoring / Student UX
- Описание: добавить task-level поле методических указаний при создании и редактировании задачи в teacher UI, передавать его через shared task contracts и выводить на student unit screen отдельным блоком под карточкой задачи.
- Почему отложено: текущий student redesign переносит только visual structure, а в доменных и transport контрактах задачи ещё нет поля для методической заметки.
- Trigger: отдельная teacher authoring initiative по расширению формы задачи и student read-model.
- Источник: `apps/web/features/teacher-content/tasks/TaskForm.tsx`, `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx`
- Статус: `deferred`
