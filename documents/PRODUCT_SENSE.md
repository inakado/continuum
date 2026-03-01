# PRODUCT_SENSE

Статус: `Draft` (источник истины — код).

## Назначение

Фиксировать продуктовые эвристики и приоритизацию, чтобы агент принимал решения согласованно.

## Core User Value (`Implemented`, current)

### Teacher value

- Быстро создавать и публиковать контент (`course/section/unit/task`).
- Видеть прогресс учеников, блокировки, required skips и очередь фото-проверки.

### Student value

- Проходить юниты по понятным правилам unlock.
- Получать чёткий feedback по задачам: решено, не решено, заблокировано, нужна фото-проверка.

## Decision Heuristics

- Корректность доменных инвариантов важнее локального ускорения UI.
- Любые изменения в unlock/progress считаются high-risk и требуют plan + decision log.
- API/DB контракты важнее “красоты” документации: доки подгоняются под код, а не наоборот.

## Product Regressions

- Student видит непубликованный контент.
- Unlock открывает юнит раньше, чем выполнены prereq, без override.
- Photo review доступна не lead teacher.
- Проценты и счётчики прогресса скачут из-за drift между кодом и persisted state.

## Source Links

- `documents/ARCHITECTURE.md`
- `apps/api/src/learning/learning-availability.service.ts`
- `apps/api/src/learning/photo-task-read.service.ts`
- `apps/api/src/learning/photo-task-review-write.service.ts`
