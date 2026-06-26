# DOCS-INDEX

Назначение: карта документации и короткое объяснение назначения каждого документа.
Подробные правила работы с документацией см. `AGENTS.md` и `documents/PLANS.md`.

## Корневая карта

- `README.md` — короткий вход в проект, ссылки на документацию и базовые dev-команды.
- `AGENTS.md` — короткий контракт работы агента с репозиторием и документацией.
- `DESIGN.md` — root Impeccable/Stitch design context для AI-инструментов: machine-readable tokens, visual rules и component snippets текущей UI-системы.
- `PRODUCT.md` — стратегический контекст Impeccable для register, аудитории, назначения продукта, brand personality, anti-references и дизайн-принципов.



## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоёв.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы, quality guardrails и архитектурные ограничения.
- `documents/SECURITY.md` — security invariants и эксплуатационные security-ограничения.
- `documents/RELIABILITY.md` — надежность, очереди, эксплуатационные инварианты и recovery patterns.
- `documents/QUALITY_SCORE.md` — методика оценки зрелости системы.
- `documents/PLANS.md` — lifecycle execution plans, deferred roadmap и tech debt.
- `documents/CONTENT.md` — content/publishing/graph/LaTeX pipeline.
- `documents/LEARNING.md` — attempts/progress/availability/manual review.
- `documents/DESIGN.md` — высокоуровневые продуктовые и UX-инварианты.
- `documents/FRONTEND.md` — frontend-архитектура и UI-конвенции.
- `documents/DESIGN-SYSTEM.md` — дизайн-система UI (tokens/components/patterns).
- `documents/PRODUCT_SENSE.md` — продуктовые эвристики и приоритеты решений.
- `documents/DOMAIN-EVENTS.md` — каталог доменных событий.
- `documents/HANDLER-MAP.md` — карта обработчиков (HTTP → services → events/jobs).
- `documents/DEVELOPMENT.md` — короткий dev/build/test runbook и operational invariants.
- `documents/DECISIONS.md` — decision cards и архитектурные фиксации, сверяемые по коду.

## Когда править

- API route/controller изменился → `pnpm docs:generate`, затем сверить `documents/generated/api-routes.md`; `documents/HANDLER-MAP.md` менять только при изменении service/data-flow/side effects.
- Prisma schema изменилась → `pnpm docs:generate`, затем сверить `documents/generated/db-schema.md`.
- Поведение домена изменилось → профильный SoR-док (`CONTENT`, `LEARNING`, `SECURITY`, `RELIABILITY`, `DOMAIN-EVENTS`) и при необходимости `DECISIONS.md`.
- Frontend UX или UI conventions изменились → `documents/FRONTEND.md`, `documents/DESIGN.md` или `documents/DESIGN-SYSTEM.md`.
- Локальный dev/build/test runbook изменился → `documents/DEVELOPMENT.md`.
- Повторяемый dev/run/build/test сбой появился → `documents/ops/TROUBLESHOOTING.md`.
- Production deploy/runtime изменился → `deploy/README.md`.
- Future product idea без активной реализации → `documents/product-specs/*` или `documents/exec-plans/deferred-roadmap.md`.

## Каталоги

- `documents/product-specs/index.md` — индекс продуктовых спецификаций.
- `documents/product-specs/gamification-proposal.md` — proposal по будущей продуктовой и технической модели геймификации; не SoR.
- `documents/exec-plans/active/` — активные execution plans.
- `documents/exec-plans/active/2026-06-26-excalidraw-board-photo-submissions.md` — active plan внедрения Excalidraw-доски как варианта отправки развернутого ответа (`photo` technical type).
- `documents/exec-plans/completed/` — завершённые execution plans.
- `documents/exec-plans/completed/index.md` — индекс завершённых планов.
- `documents/exec-plans/deferred-roadmap.md` — отложенные future items, которые не являются техдолгом.
- `documents/exec-plans/tech-debt-tracker.md` — техдолг и engineering debt.
- `documents/ops/TROUBLESHOOTING.md` — повторяемые dev/run/build/test сбои и проверенная диагностика.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/generated/api-routes.md` — сгенерированный каталог HTTP routes из Nest controllers.
- `deploy/README.md` — production deploy runbook.

## Архив

- История завершённых инициатив и старых execution plans хранится в `documents/exec-plans/completed/`.
