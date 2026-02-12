# VERTICAL-SLICE-VS-04.md
Проект: **Континуум**  
Слайс: **VS-04 — Unit Progress v1 + Required Gates + Completed Unit + Unlock AND (внутри раздела)**  
Назначение документа: дать агенту “картину целиком” по VS-04 (что и в каком порядке делаем), без глубоких деталей реализации.  
Принцип: **сначала backend/контракты, затем UI/UX**. Без “потом доделаем” — делаем боевой контур, но в рамках scope.

---

## 0) Перед началом (обязательно)
**Агент должен:**
1) Открыть `documents/DOCS-INDEX.md` и выбрать релевантные документы под задачу (минимально достаточные).
2) Для VS-04 обычно нужны: `ARCHITECTURE.md`, `ER-MODEL.md`, `DECISIONS.md`, `DOMAIN-EVENTS.md`, `HANDLER-MAP.md`, `VERTICAL-SLICE-VS-04.md` (этот файл).
3) Работать строго в стиле проекта: **тонкие страницы** (Next app), логика в `features/*`, запросы в `lib/api/*`, стиль по `DESIGN-SYSTEM.md`.

---

## 1) Цель VS-04
Внедрить “смыслы обучения” на уровне **юнита и графа внутри раздела**:
- Две метрики прогресса (Completion% и Solved%).
- Required-гейты (обязательные задачи) как жёсткое условие.
- Статусы юнита для ученика: `locked / available / in_progress / completed`.
- Разблокировка следующих юнитов по графу: **AND** по всем prereq-юнитам.
- Запрет доступа в locked-юнит по прямому URL (backend enforcement).

---

## 2) Термины и определения
### 2.1 Метрики прогресса (две разные)
**Unit Completion %** = `counted_tasks / total_tasks`  
- `counted_tasks` увеличивается при статусах задачи:
  - `correct`
  - `credited_without_progress`
  - `teacher_credited` (может существовать уже; засчитываем в counted)
- `total_tasks` — количество опубликованных задач активной ревизии в юните (для ученика).

**Task Solved %** = `solved_tasks / total_tasks`  
- `solved_tasks` увеличивается при:
  - `correct`
  - `teacher_credited`
  - (в будущем: `accepted` для photo в VS-05)

Важно: **Completion% != Solved%** возможно и должно быть видно (особенно при `credited_without_progress`).

### 2.2 Required-гейты (обязательные задачи)
- На уровне юнита есть список required-задач.
- Required-задачи:
  - входят в `counted_tasks` (если засчитаны),
  - но главное: они **жёсткий гейт** для `completed`:
    - пока required не засчитаны (correct / credited_without_progress / teacher_credited), юнит не считается completed, даже если completion% высокий.

### 2.3 Порог юнита
- Хранится в Unit: `minCountedTasksToComplete`.
- Юнит может стать `completed` только если:
  1) required-гейты выполнены,
  2) `counted_tasks >= minCountedTasksToComplete`.

### 2.4 Статусы юнита (student-facing)
- `locked` — не выполнены prerequisites (AND по ребрам графа) → переход запрещён.
- `available` — все prerequisites completed (или нет prereqs).
- `in_progress` — строго при первом attempt в любой задаче юнита (уже появилось в VS-03, нужно синхронизировать).
- `completed` — условия выполнены (required + minCounted).

Переходы статусов:
- locked → available (когда все prereq completed)
- available → in_progress (при первом attempt)
- in_progress → completed (когда выполнены условия)
- completed остаётся completed (пока не появятся механики отката/ревизий — отдельно обсудим в будущих слайсах)

---

## 3) Scope (что входит)
### A) Backend/DB/Domain
1) Добавить в Unit:
   - `minCountedTasksToComplete` (int, default 0)
   - `requiredTaskIds` (список ссылок/таблица связей; выбор реализации за агентом, но должно быть удобно изменять в UI)
2) Ввести/зафиксировать вычисление unit progress:
   - `counted_tasks`, `solved_tasks`, `total_tasks`
   - `completionPercent`, `solvedPercent`
3) Реализовать статус юнита для ученика:
   - `locked/available/in_progress/completed`
4) Реализовать unlock AND в section graph:
   - для student graph отдавать per-node status + 2 процента.
5) Enforce доступ:
   - GET `/student/units/:id` (или текущий student unit endpoint) должен запрещать доступ к locked:
     - рекомендовано: `409 { code: "UNIT_LOCKED" }`
   - draft/published правило остаётся: draft-родитель скрывает всё (404), как в предыдущих слайсах.

### B) API/Contracts
1) Student section graph endpoint:
   - вернуть nodes с:
     - `status`
     - `completionPercent`
     - `solvedPercent`
2) Student unit view:
   - добавить агрегат прогресса юнита (2 процента + counted/solved/total по желанию)
   - возвращать признаки required-задач (нужно фронту для UX)
3) Teacher unit editor:
   - CRUD полей:
     - `minCountedTasksToComplete`
     - required задачи (выбор из задач юнита)
   - валидации:
     - minCountedTasksToComplete ≥ required_count (или отдельное правило — агент должен предложить и зафиксировать решение)
     - required могут быть только среди задач этого юнита

### C) UI/UX
1) Student graph:
   - визуализация статусов: locked/available/in_progress/completed
   - блокировка перехода в locked
   - показ 2 процентов на node (или в hover/side panel) — агент выберет UX, но оба процента должны быть доступны.
2) Student unit page:
   - показать 2 процента юнита
   - подсветка required-задач (например “обязательная”)
   - поведение “юнит completed” — очевидная отметка
3) Teacher unit editor:
   - таб/секция “Прогресс”:
     - `minCountedTasksToComplete` (input number)
     - список задач с чекбоксами required
   - максимально простая, контролируемая UX (без усложнений).

---

## 4) Вне scope (явно НЕ делаем в VS-04)
- Photo-review / accepted фото (это VS-05)
- Ручные override-открытия юнитов учителем (будет отдельный слайс; не VS-04)
- Полноценные batch/rebuild джобы/очереди пересчёта на весь раздел/всех студентов (если понадобится — только минимально необходимое)
- Новая система “пересчёта по ревизиям” глубже текущего: остаёмся на активной ревизии как в VS-03
- Мульти-курс/межраздельная разблокировка (unlock только внутри section graph)

---

## 5) Инварианты и правила (must)
1) **required не выполнены → юнит не completed**, даже если Completion% ≥ 100% по counted (например, counted_tasks набралось на необязательных).
2) **minCountedTasksToComplete достигнут + required выполнены → completed**.
3) **Unlock AND:** если у юнита несколько prereqs, и хотя бы один не completed → текущий locked.
4) **Completion% ≠ Solved%** при `credited_without_progress` (Completion растёт, Solved — нет).
5) **locked виден на графе**, но:
   - клик не открывает
   - прямой URL → backend запрет (`409 UNIT_LOCKED` рекомендовано).
6) **draft/published правило иерархии сохраняем**:
   - draft-родитель скрывает дочернее для student (404), независимо от unlock.

---

## 6) События (event log) — минимум необходимого
Агент должен ориентироваться на `DOMAIN-EVENTS.md`, но в рамках VS-04 достаточно:
- `UnitBecameAvailableForStudent` (если у вас принято фиксировать доступность)
- `UnitCompletedByStudent`
- (опционально) `UnitProgressUpdated` — если реально нужно и не раздувает лог

Важно: не логировать огромные payload’ы (как уже решили для autosave/юнит-редактора).

---

## 7) Порядок разработки (этапы VS-04)
### Step 1 — DB/Models + минимальные поля Unit
- Добавить `minCountedTasksToComplete`
- Добавить структуру required задач юнита
- Миграция, prisma generate, smoke

### Step 2 — Domain logic: unit progress + completion/solved
- Реализовать детерминированный расчёт
- Подключить к student unit view (response расширение)

### Step 3 — Unlock AND по section graph + unit statuses
- Рассчёт статуса нод на student section graph
- Backend запрет доступа в locked-юнит (409 UNIT_LOCKED)

### Step 4 — Teacher API: редактирование required + minCounted
- Endpoints + валидации + событие (если надо)

### Step 5 — UI: teacher unit editor “Progress”
- required чекбоксы + minCounted input
- сохранение через существующий PATCH unit/task механизмы

### Step 6 — UI: student graph + student unit progress
- статусы нод + блокировка перехода
- отображение 2 процентов и required задач

---

## 8) Stop-check VS-04 (обязательные сценарии)
1) Required задача не решена → юнит **не completed**, даже если counted_tasks >= minCountedTasksToComplete.
2) minCountedTasksToComplete достигнут + required выполнены → юнит **completed**.
3) AND prereq: если один prereq не completed → следующий **locked** на графе и недоступен по URL (409 UNIT_LOCKED).
4) completion% != solved% при credited_without_progress (completion растёт, solved — нет).
5) `teacher_credited` повышает и completion%, и solved% (пробел закрыт преподавателем).

---

## 9) Примечания по ошибкам/коды (для UX)
- locked unit access:
  - рекомендовано: `409` + `{ code: "UNIT_LOCKED" }`
- draft/published скрытие:
  - `404` (как уже работает в контентных эндпоинтах)
- невалидные requiredTaskIds / не из этого юнита:
  - `400` или `409` — агент выбирает единообразно и фиксирует.

---

## 10) Требования к отчётности агента (после каждого шага)
Агент обязан выдавать структурированный отчёт:
- Что найдено до правок
- Какие документы прочитал (по DOCS-INDEX) и что взял
- Что сделано
- Файлы созданы/изменены
- Ключевые решения
- Как запустить и проверить
- STOP-CHECK результаты (факт)
- Риски/заметки (только если важно)
- STOP (ждёт “готово” или баг-репорт)

---
