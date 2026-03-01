# DESIGN

Статус: `Draft` (источник истины — код).

## Назначение

Высокоуровневые продуктовые и UX-инварианты, влияющие на системные решения.

## Invariants (`Implemented`, verified in code)

### Закрытая система (no public signup)

- Пользователей создаёт teacher; публичной регистрации нет.

### Иерархическая видимость draft/published

- Student видит только published контент по цепочке `Course → Section → Unit → Task`.
- Любой draft в родителях скрывает дочерние сущности для student views.

### Unpublish = “объекта нет”

- При `unpublish` объект пропадает из student UI и не должен учитываться в прогрессе и метриках.

### Два режима проверки задач

- Auto-check (`numeric`, `single_choice`, `multi_choice`).
- Manual review (`photo`) — решение принимает lead teacher студента.

### Прогресс: две метрики

- `completionPercent` и `solvedPercent` — разные метрики и должны отображаться и интерпретироваться отдельно.

## Source Links

- Published-only queries:
  - `apps/api/src/content/content.service.ts`
  - `apps/api/src/content/content-write.service.ts`
  - `apps/api/src/learning/learning.service.ts`
  - `apps/api/src/learning/learning-attempts-write.service.ts`
- Photo review policy:
  - `apps/api/src/learning/photo-task.service.ts`
  - `apps/api/src/learning/photo-task-read.service.ts`
  - `apps/api/src/learning/photo-task-review-write.service.ts`
- Unit progress snapshots:
  - `apps/api/src/learning/learning-availability.service.ts`
