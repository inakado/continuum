# VERTICAL-SLICE-VS-07.md

Проект: **Континуум**  
Слайс: **VS-07 Teacher Controls v1: Unit Override Open + Task Teacher Credit + Unblock/Reset + Required-Skipped Ops + Audit**  
Назначение документа: дать агенту “картину целиком” по VS-07 (что и в каком порядке делаем), без глубоких деталей реализации.

---

## RFC-00. Контекст

### RFC-00.1 Уже реализовано (к моменту VS-07)
- **VS-03**: attempts 3+3, блокировка/таймер, auto-credit после 6, статусы задач, уведомления учителю.
- **VS-04**: unit progress + unlock AND (внутри раздела), `locked/available/in_progress/completed`, `409 UNIT_LOCKED`, student graph отдаёт node status + метрики.
- **Семантика “минимум по необязательным” (фикс после VS-04)**:
  - `Unit.minOptionalCountedTasksToComplete`
  - completed = **required-гейт** + `optionalCountedTasks >= minOptionalCountedTasksToComplete`
- **VS-05**: photo tasks (`pending_review/accepted/rejected`), presigned upload/view, teacher review UI, `accepted` учитывается в solved/counted.
- **VS-09**: LaTeX→PDF→S3/MinIO→presigned, очередь+worker, auto-apply, PDF viewer.
- **VS-06**: чистота границ, guard’ы, unified `code+message` на критичных путях, sync recompute после `graph/publish/unpublish`.

### RFC-00.2 Цель VS-07
Добавить “контроль преподавателя” поверх существующей учебной логики:
1) **ручное открытие конкретного юнита** ученику (override);  
2) **ручной зачёт задач** (teacher_credited);  
3) **управление блокировкой/сбросом состояния** (unblock/reset);  
4) (если применимо) операции по **required-skipped**;  
5) **audit/events** для всех teacher-actions.

### RFC-00.3 Главный принцип (важно)
- **Override открывает только конкретный unit**.  
  Он **не** должен автоматически “пробивать” downstream по графу (никакого каскадного unlock).

---

## RFC-01. Термины и инварианты

### RFC-01.1 Unit availability (для student)
- `locked`: unit виден на графе, но:
  - клик в UI не ведёт в unit,
  - прямой URL → `409 { code: "UNIT_LOCKED" }`.
- `available`: unit можно открыть.
- `in_progress`: начаты попытки хотя бы в одной задаче.
- `completed`: required-гейт закрыт + выполнен optional-порог.

### RFC-01.2 Метрики (уже приняты)
- **counted** растёт при: `correct`, `credited_without_progress`, `teacher_credited`, `accepted` (photo).
- **solved** растёт при: `correct`, `teacher_credited`, `accepted` (photo).
- completed (VS-04 семантика после вашего изменения):
  - required-гейт обязателен (required задачи должны быть “зачтены” через counted-статус),
  - `optionalCountedTasks >= minOptionalCountedTasksToComplete`.

---

## RFC-02. Scope

### RFC-02.A Unit Override Open (teacher→student)
**User story:** учитель открывает ученику конкретный unit, даже если prereq не completed.

**Поведение:**
- На student graph unit остаётся видимым всегда.
- Без override:
  - prereq не выполнены → `locked`.
- С override:
  - unit становится `available` **несмотря** на prereq.

**Доступ:**
- student unit endpoint:
  - без override при lock → `409 UNIT_LOCKED`,
  - с override → `200` (доступ разрешён).

**Данные:**
- хранить override на уровне `(studentId, unitId)`,
- (желательно) хранить: `openedByTeacherId`, `createdAt`, `reason?`.

---

### RFC-02.B Teacher Credit (ручной зачёт задачи)
**User story:** учитель засчитывает задачу, чтобы закрыть пробел и чтобы это отразилось в статистике.

**Правила:**
- credit переводит `student_task_state.status` в `teacher_credited`.
- `teacher_credited`:
  - увеличивает **counted**,
  - увеличивает **solved** (это уже принято в VS-04).
- credit влияет на required-гейт и completed.

**Ограничения:**
- credit доступен teacher и только для “своих” студентов (lead teacher).
- credit должен триггерить recompute availability/метрик (в рамках секции).

---

### RFC-02.C Unblock / Reset (teacher moderation)
Добавить teacher-actions для восстановления возможности продолжить обучение:

1) **Unblock task**
- снимает блокировку (`blockedUntil` / аналог),
- не меняет контент/ревизии.

2) **Reset task**
- сбрасывает счётчики попыток/ошибок,
- приводит статус к базовому (например, `not_started`),
- не меняет контент/ревизии.

> Важно: оба действия должны запускать recompute (минимум секции), чтобы UI сразу увидел корректные статусы и доступности.

---

### RFC-02.D Required-skipped ops (если модель реально есть)
Если в модели есть флаг “пропущена обязательная”:
- teacher видит флаг,
- teacher может **снять** флаг,
- (опционально) teacher может вместо этого “зачесть” задачу.

Если такого флага нет/не используется — подпункт можно отложить.

---

### RFC-02.E Audit / Events
Все teacher-actions должны логироваться в event log (по DOMAIN-EVENTS.md).

Минимальные события:
- `UnitOverrideOpenedForStudent`
- `TaskTeacherCreditedForStudent`
- `TaskUnblockedForStudent` (если делаем)
- `TaskResetForStudent` (если делаем)
- `RequiredTaskSkippedFlagCleared` (если делаем)

Payload (минимум):
- `actorUserId` (+ `actorRole` как текущий tech debt в payload),
- `studentUserId`,
- `unitId`/`taskId`,
- `reason?`.

---

## RFC-03. Non-goals (вне VS-07)
- Batch/worker пересчёт availability (если sync станет тяжёлым — отдельный шаг позже).
- Override на уровне графа/раздела/курса (только точечный override unit).
- Новые роли/ACL-модель (используем текущий RBAC).
- Переделка ревизионной модели контента.
- Soft-delete/архивация историй.

---

## RFC-04. Data model (ориентир)

### RFC-04.1 Unit unlock override
Предпочтительно отдельная таблица:
- `unit_unlock_overrides`
  - `id`
  - `studentId`
  - `unitId`
  - `openedByTeacherId`
  - `createdAt`
  - `reason?`
  - UNIQUE `(studentId, unitId)`

Можно денормализовать override в `student_unit_state`, но источник правды лучше держать отдельно.

---

## RFC-05. Backend-first plan (Steps)

### RFC-05.Step-1 — Override Open (ядро)
1) Prisma/DB: добавить модель overrides (если нет).
2) LearningAvailabilityService:
   - учитывать override при вычислении статуса:
     - `available`, если override=true **или** (AND prereq completed).
3) Teacher endpoint:
   - `POST /teacher/students/:studentId/units/:unitId/override-open`
   - RBAC teacher-only
   - ownership: teacher owns student
   - idempotent: повтор → `200` + “already opened”
4) Recompute:
   - после override: sync recompute секции, где находится unit.
5) Events:
   - `UnitOverrideOpenedForStudent`

**STOP-CHECK Step-1**
- без override downstream locked → override → downstream available; direct open unit: 200.

---

### RFC-05.Step-2 — Teacher Credit (product path)
1) Endpoint:
   - `POST /teacher/students/:studentId/tasks/:taskId/credit`
   - ownership + RBAC
2) Переход статуса:
   - `student_task_state.status = teacher_credited`
3) Recompute:
   - sync recompute секции
4) Events:
   - `TaskTeacherCreditedForStudent`

**STOP-CHECK Step-2**
- required не закрыт → credit required → required gate закрыт; completed достигается при выполнении optional-порога.

---

### RFC-05.Step-3 — Unblock/Reset
1) Endpoints:
   - `POST /teacher/students/:studentId/tasks/:taskId/unblock`
   - `POST /teacher/students/:studentId/tasks/:taskId/reset`
2) Семантика:
   - unblock: убрать блокировку
   - reset: сбросить счётчики и статус
3) Recompute:
   - sync recompute секции
4) Events:
   - `TaskUnblockedForStudent`, `TaskResetForStudent`

**STOP-CHECK Step-3**
- задача заблокирована → unblock → student submitAttempt не возвращает TASK_BLOCKED.

---

### RFC-05.Step-4 — Required-skipped ops (если применимо)
1) Endpoint:
   - `POST /teacher/students/:studentId/tasks/:taskId/required-skipped/clear`
2) Recompute + Events.

---

## RFC-06. Teacher UI/UX (ориентир)

### RFC-06.1 Профиль ученика (drill-down, как сейчас)
В профиле ученика:
- секция “Уведомления” (уже есть),
- секция “Курс” с вложенным деревом Section → Unit → Tasks:
  - показывать unit status + completion/solved,
  - показывать badge “override” (если открыт учителем),
  - по задачам — статус + действия:
    - “Зачесть” (credit),
    - “Снять блокировку” (unblock),
    - “Сбросить” (reset),
    - (опционально) “Снять флаг required-skipped”.
- по юниту:
  - “Открыть юнит ученику” (override-open),
  - “Открыть юнит (preview)” — **не** как зачёт.

---

## RFC-07. Error contract (обязательное)
Все бизнес-ошибки должны быть:
```json
{ "code": "SOME_CODE", "message": "Human message" }
```
## Minimal error codes (VS-07)

- `UNIT_LOCKED`
- `STUDENT_NOT_ASSIGNED_TO_TEACHER`
- `UNIT_NOT_FOUND`
- `TASK_NOT_FOUND`
- `TASK_STATE_NOT_FOUND`
- `TASK_ALREADY_CREDITED`
- `OVERRIDE_ALREADY_EXISTS`

---

## RFC-08. STOP-CHECK VS-07 (max 3 scenarios)

### 1) Override

- prereq incomplete → unit is `locked`
- `override-open` → unit becomes `available`
- direct open `GET /units/:id` → `200`

### 2) Credit closes required gate

- required task not done → unit is **not** `completed`
- teacher credits required task → required gate becomes satisfied
- unit becomes `completed` when optional threshold is met (`minOptionalCountedTasksToComplete`)

### 3) Unblock

- student gets blocked (3 wrong attempts)
- teacher unblocks
- student `submitAttempt` succeeds (no `TASK_BLOCKED`)

---

## RFC-09. Tech debt / Notes

- `actorRole` is currently stored inside event-log `payload` (known tech debt).
  - In VS-07 we **do not** change this, but all new events must stay compatible.
  - If we decide to fix: add a dedicated `actor_role` column + best-effort migration later (out of VS-07 scope).

---

## RFC-10. Definition of Done

- Override Open affects availability and removes `UNIT_LOCKED` for the specific unit.
- Teacher credit is reflected in `solved/counted` and impacts `completed/unlock`.
- Unblock/reset work and trigger recompute.
- Teacher UI supports these actions without manual SQL.
- Business errors are stable `code + message`.
- Smoke checks pass (in Docker containers).