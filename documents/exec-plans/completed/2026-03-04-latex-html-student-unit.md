# LATEX HTML Student Unit

Статус: `Completed`

## Цель и контекст

- Добавить student-render path `LaTeX -> HTML` для unit-вкладок `theory` и `method`.
- Сохранить текущий `LaTeX -> PDF` pipeline для скачивания и legacy fallback.
- Встроить решение в существующие BC `Content / Learning / Rendering / Files & Assets` без фронтенд-компиляции.

## Фактический scope

- новые html asset fields в `Unit`
- dual-render unit compile job (`pdf + html`)
- student endpoint `GET /units/:id/rendered-content`
- student web HTML panel с legacy PDF fallback
- teacher endpoint `GET /teacher/units/:id/rendered-content`
- teacher preview tabs `PDF / HTML`
- SoR-документация по новому render path

## Out of Scope

- `task_solution` HTML render
- массовый backfill старых published unit
- отдельный classic DVI renderer для TikZ figures

## Итог реализации

- `Unit` расширен html asset keys и html asset manifests для `theory/method`.
- Unit compile публикует согласованную пару артефактов `PDF + HTML`.
- Student `theory/method` primary read-path переведён на backend `rendered-content` endpoint.
- При отсутствии HTML web остаётся на legacy PDF fallback.
- Teacher unit editor получил HTML preview в том же preview container, что и PDF preview.
- HTML panel использует локальный MathJax runtime и отдельный content-skin для long-form контента.

## Decision Log

- HTML хранится в object storage, а не в DB.
- Student и teacher получают уже подписанный HTML fragment, а не raw HTML asset URL.
- Legacy unit без HTML продолжают открываться через PDF fallback.
- Teacher preview в первой версии должен был остаться PDF-only, но фактически HTML preview был добавлен в ту же волну, потому что это дало быстрый способ верифицировать output renderer на реальном teacher flow.
- TikZ HTML assets в финальном результате волны оставлены на `tectonic --outfmt xdv -> dvisvgm --font-format=woff`.

## Отклонения и проблемы

- Во время реализации были проверены альтернативные TikZ asset paths:
  - `dvisvgm --no-fonts`
  - `pdftocairo -svg`
  - `pdftocairo -png`
- Эти ветки не вошли в финальный runtime:
  - `--no-fonts` дал битые glyph references в текущем XDV contour;
  - `pdftocairo -svg` терял геометрию части TikZ figures;
  - `png` fallback был признан временным отклонением и откатан.
- Известный unresolved issue:
  - math accent-команды вида `\vec{...}` в TikZ labels могут рендериться браузером некорректно.
  - Этот хвост вынесен в `documents/exec-plans/tech-debt-tracker.md` как `TD-004`.

## Проверки

- `pnpm --filter web typecheck`
- `pnpm --filter @continuum/worker test -- render-latex-to-html.test.ts`
- `pnpm exec vitest run --config vitest.config.ts features/teacher-content/units/hooks/use-teacher-unit-rendered-content.test.tsx features/teacher-content/units/TeacherUnitDetailScreen.test.tsx` в `apps/web`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec vitest run --config vitest.integration.config.ts test/integration/teacher-unit-rendered-content.integration.test.ts"`
- `docker compose up -d --build worker`
- миграция `20260304123000_unit_html_render_assets`

## Связанные SoR-обновления

- `documents/CONTENT.md`
- `documents/FRONTEND.md`
- `documents/DESIGN-SYSTEM.md`
- `documents/RELIABILITY.md`
- `documents/SECURITY.md`
- `documents/DEVELOPMENT.md`

## Следующий шаг

- Отдельной инициативой исследовать classic DVI figure renderer или selective raster fallback для TikZ blocks с accent-макросами.
