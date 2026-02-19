# DOMAIN-EVENTS
**Проект:** «Континуум»  
**Назначение:** единый каталог доменных событий (audit log + диагностика + будущие проекции).  

Статус: `Draft` (источник истины — код).

## 0) Общие правила (`Implemented`)

1) Событие пишется после успешного выполнения операции (обычно сразу после записи в БД).
2) Событие хранится в `domain_event_log` (см. `apps/api/prisma/schema.prisma`, модель `DomainEventLog`).
3) `payload` всегда включает `actorRole` (добавляется в `EventsLogService.append()`), даже если `actor_user_id` = null.

Поля в БД:
- `category`: `admin | learning | system`
- `event_type`: строка
- `actor_user_id`: nullable
- `entity_type`, `entity_id`
- `payload`: json
- `occurred_at`

## 1) Список событий (`Implemented`, extracted from code)

> Источник: фактические вызовы `eventsLogService.append({ eventType: ... })` в `apps/api/src/**`.

### 1.1 Identity & Access (BC1-ish)

- `TeacherCreated` (admin)
- `TeacherDeleted` (admin)
- `TeacherProfileUpdated` (admin)
- `TeacherPasswordChanged` (admin)
- `StudentCreated` (admin)
- `StudentDeleted` (admin)
- `StudentProfileUpdated` (admin)
- `StudentPasswordReset` (admin)
- `LeadTeacherAssignedToStudent` (admin)
- `LeadTeacherReassignedForStudent` (admin)

### 1.2 Content (BC2)

- `CourseCreated` (admin)
- `CourseUpdated` (admin)
- `CoursePublished` (admin)
- `CourseUnpublished` (admin)
- `CourseDeleted` (admin)

- `SectionCreated` (admin)
- `SectionUpdated` (admin)
- `SectionPublished` (admin)
- `SectionUnpublished` (admin)
- `SectionDeleted` (admin)

- `UnitCreated` (admin)
- `UnitUpdated` (admin)
- `UnitPublished` (admin)
- `UnitUnpublished` (admin)
- `UnitDeleted` (admin)

- `TaskCreated` (admin)
- `TaskRevised` (admin)
- `TaskPublished` (admin)
- `TaskUnpublished` (admin)
- `TaskDeleted` (admin)

- `UnitGraphUpdated` (admin)

### 1.3 Rendering (BC6-ish)

- `TaskSolutionPdfCompiled` (admin)

### 1.4 Learning (BC3)

- `AttemptSubmitted` (learning)
- `AttemptEvaluatedCorrect` (learning)
- `AttemptEvaluatedIncorrect` (learning)
- `TaskLockedForStudent` (system)
- `TaskAutoCreditedWithoutProgress` (system)
- `RequiredTaskSkippedFlagSet` (system)
- `TaskUnblockedForStudent` (admin)
- `TaskTeacherCreditedForStudent` (admin)
- `UnitOverrideOpenedForStudent` (admin)

### 1.5 Manual Review (Photo) (BC4)

- `PhotoAttemptSubmitted` (learning)
- `PhotoAttemptAccepted` (admin)
- `PhotoAttemptRejected` (admin)

## 2) Planned / TODO

> Эти события встречаются в старых legacy-доках/планах, но пока не подтверждены в коде как эмитящиеся.

- `UserAuthenticated`, `UserLoggedOut`, `UserPasswordChanged`
- `UnitBecameAvailableForStudent`, `UnitProgressStartedForStudent`, `UnitCompletedByStudent`
- `TaskRequiredFlagChanged` (если вводим отдельную команду вместо “пересоздания ревизии/обновления”)
- Rendering job lifecycle events (`RenderJobQueued|Started|Succeeded|Failed`, etc.) — если решим фиксировать их как события (сейчас это не нужно для core behavior).

## 3) Source links

- Event store:
  - `apps/api/prisma/schema.prisma` (model `DomainEventLog`)
  - `apps/api/src/events/events-log.service.ts`
- Emitters (примерно):
  - `apps/api/src/content/*.controller.ts`
  - `apps/api/src/learning/learning.service.ts`
  - `apps/api/src/learning/photo-task.service.ts`
  - `apps/api/src/students/*.controller.ts`
