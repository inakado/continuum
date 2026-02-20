# RELIABILITY

Статус: `Draft` (источник истины — код).

## Scope

- Queues / background jobs (BullMQ + worker)
- Timeout/retry policies (LaTeX compile, internal apply)
- Operational runbooks (dev/prod базовый контур)

## Current invariants (`Implemented`, verified in code)

### API ↔ Worker: LaTeX pipeline

- API ставит LaTeX compile jobs в BullMQ queue `latex.compile`.
- Worker (BullMQ consumer) компилирует LaTeX через `tectonic`, загружает PDF в object storage и вызывает internal apply endpoint в API.
- Auto-apply результата worker — default mode (worker всегда пытается применить результат; API защищает от “stale”).

### Timeouts / retries

- LaTeX compile timeout: `LATEX_COMPILE_TIMEOUT_MS` (default `120000`).
- Internal apply retry в worker: до 8 повторов (условный retry на `409` с `code=LATEX_JOB_RESULT_INVALID`).
- HTTP keep-alive в API: `keepAliveTimeout = 65s` (уменьшает лишние disconnects за прокси).

### Queue hygiene

- BullMQ queue jobs авто-очищаются: `removeOnComplete` и `removeOnFail` (по 200 последних).
- По умолчанию `attempts: 1` для compile jobs (ошибки компиляции обычно детерминированны и зависят от input).

### Production delivery contour

- CI workflow (`.github/workflows/ci.yml`) запускается на `pull_request` и `push` в `main`: install/build/typecheck/test.
- Backend build в CI выполняется только через Docker (`pnpm build:backend` → `docker compose -f docker-compose.prod.yml build api worker`).
- Production runtime не поднимает MinIO: object storage подключается как внешний S3 endpoint (Beget S3).
- Security этап в CI: dependency audit + Trivy filesystem scan (`HIGH,CRITICAL`).
- CD workflow (`.github/workflows/deploy.yml`) запускается только вручную (`workflow_dispatch`) и использует GitHub Environment `production`.
- В CD есть hard gate: без подтверждения manual migration deploy job завершается ошибкой.
- Post-deploy checks включают `/health`, `/ready`, enqueue ping и frontend `/login`.

### Rollback baseline

- Откат выполняется до предыдущего commit/tag + пересборка backend контейнеров + rebuild/restart web systemd service.
- Базовый rollback runbook зафиксирован в `deploy/README.md`.

## Planned

- SLO/SLA по критическим сценариям (login, открыть unit, submit attempt, photo submit/review, render pdf).
- Runbooks: деградация Redis, object storage (S3/MinIO), worker lag, prisma migrate/rollback (углублённый аварийный режим).
- Явная стратегия “availability recompute” (см. also: вопрос про записи на чтении).
- Healthcheck/alerting интеграция в внешнюю систему мониторинга (Prometheus/Grafana или managed).

## Source links

- Queue + worker:
  - `apps/api/src/content/latex-compile-queue.service.ts`
  - `apps/worker/src/main.ts`
  - `apps/worker/src/latex/latex-compile.worker.ts`
- LaTeX compile implementation:
  - `apps/worker/src/latex/latex-compile.ts`
  - `apps/api/src/infra/latex/latex-compile.service.ts` (debug-only endpoint)
- Internal apply:
  - `apps/api/src/content/internal-latex.controller.ts`
  - `apps/worker/src/latex/latex-apply-client.ts`
- Deploy artifacts:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `docker-compose.prod.yml`
  - `deploy/README.md`
