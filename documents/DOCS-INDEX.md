# DOCS-INDEX

Документация организована по принципу progressive disclosure: короткая точка входа и специализированные SoR-доки.

Этот файл: `documents/DOCS-INDEX.md` (индекс документации).

## Статус индекса

- `Implemented`: текущая структура каталогов/SoR-доков сверяется по репозиторию.
- `Implemented`: doc-governance валидируется через `docs:check` (`links`, `index`, `status`) локально и в CI.
- `Planned`: дальнейшее расширение doc-governance только при появлении новых классов drift.

## Корневая карта

- `AGENTS.md` — навигационная карта для агента (не энциклопедия).

## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоев.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы читаемости/поддерживаемости, quality budgets и стабильные architectural guardrails.
- `documents/SECURITY.md` — security-политики и invariants.
- `documents/RELIABILITY.md` — надежность, очереди, отказоустойчивость, runbooks.
- `documents/QUALITY_SCORE.md` — оценка качества по шкале 0..5 (фокус: core product domain).
- `documents/PLANS.md` — политика планирования и lifecycle execution plans.
- `documents/CONTENT.md` — content/publishing/graph/LaTeX pipeline (SoR по контенту).
- `documents/LEARNING.md` — attempts/progress/availability/3+3 (SoR по обучению).
- `documents/DESIGN.md` — дизайн-принципы продукта.
- `documents/FRONTEND.md` — фронтенд-архитектура и UI-guidelines.
- `documents/DESIGN-SYSTEM.md` — дизайн-система UI (tokens/components/patterns).
- `documents/PRODUCT_SENSE.md` — продуктовые приоритеты и decision heuristics.
- `documents/DOMAIN-EVENTS.md` — каталог доменных событий (audit log / диагностика / будущие проекции).
- `documents/HANDLER-MAP.md` — карта обработчиков (HTTP → services → events/jobs).
- `documents/DEVELOPMENT.md` — dev/build/test/deploy runbook и troubleshooting (операционный минимум).
- `documents/DECISIONS.md` — decision cards (что выбрали и почему; сверено по коду).

## Границы документов (`Implemented`)

- `documents/ARCHITECTURE-PRINCIPLES.md`:
  - содержит только принципы, budgets, enforced practices и стабильные ограничения;
  - не содержит phase/wave planning, progress logs и историю выполнения.
- `documents/DEVELOPMENT.md`:
  - содержит только команды, runbook, prerequisites, troubleshooting и операционные инварианты;
  - не содержит feature planning, архитектурные rationale и историю рефакторинга.
- `documents/exec-plans/active/*` и `documents/exec-plans/completed/*`:
  - содержат planning, progress logs, риски, decision log и task-specific troubleshooting;
  - не дублируют SoR-контент, кроме краткой фиксации результата.
- При сомнении:
  - stable rule → SoR;
  - временный план/прогресс → execution plan;
  - команда/окружение/грабли → `documents/DEVELOPMENT.md`.

## Каталоги

- `documents/design-docs/index.md` — индекс дизайн-доков.
- `documents/design-docs/core-beliefs.md` — core beliefs (agent-first).
- `documents/product-specs/index.md` — индекс продуктовых спецификаций.
- `documents/exec-plans/active/` — активные планы выполнения.
- `documents/exec-plans/active/2026-02-26-architecture-principles-refactor-foundation.md` — активный план внедрения архитектурных принципов.
- `documents/exec-plans/completed/` — завершенные планы.
- `documents/exec-plans/completed/index.md` — индекс завершенных планов.
- `documents/exec-plans/tech-debt-tracker.md` — трекер техдолга.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/references/README.md` — внешние референсы и LLM-friendly материалы.
- `deploy/README.md` — production deploy runbook (GitHub ↔ VPS, systemd/nginx, rollback).

## Архив (история решений)

- Вертикальные слайсы и планы старого формата сохранены как артефакты: `documents/exec-plans/completed/`.

Правило: любые устаревшие документы, не являющиеся SoR и не отражающие текущий код, удаляются (чтобы не создавать drift).
