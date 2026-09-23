# DOCS-INDEX

Назначение: карта документации и короткое объяснение назначения каждого документа.
Подробные правила работы с документацией см. `AGENTS.md` и `documents/PLANS.md`.

## Корневая карта

- `README.md` — короткий вход в проект, ссылки на документацию и базовые dev-команды.
- `AGENTS.md` — короткий контракт работы агента с репозиторием и документацией.
- `CONTEXT.md` — канонический словарь нового домена библиотеки занятий.
- `DESIGN.md` — root Impeccable/Stitch design context для AI-инструментов: machine-readable tokens, visual rules и component snippets текущей UI-системы.
- `PRODUCT.md` — стратегический контекст Impeccable для register, аудитории, назначения продукта, brand personality, anti-references и дизайн-принципов.
- `design-qa.md` — последний визуальный QA выбранного catalog mock против локальной реализации.



## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоёв.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы, quality guardrails и архитектурные ограничения.
- `documents/SECURITY.md` — security invariants и эксплуатационные security-ограничения.
- `documents/PLANS.md` — lifecycle execution plans, deferred roadmap и tech debt.
- `documents/CONTENT.md` — целевая модель каталога, публикации и материалов занятия.
- `documents/DESIGN.md` — высокоуровневые продуктовые и UX-инварианты.
- `documents/FRONTEND.md` — frontend-архитектура и UI-конвенции.
- `documents/DEVELOPMENT.md` — короткий dev/build/test runbook и operational invariants.
- `documents/DECISIONS.md` — действующие архитектурные решения новой версии.

## Когда править

- API route/controller изменился → `pnpm docs:generate`, затем сверить `documents/generated/api-routes.md` и профильный SoR-док.
- Prisma schema изменилась → `pnpm docs:generate`, затем сверить `documents/generated/db-schema.md`.
- Поведение домена изменилось → `CONTEXT.md`, `documents/CONTENT.md`, `documents/SECURITY.md` и при необходимости `documents/DECISIONS.md`.
- Frontend UX или UI conventions изменились → `documents/FRONTEND.md`, `documents/DESIGN.md` или root `DESIGN.md`.
- Локальный dev/build/test runbook изменился → `documents/DEVELOPMENT.md`.
- Повторяемый dev/run/build/test сбой появился → `documents/ops/TROUBLESHOOTING.md`.
- Production deploy/runtime изменился → `deploy/README.md`.
- Future product idea без активной реализации → `documents/exec-plans/deferred-roadmap.md`.

## Каталоги

- `documents/exec-plans/active/` — активные execution plans.
- `documents/exec-plans/active/2026-09-23-content-library-rewrite.md` — активная переработка Continuum в закрытую библиотеку занятий.
- `documents/exec-plans/deferred-roadmap.md` — отложенные future items, которые не являются техдолгом.
- `documents/exec-plans/tech-debt-tracker.md` — техдолг и engineering debt.
- `documents/ops/TROUBLESHOOTING.md` — повторяемые dev/run/build/test сбои и проверенная диагностика.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/generated/api-routes.md` — сгенерированный каталог HTTP routes из Nest controllers.
- `deploy/README.md` — production deploy runbook.

История удалённой LMS и завершённых инициатив хранится в Git, а не в действующей документации.
