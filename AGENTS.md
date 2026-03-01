# AGENTS.md

Этот файл не энциклопедия. Это короткий контракт работы агента с репозиторием и документацией.
Источник истины по поведению системы: код и тесты.

## 1) Стартовая навигация

1. Открыть `AGENTS.md`.
2. Открыть `documents/DOCS-INDEX.md` и выбрать минимально нужные SoR-доки.
3. Для текущей архитектурной модели обязательно свериться с `documents/ARCHITECTURE.md` и `documents/ARCHITECTURE-PRINCIPLES.md`.
4. Для сложной активной работы использовать `documents/PLANS.md` и соответствующий файл в `documents/exec-plans/active/`.
5. При конфликте документации и кода доверять коду, затем исправлять документацию.

## 2) Source of Truth порядок

1. Код и тесты.
2. Prisma schema / runtime-контракты / API handlers.
3. Генерируемые документы (`documents/generated/*`).
4. Остальная markdown-документация.

## 3) Как выбирать документ

- Архитектурная карта и bounded contexts: `documents/ARCHITECTURE.md`
- Инженерные принципы и guardrails: `documents/ARCHITECTURE-PRINCIPLES.md`
- Dev/test/build/deploy runbook: `documents/DEVELOPMENT.md`
- Доменный SoR: профильные документы в `documents/`
- Правила lifecycle для execution plans и backlog-хранилищ: `documents/PLANS.md`
- Активный прогресс, decision log, task-specific troubleshooting: `documents/exec-plans/active/*`
- Неактивные future items: `documents/exec-plans/deferred-roadmap.md`
- Техдолг и баги: `documents/exec-plans/tech-debt-tracker.md`

## 4) Границы документов

- `documents/ARCHITECTURE-PRINCIPLES.md`:
  - хранит только стабильные инженерные принципы, budgets, enforced practices и архитектурные ограничения;
  - не хранит phase/wave history, rollout logs и implementation backlog.
- `documents/DEVELOPMENT.md`:
  - хранит только runbook, команды, окружение, troubleshooting и операционные инварианты;
  - не хранит архитектурные rationale, продуктовые решения и историю рефакторинга.
- `documents/DOCS-INDEX.md`:
  - хранит только карту документов и их назначение;
  - не хранит policy, planning и status-модель.
- `documents/PLANS.md`:
  - хранит только правила lifecycle для execution plans, deferred roadmap и tech debt;
  - не дублирует SoR-контент.
- Execution plans:
  - единственное место для progress logs, decision log, rollout notes и task-specific troubleshooting.
- `documents/exec-plans/deferred-roadmap.md`:
  - хранит неактивные future items, которые не являются техдолгом.
- `documents/exec-plans/tech-debt-tracker.md`:
  - хранит только техдолг, баги и engineering debt.

## 5) Обязательное соблюдение архитектурных принципов

Перед изменением кода агент обязан свериться с `documents/ARCHITECTURE-PRINCIPLES.md`.

Решения по коду должны сохранять и усиливать:
- SRP и complexity budget;
- contract-first и fail-fast boundary validation;
- read/write separation;
- typed mapping без бесконтрольного `any` и `unknown`;
- policy-as-code для TTL, asset rules и аналогичных ограничений;
- server-state discipline во frontend;
- effect isolation и декларативный UI.

Если изменение осознанно отклоняется от этих правил, причина фиксируется в active execution plan.

## 6) Гигиена документации

1. Документация ведётся на русском языке.
2. Имена сущностей, API, env-переменных, таблиц и полей писать как в коде.
3. Любое изменение поведения в коде должно отражаться в соответствующем SoR-доке.
4. Устаревшие утверждения, не являющиеся активным планом или отложенным future item, удалять.
5. Новый документ или каталог обязательно добавлять в `documents/DOCS-INDEX.md`.
6. Не хранить backlog и progress в SoR-доках.
7. Перед правкой документа коротко сверять его назначение по `documents/DOCS-INDEX.md`.

## 7) Ограничения агента

- В агентской/sandbox-сессии агент не запускает `CI=true pnpm install --frozen-lockfile`.
- Если нужна эта команда, агент просит пользователя выполнить её локально и прислать результат.
