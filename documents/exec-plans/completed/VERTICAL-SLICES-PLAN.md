# VERTICAL-SLICES-PLAN (legacy)
Статус: `Archived` (migrated execution plan; source of truth — code).

> Этот документ перемещён из `documents/` в `documents/exec-plans/completed/` (plans are first-class artifacts).
Проект: «Континуум»  
Назначение: подробный план разработки вертикальных слайсов **начиная с VS-03**, чтобы держать общую картину и не терять порядок/границы.  
Принцип: каждый VS — end-to-end, минимально достаточный “боевой” функционал, без добавления фич вне требований.

---

## VS-03 — Learning Core v1: Students + Attempts + Shuffling + Task Statuses + 3+3 + Notifications (без фото-ревью)
**Цель:** превратить “контент есть” в “ученик реально решает задачи”, с корректными статусами, попытками, блокировкой, auto-credit после 6, уведомлениями учителю и учетом required-гейтов.  
**Также включает:** управление учениками (создание/привязка/передача), и **shuffle вариантов на фронте**.

### Scope (что делаем)
#### A) Ученики: создание и привязки
- Teacher UI: раздел **«Ученики»**
  - Создать ученика:
    - поля: `login` (ввод или генерация), `password` (автогенерация), `leaderTeacherId` = тот, кто создал.
    - показать учителю сгенерированный пароль **1 раз** (и дать “скопировать”).
  - Reset password:
    - генерируем новый пароль, показываем 1 раз.
  - Передача ученика другому учителю:
    - смена `leaderTeacherId` (прогресс сохраняется).
    - важно: с момента передачи **проверяет фото** новый ведущий (фото будет в VS-05, но привязка нужна уже сейчас).

**API (Teacher-only)**
- `POST /teacher/students` (create; генерить пароль на бэке можно, но UI должен получить plaintext один раз)
- `POST /teacher/students/:id/reset-password`
- `PATCH /teacher/students/:id/transfer` (leaderTeacherId)
- `GET /teacher/students` (list/search)

**Данные**
- `StudentProfile`/`Student` сущность (если ещё нет) + связь на `User` (role=student)  
- связь `student.leaderTeacherId -> User(id, role=teacher)`
- хранение пароля: только hash (argon2), plaintext не сохраняем.

#### B) Механика Attempts (numeric/single/multi), статусы задач и хранение попыток
- Вводим сущности:
  - `Attempt` (на каждую попытку)
  - `TaskProgress` (агрегатное состояние по задаче для ученика и активной ревизии)
- Поддерживаем типы:
  - `numeric` (numeric_parts)
  - `single_choice`
  - `multi_choice`
- `photo` пока **не решаем** (будет VS-05). В VS-03: задача типа photo в юните отображается, но попытки по ней не принимаются (или API вернёт 409/422 “not supported yet”).

**Task Statuses (у ученика)**
- `not_started`
- `in_progress` (строго при первом Attempt — ты подтвердил)
- `correct` (для auto-check)
- `blocked` (после 3-й неправильной попытки)
- `credited_without_progress` (после 6-й неправильной попытки — auto-close)
- + отдельный флаг: `is_required_skipped` (или аналог) — “пропущена обязательная” (ставится если required ушла в auto-credit)

**API (Student)**
- `POST /student/tasks/:taskId/attempts`
  - body зависит от типа
  - ответ: текущий статус, детали (в т.ч. какие numeric parts верны), blockedUntil, attemptNo
- `GET /student/units/:unitId` (добавить в ответ прогресс по задачам: status, attemptsUsed, blockedUntil и т.п.)

**Правила попыток 3+3**
- Счётчики **по актуальной ревизии** задачи.
- После **3 неправильных**:
  - ставим блокировку по задаче (blockedUntil = now + X минут), X = курс-уровень (глобально в курсе).
  - ученик при раннем вводе видит “можно будет через Y”.
- После **6 неправильных**:
  - переводим задачу в `credited_without_progress` (counted, но не solved)
  - попытки больше не принимаются (кроме действий учителя в будущем VS-07)
  - показываем решение/ответ по правилам (UI логика показа)
  - если required — ставим флаг “пропущена обязательная” + уведомление учителю

**Шафл вариантов (front-end only)**
- Backend хранит choices в фиксированном порядке, как сейчас (ключи).
- Front-end:
  - на рендере single/multi делаем shuffle массива вариантов
  - важно: сабмитим **ключи** выбранных вариантов (не индекс), чтобы shuffle не ломал проверку
  - чтобы ученик не “перебирал по памяти”: shuffle должен быть при каждом открытии задачи/перерисовке (разумно: при монтировании задачи + при reset состояния).

#### C) Progress: минимально достаточный для unlock в следующих VS
В VS-03 мы пока НЕ внедряем полную систему unlock/completion/solved процентов по юниту как основание для графа (это VS-04), но:
- уже сейчас считаем и сохраняем per-task:
  - counted? (credited_without_progress или correct)
  - solved? (correct)
- готовим почву для VS-04.

#### D) Уведомления учителю (внутрисистемные)
В рамках VS-03 вводим минимальный “notifications” слой, без телеграма:
- событие/уведомление: `RequiredTaskAutoCredited` (required + auto-credit)  
- событие/уведомление: `TaskBlocked` (после 3 ошибок; опционально показывать ученику и писать в журнал)
- где показывать:
  - teacher dashboard (простая лента/индикатор в разделе “Ученики” или “События/Уведомления”)

**Важно**
- уведомления — отдельная таблица или как запись в event log + отдельная выборка “требует внимания” (решение на проекте: допускается упростить, но должно быть удобно учителю).

### UI scope (что должно появиться)
- Teacher:
  - Sidebar пункт **«Ученики»**
  - список учеников + create + reset password + transfer
  - в карточке ученика: минимальные индикаторы (например: сколько required авто-пропущено)
- Student:
  - Unit → вкладка “Задачи”: **настоящая форма ответа**
  - статус задачи, номер попытки, блокировка с таймером
  - показ решения:
    - только после correct
    - или после credited_without_progress

### Stop-check VS-03 (минимум)
1) Teacher создаёт ученика → student может логиниться (cookie auth)  
2) Student решает single/multi → shuffle работает (ключи проверяются корректно)  
3) Student делает 3 ошибки → blockedUntil → ранний submit даёт “подождите Y”  
4) Student делает 6 ошибок → credited_without_progress, решение показано, required → уведомление teacher

---

## VS-04 — Unit Progress v1 + Required Gates + Completed Unit + Unlock AND (внутри раздела)
**Цель:** внедрить “смыслы обучения” на уровне юнита и графа: два процента, required-гейты, completed, unlock.

### Scope
#### A) Две метрики прогресса (по требованиям)
- **Unit Completion %** = counted_tasks / total_tasks
  - counted_tasks растёт при:
    - solved_correct
    - credited_without_progress
    - teacher_credited (в будущем VS-07)
- **Task Solved %** = solved_tasks / total_tasks
  - solved_tasks растёт только при:
    - correct (и accepted фото в VS-05)

#### B) Порог “минимальное количество учтённых задач”
- хранится в Unit (как ты подтвердил): `minCountedTasksToComplete`
- required задачи входят в counted и одновременно остаются жёстким гейтом:
  - пока required не correct/accepted или не auto-credit после 6 → юнит не считается выполненным для допуска

#### C) Unit status для ученика
- locked / available / in_progress / completed
- in_progress: при первом attempt в любой задаче (это уже VS-03)
- completed: когда выполнены условия из требований (required gates + minCountedTasksToComplete)

#### D) Unlock следующего юнита по графу (AND prereqs)
- граф только внутри раздела (уже есть)
- доступность юнита: AND по всем prereq-юнитам
- ручной override пока не трогаем (VS-07)

### API/UI
- student section graph отдаёт:
  - node status
  - completion% + solved% (оба)
- student unit view показывает прогресс по юниту и задачам
- teacher unit editor позволяет задавать:
  - required tasks
  - minCountedTasksToComplete

### Stop-check VS-04
1) required задача не решена → юнит не completed даже если % высок  
2) minCountedTasksToComplete достигается → completed  
3) AND prereq: если один prereq не completed → следующий locked  
4) completion% != solved% при credited_without_progress

---

## VS-05 — Photo Tasks v1: Upload → Pending Review → Leader Teacher Review
**Цель:** фото-задачи как отдельная ветка: pending_review, проверка только ведущим, unlimited retries, rejection не увеличивает ошибки.

### Scope
- student:
  - upload нескольких фото
  - создание попытки с result=pending_review
  - просмотр статусов pending/accepted/rejected
- teacher (только leaderTeacher):
  - очередь pending
  - решение accepted/rejected + optional comment
- правила:
  - rejected не увеличивает счётчик ошибок, блокировок нет
  - пока pending → задача не counted/solved
  - попытки фото безлимитны
- интеграция с прогрессом/Unlock:
  - pending required фото блокирует completed/unlock

### Хранилище
- файлы в S3, доступ через signed URLs через backend

### Stop-check VS-05
1) student отправляет фото → pending у teacher (leader)  
2) другой teacher не видит/не может принять  
3) rejected → студент может пересдать без лимитов  
4) accepted → task solved + counted

---

## VS-06 — Task Revisions v1: “любой edit = новая ревизия”, зачёты сохраняются
**Цель:** консистентность при редактировании: “если засчитано — остаётся засчитанным”, но attempts и блокировки — по активной ревизии.

### Scope
- модель ревизии:
  - любая правка → новая revisionId (ты подтвердил)
- storage:
  - current revision у Task
  - Attempt/TaskProgress привязывается к revisionId
- правило:
  - если задача уже counted/solved у ученика на старой ревизии → остаётся counted/solved
  - но попытки/blockedUntil/auto-credit считаем только по активной ревизии (если задача ещё не засчитана)

### UI
- teacher при изменении задачи должен явно видеть что “создаётся новая ревизия”
- ученик — прозрачно (просто решает актуальную)

### Stop-check VS-06
1) ученик решил задачу → teacher редактирует → задача остаётся решённой для ученика  
2) ученик НЕ решил → teacher редактирует → попытки сбрасываются на новую ревизию  
3) блокировки/6 ошибок относятся к active revision

---

## VS-07 — Teacher Overrides + Teacher Credit + Manual Actions
**Цель:** ручное управление преподавателя поверх автоматики.

### Scope
- Override unit open (навсегда)
- Teacher credit task:
  - перевести `credited_without_progress` → `teacher_credited` (увеличивает solved%)
  - можно зачесть “в любой момент” (ты подтвердил)
- (если решим) снять блокировку или дать ещё попытки — только если явно зафиксируем в DEC, иначе вне scope

### UI
- teacher: кнопки в профиле ученика/юнита/задачи

### Stop-check VS-07
1) override открывает юнит навсегда (не отзывается)  
2) teacher_credited увеличивает solved% и меняет статус задачи

---

## VS-08 — Concepts + Search (Teacher + Student)
**Цель:** навигация по понятиям и поиск.

### Scope
- сущности:
  - Concept, ConceptAlias (или aliases JSON), UnitConcept m:n
- teacher:
  - редактирование понятий в unit editor
  - поиск по понятиям для тестирования (ты попросил)
- student:
  - поиск по опубликованному контенту
  - выдача unit list с цепочкой “курс→раздел→юнит” + статус доступности

### Stop-check VS-08
1) поиск по алиасу находит нужные юниты  
2) draft родители скрывают результаты  
3) в выдаче видны статусы locked/available

---

## VS-09 — Rich LaTeX Pipeline: Tectonic Worker + S3 PDFs + Custom PDF Render
**Цель:** “боевой” рендер теории/методики/решений: асинхронная компиляция, статус, лог ошибок, хранение PDF в S3, показ без browser PDF viewer UI.

### Scope
- RenderJob queue:
  - entity_type: unit_theory / unit_method / task_solution
  - status: idle|rendering|ok|error
  - error_log
  - pdf_asset_key
- Worker:
  - Tectonic compile → upload to S3 → update job
- Web:
  - teacher: кнопка “Собрать/Preview”, статус и лог
  - student: отображение PDF как “страница” (PDF.js canvas/text layer или server images)
- security:
  - signed URLs

### Stop-check VS-09
1) teacher отправляет compile → rendering → ok/error  
2) pdf отображается без viewer UI  
3) ошибка компиляции показывает лог

---

## VS-10 — Analytics + Advanced Audit/Event Views
**Цель:** дашборды качества обучения и событийность “по категориям” (admin/learning/system), фильтры.

### Scope
- агрегаты:
  - “дошли до юнита”
  - средние completion/solved
  - топ задач: ошибки, auto-credit, pending/rejected (если VS-05 уже есть)
- фильтры:
  - по teacher, student, периоду
- events log:
  - учебные события (attempted, blocked, auto-credited, unit completed, override и т.д.)
  - UI фильтрации по категории

### Stop-check VS-10
1) аналитика на тестовых данных показывает корректные числа  
2) фильтры работают  
3) журнал событий фильтруется по категориям

---

## Примечания по порядку
- VS-03 → VS-04 идут подряд, потому что VS-04 опирается на attempts и counted/solved.
- VS-05 (photo) лучше до VS-06 (revisions), чтобы ревизии учитывали и фото-ветку тоже.
- VS-09 (latex pipeline) можно параллелить раньше, но лучше после устойчивой модели Unit/Task/Revision, чтобы не переделывать RenderJob привязки.

---
Конец документа.
