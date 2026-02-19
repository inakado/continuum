# PRODUCT_SENSE

Статус: `Draft` (источник истины — код).

## Назначение

Фиксировать продуктовые эвристики и приоритизацию, чтобы агент принимал решения согласованно.

## Core user value (`Implemented`, current)

### Teacher value

- Быстро создавать/обновлять контент (course/section/unit/task) и публиковать его.
- Видеть прогресс учеников, “слабые места” (required skipped, блокировки) и очередь фото-проверки.

### Student value

- Проходить юниты по понятным правилам unlock (граф prereq + правила completion).
- Получать чёткий feedback по задачам: решено/не решено/заблокировано/нужна фото-проверка.

## Decision heuristics (`Planned`)

- Speed vs correctness: по умолчанию предпочитаем корректность доменных инвариантов (Learning progression) над ускорением UI.
- Любые изменения в unlock/progress считаются high-risk и требуют план/decision log.
- API/DB контракты важнее “красоты” документации: доки подгоняем под код.

## Product regressions (`Planned`)

- Student видит непубликованный контент.
- Unlock открывает юнит раньше, чем выполнены prereq (без override).
- Photo review доступна не lead teacher.
- Проценты/счётчики прогресса скачут из-за drift между кодом и persisted state.

## Source links

- `documents/ARCHITECTURE.md`
- `apps/api/src/learning/learning-availability.service.ts`
- `apps/api/src/learning/photo-task.service.ts`
