# DESIGN

Статус: `Draft` (источник истины — код).

## Назначение

Высокоуровневые продуктовые и UX-принципы, влияющие на системные решения.

## Invariants (`Implemented`, verified in code)

### Закрытая система (no public signup)

- Пользователей создаёт teacher; публичной регистрации нет.

### Иерархическая видимость draft/published

- Student видит только published контент по цепочке `Course → Section → Unit → Task`.
- Любой draft в родителях скрывает дочерние сущности для student views.

### Unpublish = “объекта нет”

- При `unpublish` объект пропадает из student UI и не должен учитываться в прогрессе/метриках (история attempts/events остаётся).

### Два режима проверки задач

- Auto-check (numeric/single_choice/multi_choice).
- Manual review (photo) — решения принимает lead teacher студента.

### Прогресс: две метрики

- `completionPercent` и `solvedPercent` — разные метрики и должны отображаться/интерпретироваться отдельно (см. Learning availability).

## Planned / TODO

- Явные UX-джорни teacher/student (happy path + error/empty).
- Принципы “что считается регрессией” на уровне UI/UX.
- Визуальные и interaction principles (когда стабилизируем дизайн-систему).

## Source links

- Published-only queries:
  - `apps/api/src/content/content.service.ts`
  - `apps/api/src/learning/learning.service.ts`
- Photo review policy:
  - `apps/api/src/learning/photo-task.service.ts`
- Unit progress snapshots:
  - `apps/api/src/learning/learning-availability.service.ts`
