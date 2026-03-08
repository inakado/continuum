# Task Solution HTML Render

Статус: `Completed` (2026-03-06)

## Цель и контекст

Перевести `task_solution` с PDF-only на backend `LaTeX -> HTML` read-path в teacher/student интерфейсах,
используя тот же стабильный pipeline, который уже применяется для unit `theory/method`.

## Scope

- миграция compile/apply/read path для `task_solution` на HTML артефакты;
- добавление `rendered-content` endpoints для teacher/student решения задачи;
- удаление legacy `.../solution/pdf-presign` endpoints и связанных web API вызовов;
- обновление web UI (teacher preview + student solution panel) на HTML render;
- обновление тестов и SoR-документов.

## Out of Scope

- массовый backfill старых task revisions без HTML (используется on-demand compile);
- удаление legacy `solutionPdfAssetKey` из БД в этой волне.

## Решения

- legacy задачи без HTML остаются в состоянии «решение не подготовлено» до новой компиляции teacher;
- `solutionPdfAssetKey` сохраняется как legacy поле, но больше не используется новым task-solution read-path;
- stale protection остаётся timestamp-based через versioned asset keys.

## Порядок выполнения

1. DB/schema + runtime контракты (`TaskRevision` HTML fields, queue/result contracts).
2. Worker compile/apply path для `task_solution` (HTML + assets).
3. API read-path (`teacher/student task rendered-content`) и удаление PDF-presign endpoints.
4. Web API clients, hooks и UI для teacher/student task solution HTML.
5. Тесты (api/web), затем SoR docs.

## Риски

- regressions в apply-flow при смешении старого `solutionPdfAssetKey` и нового `solutionHtmlAssetKey`;
- частичная миграция web-path (если пропустить один consumer старого pdf endpoint);
- различия в UI-стилизации HTML solution vs unit HTML.

## Проверки

- целевые integration tests API для compile/apply/rendered-content;
- целевые web tests для teacher/student task solution flows;
- локальный smoke teacher compile -> student open solution.

## Progress Log

- 2026-03-05: создан active execution plan, старт реализации.
- 2026-03-05: добавлены поля `TaskRevision.solutionHtmlAssetKey|solutionHtmlAssetsJson` + prisma migration.
- 2026-03-05: worker compile/apply path для `task_solution` переведён на HTML artifacts (`assetKey` = html key, `htmlAssets` в result).
- 2026-03-05: добавлены endpoints `GET /teacher/tasks/:taskId/solution/rendered-content` и `GET /student/tasks/:taskId/solution/rendered-content`; legacy `.../solution/pdf-presign` удалён.
- 2026-03-05: web student/teacher preview решения задачи переведён на HTML render path + MathJax typeset.
- 2026-03-05: обновлены api/web тесты и SoR-документы под `TaskSolutionHtmlCompiled` и HTML-only task solution path.

## Decision Log

- 2026-03-05: выбран on-demand путь для legacy task revisions без backfill.
- 2026-03-05: legacy `.../solution/pdf-presign` удаляется в этой волне.

## Финальное состояние

- migration `task_solution` на backend HTML render path завершена;
- legacy `.../solution/pdf-presign` удалён из API/web read-path;
- SoR-документы и тестовый контур обновлены под `TaskSolutionHtmlCompiled`.
