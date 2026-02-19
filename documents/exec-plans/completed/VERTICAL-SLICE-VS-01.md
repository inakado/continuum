# VERTICAL-SLICE-VS-01
Статус: `Archived` (migrated execution plan; source of truth — code).

> Этот документ перемещён из `documents/` в `documents/exec-plans/completed/` (plans are first-class artifacts).
Проект: **Континуум**  
Слайс: **VS-01 — Контентный скелет + публикация + просмотр учеником**  
Назначение документа: дать агенту “картину целиком” по VS-01 (что и в каком порядке делаем), без глубоких деталей реализации.

---

## 0) Цель VS-01
Сделать первый **end-to-end** результат:
- **Teacher** может через API/UI создать структуру контента: **Course → Section → Unit → Task**.
- Teacher может **публиковать/снимать с публикации** каждую сущность.
- **Student** видит **только опубликованное**, с соблюдением правила:
  - **если родитель draft → всё скрыто**, даже если потомок published.

---

## 1) Вне scope VS-01 (не делаем в этом слайсе)
- Graph (ReactFlow) и unlock rules
- Attempts, проверки ответов, 3+3 блокировки, пропуски
- Прогресс: completion% / solved%
- Rich LaTeX → PDF, S3, воркеры компиляции
- Фото-задачи и ручная проверка
- Concepts и поиск по понятиям
- Аналитика
- Полноценный audit UI (запись событий допустима минимально)

---

## 2) Модули/домены, которые затрагиваем в VS-01

### 2.1 Identity & Access
**Цель:** роли и доступ, без публичной регистрации.

Функциональность:
- роли: `teacher`, `student`
- вход по логину/паролю
- получение текущего пользователя (`/auth/me`)
- RBAC guard (Teacher-only / Student-only)

Минимальные эндпоинты (ориентир):
- `POST /auth/login`
- `POST /auth/logout` (если выбран cookie-based подход)
- `GET /auth/me`

---

### 2.2 Content Authoring (Teacher)
**Цель:** CRUD и публикация сущностей контента.

Сущности:
- Course, Section, Unit, Task (каждая со `status: draft|published`)

Правило публикации:
- сущность учитывается учеником только если она `published` и **все её родители `published`**
- публикация потомка при draft-родителе должна быть запрещена (валидация на API)

Эндпоинты (ориентир, без фиксации точных путей):
- Teacher CRUD:
  - `POST /teacher/courses`
  - `PATCH /teacher/courses/:id`
  - `POST /teacher/courses/:id/publish`
  - `POST /teacher/courses/:id/unpublish`
  - аналогично для sections/units/tasks
- Teacher listing:
  - `GET /teacher/courses`
  - `GET /teacher/courses/:id` (с sections)
  - `GET /teacher/sections/:id` (с units)
  - `GET /teacher/units/:id` (с tasks)

---

### 2.3 Content Delivery (Student)
**Цель:** чтение опубликованного контента.

Функциональность:
- Student видит список опубликованных курсов
- Student открывает курс → видит опубликованные разделы
- Student открывает раздел → видит опубликованные юниты
- Student открывает юнит → видит юнит и опубликованные задачи

Эндпоинты (ориентир):
- `GET /courses`
- `GET /courses/:id`
- `GET /sections/:id`
- `GET /units/:id`

Фильтрация (обязательное правило):
- возвращать только `published` сущности
- скрывать потомков, если любой родитель `draft`

---

### 2.4 Audit Log (минимум)
**Цель:** фиксировать админ-действия учителя для трассировки.

События (минимум, запись в БД):
- create/update/publish/unpublish для Course/Section/Unit/Task

UI для журнала не обязателен в VS-01.

---

## 3) Данные/таблицы (уровень MVP VS-01)
Минимальный набор:
- `users` (id, role, login, password_hash, timestamps)
- `courses` (id, title, description?, status, timestamps)
- `sections` (id, course_id FK, title, status, sort_order?, timestamps)
- `units` (id, section_id FK, title, status, sort_order?, timestamps)
- `tasks` (id, unit_id FK, title?, statement_lite, answer_type, is_required, status, sort_order?, timestamps)
- `audit_log` (id, actor_id, event_type, entity_type, entity_id, payload_json, ts)

Индексы (ориентир):
- `status` на каждой контент-таблице
- `(parent_id, status)` на sections/units/tasks
- `login` unique на users

---

## 4) Порядок разработки (последовательность)
В этом порядке проще всего получать проверяемый прогресс.

### STEP 1 — Identity + RBAC
- модель users + миграции
- /auth/login, /auth/me
- RBAC guard и 2 тестовых защищённых endpoint-а

### STEP 2 — Контентные таблицы + миграции
- courses/sections/units/tasks (+ минимальные индексы)

### STEP 3 — Teacher API: CRUD + publish/unpublish
- валидации публикации по родителям
- teacher listing (чтобы UI мог работать)

### STEP 4 — Student API: read-only published views
- строгая фильтрация published + published ancestors

### STEP 5 — Teacher UI (минимальный)
- создать/редактировать/публиковать контент
- навигация по иерархии

### STEP 6 — Student UI (минимальный)
- просмотр опубликованного контента
- навигация Courses → Course → Section → Unit

### STEP 7 — Audit log (минимум)
- запись событий при admin-действиях в API
- (опционально) простой teacher endpoint `GET /teacher/audit` без сложных фильтров

---

## 5) DoD VS-01 (Definition of Done)
Слайс считается готовым, когда:
1) Teacher может создать Course/Section/Unit/Task и публиковать/снимать с публикации.
2) Student видит только опубликованные сущности, и соблюдается правило: **если родитель draft — всё скрыто**.
3) RBAC работает: teacher не видит student-only и наоборот.
4) Публикация потомка при draft-родителе запрещена (ошибка 4xx с понятным сообщением).
5) `pnpm smoke` остаётся зелёным + добавлен ручной checklist для VS-01 (или минимальный e2e сценарий).

---

## 6) Риски/узкие места (для внимания агента)
- Правильная фильтрация published + ancestors (не забыть про “родитель draft скрывает всё”).
- Не усложнять модель: без Concepts, без Progress, без Attempts.
- Стабильный порядок сущностей в списках (если нужен UI — использовать sort_order).
