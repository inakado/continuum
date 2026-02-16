# VERTICAL-SLICE-VS-06.md

Проект: **Континуум**  
Слайс: **VS-06 Revisions Hardening & Boundary Cleanup (Stabilization)**  
Статус: RFC  
Назначение: зафиксировать “контур ревизий” как устойчивую систему: инварианты, чистые границы, единые контракты, детерминированный пересчёт и короткий smoke. **Без расширения продуктового функционала.**

---

## 0) Контекст (что уже реализовано)

К этому моменту в проекте уже есть:

- **Task revisions**: `Task` как контейнер, `TaskRevision` как версионируемый снапшот задачи, `activeRevisionId`/`active_revision_id`.
- **Learning core v1**: attempts, student_task_state, 3+3, блокировки, auto-credit, teacher credit, уведомления учителю.
- **Unit availability/unlock AND** внутри секции + student_unit_state (locked/available/in_progress/completed) + метрики completion/solved.
- **Photo flow** (VS-05): pending_review/accepted/rejected + presigned storage.
- **LaTeX→PDF pipeline** (VS-09): очередь/worker, presigned, idempotent/stale-safe apply.

VS-06 НЕ добавляет новые пользовательские фичи. Он делает существующее **надёжным, консистентным и “чистым”**.

---

## 1) Цели (Goals)

### G1. Корректность ревизий “везде и всегда”
- Нельзя изменить содержимое задачи “in-place” — только через новую ревизию.
- Любой student state/attempt/credit должен быть **однозначно связан** с ревизией или иметь строго определённую семантику при смене `activeRevision`.

### G2. Жёсткие инварианты на границах
- `activeRevisionId` не должен быть `null` в рабочих сценариях.
- Ошибки и коды ошибок должны быть **единообразны** и стабильны для UI.

### G3. Чистые границы модулей
- Learning зависит от Content **только на чтение**.
- Content не содержит вычислений progress/unlock/attempt logic.
- Storage/EventsLog используются через единые сервисы.

### G4. Детерминированный пересчёт и отсутствие “дрейфа”
- Пересчёт метрик/доступности не должен давать разные результаты при одинаковом состоянии БД.
- prisma migrations / prisma generate / типы должны сходиться без “ручных” артефактов.

### G5. Короткий, но достаточный smoke
- 10–15 минут: покрыть максимальные риски ревизий, не уходя в тест-пирамиду.

---

## 2) Не в scope (Non-goals)

- Новая UX/дизайн-ревизия интерфейсов.
- Полноценная автоматизация тестов (юнит/интеграционные). Допускаются только **минимальные sanity checks** (curl + несколько сценариев).
- Новые доменные сущности прогресса (кроме строго необходимых индексов/констрейнтов).
- Новые платёжные/энтитлмент/роль-модели.

---

## 3) Обязательная подготовка агента

Перед началом работ агент обязан:

1) Прочитать **DOCS-INDEX.md** и открыть по нему минимум:
- ARCHITECTURE.md
- ER-MODEL.md
- DECISIONS.md
- DOMAIN-EVENTS.md
- HANDLER-MAP.md
- VERTICAL-SLICE-VS-03.md / VS-04.md / VS-05.md (ревизии/attempts/unlock/photo)
- VERTICAL-SLICE-VS-09.md (storage/presigned/job)

2) Составить “map” (коротко, списком):
- где создаётся/обновляется `TaskRevision`;
- где выставляется/используется `activeRevisionId`;
- где student unit view строит tasks + state;
- где submitAttempt пишет попытку и к чему она привязана (taskId vs revisionId);
- где выполняется пересчёт unit/section availability;
- где реализованы коды ошибок для конфликтов (409) и запретов (403).

---

## 4) Каноничные инварианты (Acceptance/Invariants)

### I1. Ревизии задач
- Любая контентная правка задачи (statement/type/parts/choices/solution/required/publish-значимые поля) = **новая `TaskRevision`**.
- Явные in-place исключения для `TaskRevision` (документированно и только в compile/apply потоке):
  - `solutionRichLatex`
  - `solutionPdfAssetKey`
  Причина: эти поля не участвуют в `attempt/evaluate/progress` и относятся к delivery/preview слоям.
- `Task.activeRevisionId` всегда указывает на существующую ревизию того же `Task`.
- При чтении для teacher: можно видеть draft+published контент по правилам Content.
- При чтении для student: только published контент; никакого draft.

### I2. Инвариант “активная ревизия не отсутствует”
- В “живых” сценариях `activeRevisionId` не должен быть null.
- Если исторически nullable в БД — должна существовать:
  - защита/guard с понятным 409 кодом (`TASK_ACTIVE_REVISION_MISSING`),
  - backfill/repair стратегия для старых данных,
  - smoke-check, подтверждающий, что при create/update задача не остаётся без activeRevision.

### I3. Семантика student state/attempt относительно ревизий (выбрать и зафиксировать)
В проекте должен быть один согласованный вариант:

**Вариант A (state по taskId):**  
- `student_task_state` хранится по (studentId, taskId), но включает `taskRevisionId` последней активности.  
- При смене `activeRevision` поведение:
  - если задача ещё не засчитана → state сбрасывается/переводится в not_started (или начинается новая “попытка” на новую ревизию).
  - если засчитана → остаётся засчитанной (DEC-08), но важно: что считается “засчитано” при ревизиях.

**Вариант B (state по revisionId):**  
- `student_task_state` хранится по (studentId, taskRevisionId).  
- Новая ревизия = новый state not_started, старый state остаётся историческим.

VS-06 цель: **не менять доменную модель**, а:
- проверить, какой вариант уже реализован фактически;
- устранить места, где поведение расходится;
- закрепить это в коде/контрактах/ошибках.

### I4. Единый контракт ошибок
- 400 — валидация входа (неправильные ids/payload).
- 403 — запрет роли/доступа (RBAC, не владелец).
- 404 — сущность “не найдена/недоступна” по правилам видимости.
- 409 — конфликт инвариантов/состояний (locked, missing active revision, нельзя submit и т.п.).
- Для critical learning paths (`submitAttempt`, `graph validation`, `availability`) формат бизнес-ошибок обязателен: `{ code, message }`.
- UI должен опираться на `code`, а не на `message`.

---

## 5) Основные риски, которые обязан закрыть VS-06

### R1. In-place update задачи
Где-то может оставаться код, который обновляет `Task`/`TaskRevision` без создания новой ревизии.

### R2. “Дыры” в activeRevision
- Create Task → Revision → link может оставлять task без activeRevision при ошибке/гонке.
- При publish/unpublish/replace-state могут возникать task без активной ревизии.

### R3. Несогласованный state/attempt при смене activeRevision
- UI/Backend может показывать состояние “по старой ревизии” или смешивать.
- Метрики юнита могут считаться не по тому набору “активных” задач.

### R4. Нестабильные коды ошибок и “drift”
- UI завязан на `message`, а не на `code`.
- Несостыковка типов student graph / statuses.
- Prisma drift (мigrations vs db vs client).

---

## 6) План работ (Backend-first)

### Step 1 — Инвентаризация и фиксация “как есть”
**Выход:** короткий список файлов/функций, где:
- создаётся ревизия;
- меняется activeRevision;
- строится student unit response;
- submitAttempt/credit использует ревизии/state;
- recompute availability вызывается.

Также: список известных 409 codes и где они формируются.

### Step 2 — Hardening инвариантов ревизий
- Убедиться, что **любая** правка задачи создаёт новую ревизию.
- Убедиться, что create/update не оставляют `activeRevisionId` пустым.
- Добавить/усилить guard `TASK_ACTIVE_REVISION_MISSING`:
  - в student unit view,
  - в submitAttempt,
  - в teacher edit/publish, если нужно.

### Step 3 — Консистентность state/attempt и “active revision semantics”
- Найти фактическую модель (A или B) и привести в единое состояние:
  - где state читается,
  - где state обновляется,
  - где attempts пишутся,
  - где метрики считаются.
- Зафиксировать orchestration recompute для section-level изменений:
  - источник студентов = “релевантные по секции” (`student_unit_state`/`student_task_state`/`attempts`);
  - safety fallback = “все активные студенты”.
- Почему fallback обязателен:
  - новый студент без активности ещё не попадает в section-scoped state/attempt выборки;
  - студент может отсутствовать в state после редких чисток/аномалий данных.
- Убедиться, что пересчёт юнита/секции идемпотентен (одинаковый результат при повторном вызове).

### Step 4 — Границы модулей и чистка краёв
- Проверить, что Learning не пишет Content (кроме допустимых ссылок/чтения).
- Привести ошибки и коды к единому виду.
- Убрать “мертвые хвосты” контрактов (например, неиспользуемые поля, устаревшие enum ветки).
- Проверить storage/event log слой на единообразие использования (без локальных дублей).

### Step 5 — Smoke-check и итоговый отчёт
Короткий прогон (см. раздел 7), зафиксировать фактические результаты.

---

## 7) Smoke-check VS-06 (обязательный минимум)

### S0. Сборка/типы/миграции
- `prisma migrate status` → up to date
- `prisma generate` выполнен
- `pnpm --filter @continuum/api exec tsc --noEmit` → OK
- `pnpm --filter web exec tsc --noEmit` → OK

### S1. Create Task → activeRevision non-null
- Teacher создаёт задачу любым типом.
- Проверить: task.activeRevisionId заполнен; ревизия существует.

### S2. Update Task → новая ревизия
- Teacher меняет условие/parts/choices/solution.
- Проверить: создана новая revision; activeRevisionId изменился; старая revision сохранена.

### S3. Student attempt привязка к ревизии/семантика при смене ревизии
- Student делает попытку на текущей ревизии.
- Teacher создаёт новую ревизию.
- Проверить поведение state:
  - соответствует выбранной фактической модели (A/B),
  - нет “перетекания” попыток между ревизиями,
  - нет падения/утечки ответов.

### S4. Guard activeRevision missing
- Смоделировать (или найти) задачу без activeRevisionId.
- Проверить: student unit view / submitAttempt возвращают 409 + code=TASK_ACTIVE_REVISION_MISSING.

### S5. Метрики юнита не “дрейфуют”
- Два последовательных GET unit/graph без изменений БД → одинаковые метрики/статусы.

---

## 8) Технические допущения (Implementation Notes)

- VS-06 допускает добавление:
  - индексов/уникальностей/foreign keys,
  - CHECK constraints,
  - guard-кодов,
  - минимального рефакторинга сервисов для единообразия.
- VS-06 не допускает изменения продуктовой логики (правил 3+3, unlock AND, photo acceptance), кроме фикса явных багов/несогласованностей.

---

## 9) Формат отчёта агента (строго)

Агент в конце обязан выдать отчёт:

1) Что найдено до правок  
2) Какие документы прочитал (по DOCS-INDEX) и что из них взял (коротко)  
3) Что сделано  
4) Файлы созданные/изменённые  
5) STOP-CHECK результаты (факт)  
6) Риски/заметки (только важное)

---

## 10) Definition of Done (DoD)

- Подтверждено smoke-check’ами, что:
  - activeRevisionId не остаётся null после create/update,
  - update создаёт новую revision,
  - state/attempt не “переезжают” неконсистентно,
  - guard TASK_ACTIVE_REVISION_MISSING работает и стабилен,
  - типы и миграции не расходятся.
- Нет нарушений границ модулей, либо они исправлены минимально и задокументированы.
- Контракты ошибок стабильны (code) и пригодны для UI.
