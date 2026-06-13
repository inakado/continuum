# 2026-02-26 — Architecture principles refactor foundation

Статус плана: `Completed`

## Назначение

Стабилизировать документационную и инженерную governance-модель проекта: разделить SoR, runbook, execution plans, roadmap и tech debt так, чтобы активные решения не смешивались с историей выполнения.

## Итог

- `AGENTS.md` сокращён до agent contract.
- `documents/DOCS-INDEX.md` стал картой документов.
- `documents/PLANS.md` стал единственным meta-документом про lifecycle execution plans, deferred roadmap и tech debt.
- `documents/ARCHITECTURE-PRINCIPLES.md` очищен до стабильных принципов, guardrails и approved stack.
- `documents/DEVELOPMENT.md` закреплён как runbook/troubleshooting документ.
- Введены docs checks: `docs:check:links`, `docs:check:index`, `docs:check:status`.

## Ключевые решения

- SoR-доки описывают текущее поведение и стабильные инварианты.
- Progress logs, rollout notes и task-specific troubleshooting живут только в execution plans.
- Неактивные future items живут в `documents/exec-plans/deferred-roadmap.md`.
- Engineering debt живёт в `documents/exec-plans/tech-debt-tracker.md`.

## Проверки

- `pnpm docs:check` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed.
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"` — passed.
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"` — passed.

## Остаточные ссылки

- Текущие правила: `AGENTS.md`, `documents/PLANS.md`, `documents/ARCHITECTURE-PRINCIPLES.md`.
- Документационные проверки: `scripts/docs/*`.
