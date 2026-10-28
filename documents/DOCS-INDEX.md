# DOCS-INDEX

Назначение: карта документации и короткое объяснение назначения каждого документа.
Подробные правила работы с документацией см. `AGENTS.md` и `documents/PLANS.md`.

## Корневая карта

- `README.md` — короткий вход в проект, ссылки на документацию и базовые dev-команды.
- `AGENTS.md` — короткий контракт работы агента с репозиторием и документацией.
- `CONTEXT.md` — канонический словарь нового домена библиотеки занятий.
- `DESIGN.md` — root Impeccable/Stitch design context для AI-инструментов: machine-readable tokens, visual rules и component snippets текущей UI-системы.
- `PRODUCT.md` — назначение продукта, аудитории, действующая библиотека и границы нового направления проверочных работ, визуальные принципы.
- `design-qa.md` — история датированных визуальных проверок; текущий дизайн задают DESIGN-документы.



## System of Record (SoR)

- `documents/ARCHITECTURE.md` — карта доменов, модулей и слоёв.
- `documents/ARCHITECTURE-PRINCIPLES.md` — инженерные принципы, quality guardrails и архитектурные ограничения.
- `documents/SECURITY.md` — security invariants и эксплуатационные security-ограничения.
- `documents/PLANS.md` — lifecycle execution plans, deferred roadmap и tech debt.
- `documents/CONTENT.md` — действующая модель каталога, публикации и материалов занятия.
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
- `documents/research/2026-10-28-assigned-classes-ux.md` — Apple, Shopify, Linear и Helios: размещение сводки получателей у заголовка работы, временное управление вместо accordion; исследование без изменения приложения.
- `documents/research/2026-10-28-import-to-work.md` — референсы Classtime/Formative/Wayground/Moodle, текущий импорт и конструктор, предложение необязательного создания заполненной работы из пакета; без реализации.
- `documents/research/2026-10-28-hierarchical-topic-filters.md` — Ant Design, Element Plus, живое демо Algolia, Linear и Primer: иерархический выбор темы, мобильная адаптация и ограничения текущего API; исследование без изменения приложения.
- `documents/research/2026-10-28-login-visual-references.md` — Apple, Shopify, Linear и Raycast конца 2025–2026, варианты атмосферного входа React Bits и сдержанного рабочего UI; завершённое исследование и источники выбранного визуального направления.
- `documents/research/2026-10-25-react-performance.md` — React Doctor 0.9.18, React/browser/JS измерения до/после, разбор замечаний, две подтверждённые оптимизации и ограничения.
- `documents/research/2026-10-24-performance-audit.md` — аудит кода, локальные измерения 30/90×30 и общего списка учеников, ограничения замеров и приоритеты небольших оптимизаций; не реализация.
- `documents/research/2026-10-24-performance-references.md` — первичные практики React/Next/Prisma/TanStack, пример Documenso и проверка возможностей/сетевых функций React Doctor.
- `documents/research/2026-10-21-work-progress-states.md` — UX-04: референсы Formative/Gradescope/Wayground и предложение независимых состояний теста, фото и публикаций в списках и отчёте; не реализация.
- `documents/research/2026-10-17-question-bank-import.md` — UX-референсы Formative, Classtime и Wayground для банка и пакетного импорта; предлагаемые экраны Э2 после локального пилота.
- `documents/research/2026-10-17-work-assignments.md` — официальные сценарии назначения и контроля выполнения Formative, Classtime и Wayground; предложение экранов Э4, не реализация.
- `documents/research/2026-10-18-solution-photos.md` — сценарии файлового ответа Formative, Gradescope и Classroom и адаптация загрузки фото к существующему ученическому экрану.
- `documents/research/2026-10-18-reviewer-access.md` — сравнение API keys, OAuth, MCP и Agent Auth для локальной проверки с двух компьютеров; совместимость Better Auth и границы безопасности.
- `examples/assessment-package/pilot-v1/` — шесть реальных задач, манифест и изображения для проверки формата; учительские ключи внутри, не ученический контент.
- `examples/assessment-package/extended-v1/` — развёрнутая задача Школково №14449 из пользовательских скриншотов, максимум 2 балла, без серверных критериев.
- `examples/assessment-package/ege-v1/` — две задачи пилота с явными правилами ЕГЭ 0/1/2; пример обновления версий без изменения старых назначений.
- `scripts/assessments/` — локальная сборка ZIP и PDF-предпросмотра пробного пакета, без серверного TeX.
- `scripts/reviewer/` — локальный клиент проверяющего, тесты и сборка автономного `output/continuum-reviewer-client.zip` с инструкцией, без секретов.

- `documents/research/2026-10-28-photo-ux-components.md` — первичные UX-референсы и интеграция очереди/фильтров/обновления фото, проверка команды CI.
- `documents/exec-plans/completed/2026-10-28-photo-ux-ci.md` — первый UX-пакет фото и исправление security gate.
- `documents/research/2026-10-28-project-ux-audit.md` — аудит готовности пилота, UI/UX обеих ролей, выполненной уборки, проверок и приоритетов roadmap.
- `documents/research/2026-10-28-lms-ux-evidence.md` — официальные механики Classroom/Canvas/Moodle/Gradescope для проверки готовности пилота и UX-пробелов.
- `documents/exec-plans/active/` — активные execution plans.
- `documents/exec-plans/completed/2026-10-28-assigned-classes.md` — сводка получателей у заголовка работы, временная панель, одиночный фильтр и desktop/phone QA.
- `documents/exec-plans/completed/2026-10-28-teacher-navigation-progress.md` — закреплённая навигация учителя, открытый фильтр и различимые состояния выполнения, источники и проверки.
- `documents/exec-plans/completed/2026-10-28-correction-ui-polish.md` — упрощение окна исправления, проверка responsive/keyboard и устранение TeX-тире в подготовленных архивах.
- `documents/exec-plans/completed/2026-10-28-task-presentation-corrections.md` — исправление условия в банке и назначенных работах без изменения ответов/баллов; Markdown №16656 и проверки архива.
- `documents/exec-plans/completed/2026-10-28-release-artifacts.md` — предыдущий вариант доставки готовых CI-артефактов, заменённый Git и кешем VPS.
- `documents/exec-plans/completed/2026-10-28-production-release.md` — проверенный production-выпуск согласованного UI/UX и security-пакета: настоящий CI, восстановление backup БД/S3, сохранность и публичный upload/readback фото.
- `documents/exec-plans/completed/2026-10-28-auth-security-update.md` — исправление high/critical обновлением Better Auth без исключений, совместимость старых сессий/ключей и локальная проверка quality/security gates.
- `documents/exec-plans/completed/2026-10-28-pilot-ux-audit.md` — аудит готовности ученического пилота, UI/UX, документации и гигиены.
- `documents/exec-plans/completed/2026-10-28-bulk-delete-undo.md` — массовое удаление задач/учеников и обратимое восстановление.
- `documents/exec-plans/completed/2026-10-28-consistent-bank-scroll.md` — единые scroll-области импорта, банка и выбора заданий в работу, доступность и проверки.
- `documents/exec-plans/completed/2026-10-28-import-work.md` — локально реализованная работа из всех задач подтверждённого пакета, атомарное создание и проверки перехода в редактор.
- `documents/exec-plans/completed/2026-10-28-bank-topic-filters.md` — локально реализованная иерархия тем и компактные фильтры банка, проверки и удаление временного прототипа.
- `documents/exec-plans/completed/2026-10-25-session-handoff.md` — передача в новый чат: локальный пакет после выпуска 24.10, выполненные проверки, оставшаяся работа, правила UI/UX и измеримой оптимизации.
- `documents/exec-plans/completed/2026-10-24-react-performance.md` — завершённый локальный React/JavaScript-проход: измерения, шапка, shared tree shaking, проверки и границы выпуска.
- `documents/exec-plans/completed/2026-10-24-small-performance-improvements.md` — локально завершённые оптимизации PERF-01: поиск банка, глобальный CSS и gzip JSON, проверки и границы выпуска.
- `documents/exec-plans/completed/2026-10-24-production-assessment-release.md` — завершённый production-выпуск накопленных изменений: точный SHA, CI, backup, 17 миграций и live smoke.
- `documents/exec-plans/completed/2026-10-24-release-readiness.md` — завершённое локальное предрелизное ревью, исправления, security-патчи, проверки и границы выпуска.
- `documents/exec-plans/completed/2026-10-24-statistics-wide-matrix.md` — плотная матрица на 20+ заданий, закреплённые имена/итоги, краткая подпись ученика и QA.
- `documents/exec-plans/completed/2026-10-24-statistics-table-ui.md` — перенос утверждённой плотной таблицы статистики: общие балльные колонки, боковые подробности, сортировка и QA.
- `documents/exec-plans/completed/2026-10-24-assessment-statistics.md` — отдельный раздел статистики: распределения учеников по баллам, сравнение классов, ответы, референсы и проверки.
- `documents/exec-plans/completed/2026-10-24-bank-duplicate-hints.md` — UX-15.A: быстрые неблокирующие совпадения импорта, сравнение, индексы, проверки и ограничения.
- `documents/exec-plans/completed/2026-10-24-teacher-ux-followups.md` — четыре небольших UX-доработки teacher UI и визуальный проход, проверки и границы.
- `documents/exec-plans/completed/2026-10-24-shared-search.md` — единое поле поиска семи учительских контекстов, фокус/очистка, каскад CSS и регрессионные проверки.
- `documents/exec-plans/completed/2026-10-24-bank-search-focus.md` — единый контур фокуса и очистка поиска банка, причина браузерного конфликта, референсы и QA.
- `documents/exec-plans/completed/2026-10-24-bank-source-filters.md` — фильтры ЕГЭ/не ЕГЭ и provider в банке, URL, пагинация, экспорт и локальные проверки.
- `documents/exec-plans/completed/2026-10-24-task-classification.md` — классификация ЕГЭ/не ЕГЭ и происхождения, совместимость прежних пакетов, инструкция автору и локальные проверки.
- `documents/exec-plans/completed/2026-10-24-ege-scoring.md` — явные правила ЕГЭ в пакете и общем оценщике, совместимость снимков и частичные результаты; локальная реализация и проверки.
- `documents/exec-plans/completed/2026-10-24-student-work-preview.md` — UX-08: существующий просмотр с ученическим навигатором, локальными пробными ответами/фото и серверной проверкой без записи; проверки и ограничения.
- `documents/exec-plans/completed/2026-10-24-teacher-safe-leave.md` — UX-01: сохранение перед уходом/выходом, история браузера и восстановление входа преподавателя; локальные проверки и ограничения.
- `documents/exec-plans/completed/2026-10-24-student-pdf-open.md` — прямое открытие PDF из ученического каталога, регрессия и ограничения локальной S3/mobile QA.
- `documents/exec-plans/completed/2026-10-21-concurrent-writes.md` — конфликты сериализации назначения и массового создания: ограниченные повторы транзакций и проверенная идемпотентность.
- `documents/exec-plans/completed/2026-10-21-work-progress.md` — UX-04: независимые состояния теста/фото/публикации, пакетная read-проекция, три существующих экрана, локальная QA и ограничения общего API-suite.
- `documents/exec-plans/completed/2026-10-21-bank-undo.md` — UX-10: отмена удаления задачи, lifecycle revision, безопасные повторы, импорт и локальные проверки.
- `documents/exec-plans/completed/2026-10-21-confirmations.md` — UX-14: единые подтверждения в обеих ролях, ожидание запроса, ошибки/повторы, граница с UX-01 и локальная QA.
- `documents/exec-plans/completed/2026-10-21-assignment-revocation.md` — UX-03: подтверждаемый отзыв назначения с удалением ответов выбранного класса, безопасными повторами, очисткой S3 и локальными проверками.
- `documents/exec-plans/completed/2026-10-21-work-lifecycle.md` — UX-02: удаление неиспользованных черновиков, архив/восстановление, защита истории, безопасные повторы и локальные проверки.
- `documents/exec-plans/completed/2026-10-21-work-copy.md` — UX-06: независимая копия сохранённой работы с пропуском удалённых задач, без назначений и результатов; локальные проверки и ограничения выпуска.
- `documents/exec-plans/completed/2026-10-21-small-ux.md` — локально реализованные меню профиля, URL-фильтры банка и исправление ФИО без изменения логина и прежних результатов.
- `documents/exec-plans/completed/2026-10-19-bank-deletion.md` — удаление задач из банка с сохранением работ, исправление тёмного поля preview и локальная проверка.
- `documents/exec-plans/completed/2026-10-19-library-deletion.md` — завершённое удаление PDF, занятий и разделов: подтверждения, очистка хранилища и проверенный production-выпуск.
- `documents/exec-plans/completed/2026-10-24-library-implementation-history.md` — история перехода к библиотеке; невыполненные расширения перенесены в deferred roadmap.
- `documents/exec-plans/active/2026-10-15-assessment-roadmap.md` — только оставшиеся выпуск, приёмка и отложенный ученический разбор; без журнала выполненных этапов.
- `documents/exec-plans/active/2026-10-18-reviewer-api-contract.md` — оставшаяся пользовательская приёмка локального агента на двух физических компьютерах.
- `documents/exec-plans/deferred-roadmap.md` — только будущие UX/LIB-улучшения и измеримый performance-этап PERF-01: основания, порядок, критерии и источники.
- `documents/exec-plans/tech-debt-tracker.md` — только открытый инженерный долг: complexity budget, остаточная low-зависимость и известное ограничение offline-ввода.
- `documents/ops/TROUBLESHOOTING.md` — повторяемые dev/run/build/test сбои и проверенная диагностика.
- `documents/generated/db-schema.md` — срез текущей БД-модели.
- `documents/generated/api-routes.md` — сгенерированный каталог HTTP routes из Nest controllers.
- `deploy/README.md` — production deploy runbook.

История удалённой LMS хранится в Git; завершённые инициативы — в `completed`, отдельно от текущих SoR и backlog.

## История завершённых этапов

- `documents/exec-plans/completed/2026-10-24-assessment-implementation-history.md` — Э0–Э6, учительская статистика и прежний журнал дорожной карты; исторический срез 24.10.2026.
- `documents/exec-plans/completed/2026-10-24-reviewer-implementation-history.md` — контракт, решения и реализация локальной проверки; исторический срез 24.10.2026.
- `documents/exec-plans/completed/2026-10-24-ux-roadmap-history.md` — исходный UX-01–15, выполненные пункты и исключения пользователя; исторический срез 24.10.2026.
- `documents/exec-plans/completed/2026-10-24-resolved-debt-history.md` — закрытые интерфейсные и конкурентные дефекты; исторический срез 24.10.2026.

- `documents/exec-plans/completed/2026-10-28-steel-ui.md` — единые токены стального акцента, состояния действий, визуальные проверки обеих ролей и точный откат.

- `documents/exec-plans/completed/2026-10-28-cached-vps-release.md` — Git-доставка, изолированная сборка с кешем VPS и выпуск без передачи Docker-архива.
