# DOCS-INDEX

Назначение: карта документации и короткое объяснение назначения каждого документа.
Подробные правила работы с документацией см. `AGENTS.md` и `documents/PLANS.md`.

## Корневая карта

- `AGENTS.md` — короткий контракт работы агента с репозиторием и документацией.

## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоёв.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы, quality guardrails и архитектурные ограничения.
- `documents/SECURITY.md` — security invariants и эксплуатационные security-ограничения.
- `documents/RELIABILITY.md` — надежность, очереди, эксплуатационные инварианты и recovery patterns.
- `documents/QUALITY_SCORE.md` — методика оценки зрелости системы.
- `documents/PLANS.md` — lifecycle execution plans, deferred roadmap и tech debt.
- `documents/CONTENT.md` — content/publishing/graph/LaTeX pipeline.
- `documents/LEARNING.md` — attempts/progress/availability/photo review.
- `documents/DESIGN.md` — высокоуровневые продуктовые и UX-инварианты.
- `documents/FRONTEND.md` — frontend-архитектура и UI-конвенции.
- `documents/DESIGN-SYSTEM.md` — дизайн-система UI (tokens/components/patterns).
- `documents/PRODUCT_SENSE.md` — продуктовые эвристики и приоритеты решений.
- `documents/DOMAIN-EVENTS.md` — каталог доменных событий.
- `documents/HANDLER-MAP.md` — карта обработчиков (HTTP → services → events/jobs).
- `documents/DEVELOPMENT.md` — dev/build/test/deploy runbook и troubleshooting.
- `documents/DECISIONS.md` — decision cards и архитектурные фиксации, сверяемые по коду.

## Каталоги

- `documents/design-docs/index.md` — индекс дизайн-доков.
- `documents/design-docs/core-beliefs.md` — core beliefs для design-doc ветки.
- `documents/product-specs/index.md` — индекс продуктовых спецификаций.
- `documents/exec-plans/active/` — активные execution plans.
- `documents/exec-plans/active/texlive-pdflatex-migration.md` — активный план миграции backend LaTeX runtime с `tectonic` на `TeX Live + pdflatex`.
- `documents/exec-plans/completed/` — завершённые execution plans.
- `documents/exec-plans/completed/index.md` — индекс завершённых планов.
- `documents/exec-plans/deferred-roadmap.md` — отложенные future items, которые не являются техдолгом.
- `documents/exec-plans/tech-debt-tracker.md` — техдолг и engineering debt.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/references/README.md` — внешние референсы и LLM-friendly материалы.
- `deploy/README.md` — production deploy runbook.

## Архив

- История завершённых инициатив и старых execution plans хранится в `documents/exec-plans/completed/`.
