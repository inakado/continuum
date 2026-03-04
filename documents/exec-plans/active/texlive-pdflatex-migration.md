# TeX Live + pdflatex Migration

Статус: `Active`

## Цель и контекст

- Полностью убрать `tectonic` из backend runtime.
- Перевести PDF compile path на `TeX Live + pdflatex`.
- Перевести TikZ HTML asset path на `pdflatex --output-format=dvi + dvisvgm`.
- Сохранить текущие HTTP contracts, storage contracts и frontend UX.

## Scope

- runtime package `packages/latex-runtime`
- `apps/api` debug compile migration
- `apps/worker` PDF compile migration
- `apps/worker` HTML/TikZ migration
- Docker/compose/env cleanup
- SoR-документация и финальные проверки

## Out of Scope

- frontend изменения
- массовый backfill старых артефактов
- shell-escape и внешний toolchain
- PNG/raster fallback для TikZ

## Decision Log

- canonical engine: `pdflatex`
- shell-escape запрещён
- source compatibility: strict `pdflatex`
- старые артефакты живут до следующей ручной compile
- API debug compile path сохраняется
- `tectonic` удаляется полностью, без dual-runtime в production

## Этапы

1. Вынести shared runtime в `packages/latex-runtime`.
2. Удалить `tectonic`-specific fallback logic и внедрить strict pdflatex boundary.
3. Перевести PDF compile в `api` и `worker`.
4. Перевести TikZ HTML renderer на DVI path.
5. Обновить Docker/compose/env.
6. Обновить SoR-доки.
7. Прогнать backend acceptance в конце.

## Риски

- рост Docker image size и build time из-за `texlive-full`
- регрессии у старых XeTeX/Unicode source
- возможные отличия `pdflatex` output от текущего `tectonic` path
- `\vec` в TikZ может остаться нерешённым даже после classic DVI path

## Acceptance

- в `api` и `worker` больше нет `tectonic`
- PDF compile идёт через `pdflatex`
- TikZ SVG assets идут через DVI path
- HTTP contracts не изменены
- старые артефакты не удаляются автоматически
- SoR и runbook обновлены

## Progress Log

- 2026-03-04: execution plan создан, начата реализация runtime foundation.
- 2026-03-04: добавлен shared runtime package `packages/latex-runtime`; PDF compile в `api` и `worker` переведён на `pdflatex`, TikZ asset path переведён на `pdflatex --output-format=dvi -> dvisvgm`.
- 2026-03-04: `apps/api` и `apps/worker` Docker images переведены на Debian + `TeX Live`; `tectonic` удалён из runtime contour, compose/runbook обновлены.
- 2026-03-04: dev bootstrap скорректирован на non-interactive `pnpm install --force`, чтобы container startup не зависал на stale workspace volumes после добавления `packages/latex-runtime`.
- 2026-03-04: миграционный contour поднят локально; `api /health = 200`, `worker` стартует на новом runtime и принимает compile jobs.

## Текущее состояние

- Backend runtime migration функционально внедрена:
  - `tectonic` удалён из `api` и `worker`;
  - compile policy и Docker contour работают через `TeX Live + pdflatex`;
  - TikZ HTML assets собираются через DVI path;
  - HTTP contracts и frontend transport shape не менялись.
- На реальном teacher corpus migration уже выявила и закрыла несколько runtime/adapter defects:
  - stale workspace install в dev containers;
  - `documentclass/chapter` incompatibility в TikZ standalone wrapper;
  - runtime crash из-за устаревшего helper name `summarizeOutput`.
- Оставшиеся проблемы сейчас относятся не к cutover runtime, а к качеству HTML/TikZ fidelity на реальном content corpus. Они зафиксированы как отдельный техдолг, а не как rollback-issue миграции.
