# DOCS-INDEX

Назначение: карта документации и короткое объяснение назначения каждого документа.
Подробные правила работы с документацией см. `AGENTS.md` и `documents/PLANS.md`.

## Корневая карта

- `README.md` — короткий вход в проект, ссылки на документацию и базовые dev-команды.
- `AGENTS.md` — короткий контракт работы агента с репозиторием и документацией.
- `CONTEXT.md` — канонический словарь нового домена библиотеки занятий.
- `DESIGN.md` — root Impeccable/Stitch design context для AI-инструментов: machine-readable tokens, visual rules и component snippets текущей UI-системы.
- `PRODUCT.md` — назначение продукта, аудитории, действующая библиотека и границы нового направления проверочных работ, визуальные принципы.
- `design-qa.md` — визуальные проверки каталогов и учительских экранов, ограничения текущей проверки.



## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоёв.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы, quality guardrails и архитектурные ограничения.
- `documents/SECURITY.md` — security invariants и эксплуатационные security-ограничения.
- `documents/PLANS.md` — lifecycle execution plans, deferred roadmap и tech debt.
- `documents/CONTENT.md` — целевая модель каталога, публикации и материалов занятия.
- `documents/ASSESSMENTS.md` — классы, банк, конструктор, назначения, ответы, фотографии и локальная проверка: версии, публикация PDF/баллов, история и права.
- `documents/REVIEWER-CLIENT.md` — пересылаемая инструкция преподавателю и агенту: ключ классов/учеников в общей базе, подключение Mac/Keychain, фото, PDF/баллы, публикация и конфликты.
- `documents/ASSESSMENT-PACKAGE.md` — подготовка пакета v1: поля, ключи, Markdown, лимиты импорта и пробный пакет; читать перед адаптацией TeX.
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

- `documents/research/` — исследования внешних продуктов и источников; выводы не заменяют утверждённые требования и работающие контракты.
- `documents/research/2026-10-17-question-bank-import.md` — UX-референсы Formative, Classtime и Wayground для банка и пакетного импорта; предлагаемые экраны Э2 после локального пилота.
- `documents/research/2026-10-17-work-assignments.md` — официальные сценарии назначения и контроля выполнения Formative, Classtime и Wayground; предложение экранов Э4, не реализация.
- `documents/research/2026-10-18-solution-photos.md` — сценарии файлового ответа Formative, Gradescope и Classroom и адаптация загрузки фото к существующему ученическому экрану.
- `documents/research/2026-10-18-reviewer-access.md` — сравнение API keys, OAuth, MCP и Agent Auth для локальной проверки с двух компьютеров; совместимость Better Auth и границы безопасности.
- `examples/assessment-package/pilot-v1/` — шесть реальных задач, манифест и изображения для проверки формата; учительские ключи внутри, не ученический контент.
- `examples/assessment-package/extended-v1/` — развёрнутая задача Школково №14449 из пользовательских скриншотов, максимум 2 балла, без серверных критериев.
- `scripts/assessments/` — локальная сборка ZIP и PDF-предпросмотра пробного пакета, без серверного TeX.
- `scripts/reviewer/` — локальный клиент проверяющего, тесты и сборка автономного `output/continuum-reviewer-client.zip` с инструкцией, без секретов.

- `documents/exec-plans/active/` — активные execution plans.
- `documents/exec-plans/active/2026-10-19-library-deletion.md` — удаление PDF, занятий и разделов: подтверждения, очистка хранилища и выпуск.
- `documents/exec-plans/active/2026-09-23-content-library-rewrite.md` — активная переработка Continuum в закрытую библиотеку занятий.
- `documents/exec-plans/active/2026-10-15-assessment-roadmap.md` — этапы классов, банка заданий, назначений, локальной проверки фото и статистики; решения, критерии готовности и журнал выполнения.
- `documents/exec-plans/active/2026-10-18-reviewer-api-contract.md` — контракт и приёмка Э6: общая база преподавателей, ключи классов/учеников, фото, PDF/баллы, ревизии и публикация.
- `documents/exec-plans/deferred-roadmap.md` — отложенные future items, которые не являются техдолгом.
- `documents/exec-plans/tech-debt-tracker.md` — техдолг и engineering debt.
- `documents/ops/TROUBLESHOOTING.md` — повторяемые dev/run/build/test сбои и проверенная диагностика.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/generated/api-routes.md` — сгенерированный каталог HTTP routes из Nest controllers.
- `deploy/README.md` — production deploy runbook.

История удалённой LMS и завершённых инициатив хранится в Git, а не в действующей документации.
