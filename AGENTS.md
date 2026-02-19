# AGENTS.md

Этот файл не энциклопедия. Это навигационная карта для агента.
Источник истины по поведению системы: **код в репозитории**.
Документация ниже должна помогать быстро найти нужный контекст и проверить решения.

## 1) Стартовая точка

1. Проверь текущую задачу и затронутые пакеты (`apps/api`, `apps/web`, `apps/worker`, `packages/shared`).
2. Прочитай верхнеуровневую архитектуру: `documents/ARCHITECTURE.md`.
3. Для доменной логики используй профильные SoR-доки в `documents/`.
4. Для активной сложной работы используй execution plan в `documents/exec-plans/active/`.
5. При конфликте документации и кода доверяй коду, затем обнови доки.

## 1.1) Workflow (как агент работает с доками)

1) Открыть `AGENTS.md` → `documents/DOCS-INDEX.md` и выбрать минимально нужные SoR-доки под задачу.  
2) Считать **код** источником истины: проверить утверждения по handlers/services/Prisma schema; в доках оставлять только подтверждённое.  
3) Если работа “сложная” (несколько модулей/миграции/инварианты) — создать/обновить execution plan в `documents/exec-plans/active/` (цель, scope, шаги, риски, decision log).  
4) Любое изменение поведения в коде → обновить соответствующий SoR-док (и помечать факты как `Implemented` или `Planned`).  
5) Любые устаревшие утверждения, которые не являются будущим планом, удалить (иначе drift).  
6) Если добавлен новый документ/каталог — внести его в `documents/DOCS-INDEX.md` (запрет на “сироты”).  
7) После завершения — перенести план в `documents/exec-plans/completed/` (или закрыть как tech debt в `documents/exec-plans/tech-debt-tracker.md`).  

## 2) Где что лежит

- Архитектура: `documents/ARCHITECTURE.md`
- Безопасность: `documents/SECURITY.md`
- Надежность и эксплуатация: `documents/RELIABILITY.md`
- Качество продукта: `documents/QUALITY_SCORE.md`
- Планирование и execution plans: `documents/PLANS.md`, `documents/exec-plans/`
- Content (публикация/граф/LaTeX): `documents/CONTENT.md`
- Learning (attempts/progress/availability): `documents/LEARNING.md`
- Продуктовые спецификации: `documents/product-specs/`
- Дизайн-решения и принципы: `documents/DESIGN.md`, `documents/FRONTEND.md`, `documents/design-docs/`
- Генерируемые артефакты: `documents/generated/`
- Справочные LLM-friendly материалы: `documents/references/`
- Индекс документации: `documents/DOCS-INDEX.md`

## 3) Правила работы с документацией

1. Документация ведется на русском языке.
2. Имена сущностей, API, env-переменных, таблиц и полей пишутся как в коде (English identifiers).
3. Любой документ должен явно помечать статус факта:
   - `Implemented` — уже в коде.
   - `Planned` — запланировано, но не реализовано.
4. Нельзя смешивать `Implemented` и `Planned` без явной маркировки в разделе.
5. Если описание устарело и не относится к будущим фичам, его нужно удалить или переписать.

## 4) Source of Truth порядок

1. Код и тесты.
2. Prisma schema / runtime-контракты / API handlers.
3. Генерируемые документы (`documents/generated/*`).
4. Остальная markdown-документация.

## 5) Известные доменные решения (зафиксировано)

- API без versioning (`/v1` не используется).
- Auth: cookie-first (httpOnly cookies) + refresh rotation (Bearer access token допускается кодом, но не является целевым UI-паттерном).
- Event payload хранит `actorRole` в payload.
- Learning progression и unlock-логика фиксируются по текущему коду.
- Поле порога optional-задач: `minOptionalCountedTasksToComplete`.
- LaTeX pipeline: auto-apply worker является default.
- Assets: текущий runtime через object storage (MinIO), хранение ключей в сущностях; возможна эволюция для новых типов файлов.
- `concepts`, `concept_aliases`, `unit_concepts` — это `Planned` доменная ветка.

## 6) Структура execution plans

- Активные: `documents/exec-plans/active/`
- Завершенные: `documents/exec-plans/completed/`
- Техдолг: `documents/exec-plans/tech-debt-tracker.md`

План обязателен для сложных изменений (несколько модулей, миграции, изменение доменных инвариантов).

## 7) Проверки качества документации (целевой минимум)

CI должен валидировать:

1. Все ссылки в markdown валидны.
2. Все документы из индекса реально существуют.
3. Для ключевых SoR-доков есть пометки `Implemented/Planned`.
4. Нет файлов-сирот, не включенных в `documents/DOCS-INDEX.md`.

## 8) Что не делать

- Не превращать `AGENTS.md` в длинный мануал.
- Не хранить критичные архитектурные решения только в чатах/внешних документах.
- Не оставлять в SoR-доках неподтвержденные утверждения без ссылки на код.

## 9) Быстрый чеклист перед merge

1. Изменения в коде отражены в релевантных SoR-доках.
2. Новый сложный scope имеет execution plan (или обновление существующего).
3. Устаревшие утверждения удалены/исправлены.
4. `documents/DOCS-INDEX.md` обновлен.
