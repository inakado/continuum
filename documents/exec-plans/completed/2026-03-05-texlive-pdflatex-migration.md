# TeX Live + pdflatex Migration

Статус: `Completed` (2026-03-05)

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

## Итог

- `tectonic` полностью удалён из backend runtime contour.
- Компиляция PDF переведена на `TeX Live + pdflatex`.
- TikZ HTML assets переведены на `pdflatex --output-format=dvi -> dvisvgm`.
- TeX runtime оставлен только в `worker`; `api` работает как queue/read/apply orchestration.
- Публичные HTTP contracts для compile/read-path не менялись.

## Decision Log (final)

- canonical engine: `pdflatex`
- shell-escape запрещён
- source compatibility: strict `pdflatex`
- старые артефакты живут до следующей ручной compile
- debug compile path сохраняется как queue-orchestration (`api` не компилирует локально)
- TeX runtime остаётся только в `worker`, `api` образ без TeX toolchain
- `tectonic` удаляется полностью, без dual-runtime в production

## Acceptance (final)

- [x] в `api` и `worker` больше нет `tectonic`
- [x] PDF compile идёт через `pdflatex`
- [x] TikZ SVG assets идут через DVI path
- [x] HTTP contracts не изменены
- [x] старые артефакты не удаляются автоматически
- [x] SoR и runbook обновлены

## Риски

- рост Docker image size и build time из-за `texlive-full`
- регрессии у старых XeTeX/Unicode source
- возможные отличия `pdflatex` output от текущего `tectonic` path
- `\vec` в TikZ может остаться нерешённым даже после classic DVI path

## Проверка соответствия ARCHITECTURE-PRINCIPLES

- `P1 (SRP + complexity budget)`:
  - runtime-ядро вынесено в `packages/latex-runtime`;
  - compile responsibility отделена от API orchestration.
- `P3 (Fail-fast boundary validation)`:
  - strict `pdflatex` compatibility policy;
  - fail-fast reject для unsupported preamble/команд.
- `P4 (Read/write separation)`:
  - API compile/read/apply path отделён от worker compile execution;
  - debug compile в API не выполняет локальную сборку.
- `P7 (Policy-as-code)`:
  - runtime policy (passes, timeout, compatibility constraints) централизована в shared runtime helper.
- `P8 (Convention over duplication)`:
  - общий runtime package используется в `api` и `worker` вместо дублирования compile logic.
- `P9 (Server-state discipline)`:
  - web read-path для rendered-content опирается на React Query hooks.
- `P10 (Effect isolation)`:
  - math/render side-effects вынесены в helper/hook слой, UI-панели остаются декларативными.
- Осознанных отклонений от принципов в рамках этой инициативы не зафиксировано.

## Progress Log

- 2026-03-04: execution plan создан, начата реализация runtime foundation.
- 2026-03-04: добавлен shared runtime package `packages/latex-runtime`; PDF compile в `api` и `worker` переведён на `pdflatex`, TikZ asset path переведён на `pdflatex --output-format=dvi -> dvisvgm`.
- 2026-03-04: `apps/api` и `apps/worker` Docker images переведены на Debian + `TeX Live`; `tectonic` удалён из runtime contour, compose/runbook обновлены.
- 2026-03-04: dev bootstrap скорректирован на non-interactive `pnpm install --force`, чтобы container startup не зависал на stale workspace volumes после добавления `packages/latex-runtime`.
- 2026-03-04: миграционный contour поднят локально; `api /health = 200`, `worker` стартует на новом runtime и принимает compile jobs.
- 2026-03-05: debug compile endpoint (`POST /teacher/debug/latex/compile-and-upload`) переведён на постановку job в `latex.compile`; статус/debug preview читается через `GET /teacher/latex/jobs/:jobId`.
- 2026-03-05: из `api` удалён локальный compile service/module; apply endpoint явно отклоняет debug jobs (`LATEX_JOB_APPLY_UNSUPPORTED`), а worker пропускает auto-apply для debug target.
- 2026-03-05: `apps/api` Dockerfile очищен от TeX runtime; TeX binaries оставлены только в `worker`.
- 2026-03-05: план переведён в `completed`; SoR/docs синхронизированы с фактическим runtime contour.

## Финальное состояние

- Backend runtime migration функционально внедрена:
  - `tectonic` удалён из runtime contour;
  - compile policy работает через `TeX Live + pdflatex`;
  - TeX runtime размещён только в `worker`; `api` работает как queue/API-orchestration;
  - TikZ HTML assets собираются через DVI path;
  - HTTP contracts и frontend transport shape не менялись.
- На реальном teacher corpus migration уже выявила и закрыла несколько runtime/adapter defects:
  - stale workspace install в dev containers;
  - `documentclass/chapter` incompatibility в TikZ standalone wrapper;
  - runtime crash из-за устаревшего helper name `summarizeOutput`.
- Оставшиеся проблемы сейчас относятся не к cutover runtime, а к качеству HTML/TikZ fidelity на реальном content corpus. Они зафиксированы как отдельный техдолг, а не как rollback-issue миграции.
