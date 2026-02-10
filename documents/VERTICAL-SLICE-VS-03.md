# VERTICAL-SLICE-VS-03.md
Проект: **Континуум**  
Слайс: **VS-03 — Learning Core v1: Students + Attempts + Shuffling + Task Statuses + 3+3 + Notifications (без фото-ревью)**  
Назначение: дать агенту **картину целиком** по VS-03 — *что делаем и в каком порядке*, без глубоких деталей реализации.  
Границы: VS-03 строится поверх уже существующих VS-01/VS-02 (Identity+RBAC, Content CRUD+publish, Student/Teacher dashboards, граф раздела, unit tabs, task builder, event log).

---

## 0) Контекст и обязательное чтение документации
Перед началом работы агент обязан:
1) Открыть `documents/DOCS-INDEX.md` и по нему найти релевантные документы.
2) Минимальный набор для VS-03:
   - `VERTICAL-SLICE-VS-03.md` (этот файл)
   - `ARCHITECTURE.md` (границы BC, слои, modular monolith)
   - `ER-MODEL.md` (сущности attempts/progress/notifications, PK/FK/индексы)
   - `DOMAIN-EVENTS.md` (каноничные имена событий и категории)
   - `HANDLER-MAP.md` (куда писать handlers/jobs)
   - `DECISIONS.md` (ключевые правила 3+3, required, ревизии и пр.)
   - `DESIGN-SYSTEM.md` (UI стиль)
   - `DEVELOPMENT.md` (запуск/проверки)

---

## 1) Цели VS-03 (в терминах результата)
К концу VS-03 должно быть возможно:
- Учитель: **создать ученика**, выдать логин/пароль, **reset password**, **передать ученика** другому учителю (смена ведущего).
- Ученик: в опубликованном юните **решать задачи** типов `numeric / single_choice / multi_choice`:
  - фиксировать попытки,
  - получать статусы задач (`not_started/in_progress/correct/blocked/credited_without_progress`),
  - блокировка после 3 неправильных (таймер),
  - автозакрытие после 6 неправильных (`credited_without_progress`),
  - решения/ответы показываются **только** после `correct` или после `credited_without_progress`.
- `single/multi`: варианты на фронте **shuffle**, отправка на бэк только **ключей**.
- Учителю показывается сигнал/уведомление: **“обязательная задача пропущена”** (required + auto-credit).
- Всё работает с учётом: попытки/блокировки считаются **по актуальной ревизии** (ревизии полноценно позже, но модель VS-03 должна это не сломать).

---

## 2) Вне scope VS-03 (не делаем)
- Фото-задачи `photo`: загрузка, pending_review, принятие/отклонение (это VS-05).
- Полная система unlock/completion/solved% на уровне юнита/графа (это VS-04).
- Teacher manual credit/override попыток/блокировок (это VS-07).
- Полный механизм ревизий задач как фича UI (это VS-06), но **данные VS-03 должны быть совместимы**.

---

## 3) Доменные блоки (bounded contexts / модули) затронутые в VS-03
### BC Identity & Access (уже есть, расширяем минимально)
- Учитель создаёт ученика → создаётся `User` роль `student`, пароль hash.
- Смена ведущего учителя у ученика — только teacher role.

### BC Students (новый/расширяемый модуль)
- Сущность “StudentProfile/Student” привязанная к User(student).
- Поле `leaderTeacherId` (User(teacher)) — ведущий учитель.

### BC Learning (новый модуль)
- Попытки (Attempt) и агрегированное состояние задачи (TaskProgress / StudentTaskState).
- Правила 3+3, blockedUntil, auto-credit.

### BC Notifications (минимальный слой)
- Уведомления/сигналы учителю:
  - required task auto-credit
  - (опционально в VS-03) task blocked (если уже пишем как событие)
- UI выдача в teacher dashboard (можно через existing events log или отдельную таблицу notifications — как согласовано в доках).

### BC Audit/Event Log (уже есть)
- В VS-03 добавляются **learning-события** (категория `learning`) для ключевых действий:
  - attempt created
  - task blocked
  - task auto-credited (credited_without_progress)
  - required auto-credit notification created

---

## 4) Основные правила (фиксируем поведение)
### 4.1 Статусы задачи для ученика
- `not_started` — нет попыток.
- `in_progress` — строго при первой Attempt по задаче/ревизии.
- `correct` — решено корректно (только auto-check в VS-03).
- `blocked` — после 3 неправильных: до времени `blockedUntil`.
- `credited_without_progress` — после 6 неправильных: попытки прекращаются.
- Доп. флаг: `is_required_skipped` — если required ушла в auto-credit.

### 4.2 Логика 3+3
- Счётчик ошибок ведётся **по задаче** и **по активной ревизии**.
- 3-я неправильная попытка → ставим блокировку на X минут (X = настройка курса).
- При попытке ответить раньше `blockedUntil`:
  - ответ не принимаем
  - возвращаем оставшееся время Y (и UI показывает “попробуйте через Y”)
- 6-я неправильная попытка → `credited_without_progress`, показать решение/ответ.

### 4.3 Показ решения/ответа
- Решение показываем:
  1) после `correct`, или
  2) после `credited_without_progress`.
- Пока попытки не исчерпаны и задача не решена — решения не показываем.

### 4.4 Shuffle вариантов
- Только на фронте.
- На бэк уходит только **ключ** выбора (single) или **множество ключей** (multi).
- Перемешивание нужно так, чтобы ученик не мог “добить перебором по памяти”.

---

## 5) Порядок реализации VS-03 (high-level steps)
> Важно: шаги в таком порядке, чтобы всегда можно было сделать stop-check.

### Step 1 — Students: модели + teacher API + UI
- Добавить сущности Student (leaderTeacherId, userId).
- Teacher endpoints:
  - create student (login + autogenerated password)
  - reset password
  - transfer student to another teacher
  - list/search
- Teacher UI:
  - sidebar “Ученики”
  - список + create/reset/transfer
- Stop-check: созданный student входит и видит /student.

### Step 2 — Learning DB model: Attempt + TaskProgress (revision-aware)
- Ввести таблицы:
  - `attempts`
  - `task_progress` (или эквивалент)
- Привязка к `studentId`, `taskId`, `taskRevisionId` (под active revision).
- Индексы под выборки:
  - по studentId+taskId+revisionId
  - по studentId+unitId (если нужно быстрые unit-выборки)

### Step 3 — Student submit attempt API (numeric/single/multi)
- Endpoint для создания Attempt:
  - принимает ответ
  - проверяет тип задачи
  - выполняет auto-check
  - обновляет TaskProgress (attemptsUsed, wrongCount, status, blockedUntil)
- Возвращает состояние задачи (для UI).
- Stop-check: можно сделать 1 попытку → статус in_progress; correct → correct.

### Step 4 — Enforcement: blocked + auto-credit + required skipped + notifications
- Реализовать:
  - запрет submit если `blockedUntil > now` (возврат remaining)
  - переход в blocked на 3-й ошибке
  - переход в credited_without_progress на 6-й ошибке
  - required + auto-credit → флаг is_required_skipped + уведомление teacher
- Stop-check: 3 ошибки → blocked; 6 ошибок → auto-credit + teacher sees signal.

### Step 5 — Student UI: реальные формы задач + shuffle + статусы
- В Student unit screen:
  - формы ответа по типам задач:
    - numeric: поля по numeric_parts (label_lite под KaTeX)
    - single/multi: варианты, shuffle, отметка выбора
  - отображение статусов, номера попыток, таймера блокировки
  - показ решения/ответа только по правилам
- Stop-check: в браузере пройти сценарии 3+3.

### Step 6 — Learning Events: писать в event log (категория learning)
- Добавить записи:
  - attempt created (по желанию минимально)
  - task blocked
  - task auto-credited (и required skipped)
- Teacher events page уже есть: использовать фильтр категории.

---

## 6) API контуры VS-03 (общая “картинка”, без точных DTO)
### Teacher (role=teacher)
- `POST /teacher/students`
- `GET /teacher/students`
- `POST /teacher/students/:id/reset-password`
- `PATCH /teacher/students/:id/transfer`
- (опционально) `GET /teacher/notifications` или используем существующий `/teacher/events?category=...`

### Student (role=student)
- `POST /student/tasks/:taskId/attempts`
- `GET /student/units/:unitId` (дополнить данными прогресса задач)
- (опционально) `GET /student/tasks/:taskId/state` (если нужно для UI)

---

## 7) UI/UX контуры VS-03
### Teacher
- Dashboard → “Ученики”
  - создать ученика (показать пароль 1 раз)
  - reset password (показать пароль 1 раз)
  - transfer student (сменить ведущего)
  - сигнал “обязательная пропущена” (как минимум список/бейдж)

### Student
- Unit → вкладка “Задачи”
  - список задач
  - внутри задачи:
    - условия (LiteTeX)
    - форма ответа по типу
    - статус (not_started/in_progress/correct/blocked/credited_without_progress)
    - блокировка с таймером (Y минут осталось)
    - после correct или auto-credit: показать решение/ответ

---

## 8) Данные и безопасность
- Пароли только hash, plaintext пароль показываем только при создании/reset.
- RBAC:
  - teacher endpoints — teacher only
  - student attempt endpoints — student only
- Cookie auth уже внедрён: web делает запросы с `credentials: "include"`.
- Student не должен иметь доступа к teacher events/students.

---

## 9) Stop-check VS-03 (финальный контроль)
Минимальный набор проверок:
1) Teacher создал student → student логинится → видит /student dashboard.
2) Student решает single/multi: варианты shuffle, submit отправляет ключи, проверка корректна.
3) 3 ошибки → blocked, ранний submit даёт “подождите Y”.
4) 6 ошибок → credited_without_progress, попытки прекращаются, решение/ответ показывается.
5) required задача уходит в auto-credit → учитель видит сигнал/уведомление.

---

## 10) Notes для агента (важные ограничения)
- Не ломать слои `app/` (тонкие страницы), логика в `features/`, запросы в `lib/api/`.

---

## 11) Tech Debt / Notes (event log)
- Сейчас `actorRole` хранится внутри `payload` событий в `domain_event_log`.
- Причина: в таблице `domain_event_log` нет отдельной колонки `actor_role`.
- Намерение: вынести `actor_role` в отдельное поле (DEC + миграция) в одном из следующих слайсов **не в VS‑03**,
  чтобы `payload` оставался только доменным.
- Миграционный эффект: исторические записи остаются валидными; при выносе — заполнить `actor_role` из `payload`
  по best‑effort.
- Не добавлять “прогресс по юниту/анлок” — это VS-04.
- Не делать фото-ревью — это VS-05.
- Не добавлять новые сущности “на будущее”, кроме строго необходимых для VS-03.
- Любые изменения документации в `documents/` — только если пользователь явно попросил (обычно нет).

---
Конец документа.
