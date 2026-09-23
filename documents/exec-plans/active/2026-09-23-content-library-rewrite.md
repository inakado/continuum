# Переработка Continuum в библиотеку занятий

Статус: `Active`

## Цель и контекст

Заменить перегруженную LMS-модель на закрытую библиотеку учебных материалов: возрастные группы, разделы, занятия, PDF, локально собранные интерактивные лекции и задачи. Сохранить Better Auth, роли, object storage, MathJax, PDF.js, Excalidraw, основные UI-примитивы и production foundation.

Текущие production-данные переносить не требуется. Production reset разрешён только как отдельный cutover и не выполняется автоматически.

## In scope

- новая доменная модель библиотеки;
- student catalog и lesson view;
- teacher authoring и доступы;
- PDF upload/view/download;
- versioned interactive packages и sandbox player;
- задачи с текстом, MathJax, изображениями и Excalidraw;
- удаление старой LMS, worker/Redis/LaTeX runtime;
- упрощение CI, Docker и документации;
- чистая инициализация production БД и storage при cutover.

## Out of scope

- перенос старых курсов, прогресса, попыток и submissions;
- автоматическая проверка задач;
- progress tracking и analytics;
- серверная TeX-компиляция;
- визуальный конструктор интерактивных лекций;
- автоматическая синхронизация с локальной папкой;
- deploy или push без отдельной команды пользователя.

## Сохраняемые контуры

- `apps/api/src/auth/*` и Better Auth integration;
- роли `admin`, `teacher`, `student`;
- базовые user/profile flows после упрощения зависимостей;
- `apps/api/src/infra/storage/*` после выделения узкого Assets interface;
- `/login`, auth client и route guards;
- Prisma/PostgreSQL, Zod, TanStack Query;
- MathJax, PDF.js и Excalidraw;
- role-specific route guards/layouts и пригодные общие UI primitives;
- health/ready и deployment foundation.

## Удаляемые контуры

- Course/Unit authoring и student traversal;
- graph/layout/prerequisite UI и React Flow;
- attempts, progress, locks, overrides и completion calculations;
- legacy photo-review workflow;
- notifications и legacy learning audit events;
- LaTeX compile endpoints, queue orchestration и rendered-fragment path;
- `apps/worker`, `packages/latex-runtime`, BullMQ и Redis;
- старые routes, contracts, tests и docs после замены соответствующего потока.

Excalidraw удалению не подлежит: он переводится в Task Authoring и отвязывается от `PhotoTaskSubmission`.

## Порядок выполнения

### Волна 0 — документация и инвентаризация

- [x] Зафиксировать продукт, словарь и целевую архитектуру.
- [x] Зафиксировать отсутствие миграции production-данных.
- [x] Создать active execution plan.
- [x] Составить карту keep/replace/delete по routes, modules, models, dependencies и env и проверить её repository search.
- [x] Отметить несвязанные изменения working tree и не перетирать их при зачистке.

### Волна 1 — новый контракт библиотеки

- [x] Добавить Zod-контракты `GradeBand`, `Section`, `Lesson`, `LessonArtifact`, `Task`, `AccessGrant`.
- [x] Заменить Prisma schema на минимальную целевую модель и создать destructive reset migration для локальной БД.
- [x] Добавить Library read/write modules с отдельными read/write paths.
- [x] Добавить access-policy tests: чужой доступ, draft, direct-link bypass.

Критерий выхода: API создаёт раздел и занятие, публикует его и возвращает только ученику с доступом. Выполнено на чистой локальной PostgreSQL через production API image.

### Волна 2 — новый student catalog

- [x] Перестроить `/student` под возрастные группы, разделы и плотный список занятий.
- [x] Добавить lesson view и состояния empty/loading/error.
- [x] Удалить student course/section/unit compatibility routes после переключения.

Критерий выхода: ученик с телефона и desktop открывает опубликованное занятие без legacy Learning API. Выполнено; teacher/student flow проверен реальным браузером на desktop и mobile viewport.

### Волна 3 — teacher authoring и доступы

- [x] Добавить первый экран материалов: создание разделов/занятий и публикация draft.
- [ ] Добавить редактирование, удаление и порядок разделов/занятий.
- [x] Добавить управление доступом ученика к возрастным группам.
- [x] Сохранить teacher/student provisioning, удалить зависимости от progress/photo-review.
- [ ] Вернуть admin provisioning преподавателей в новый минимальный UI.

Критерий выхода: учитель полностью готовит каталог и доступы без старых Course/Unit screens.

## Рабочая декомпозиция

Каждый пункт заканчивается проверяемым пользовательским потоком. Следующий пункт не должен расширять модель предыдущего «на будущее».

1. **Catalog core — готов.** Shared contracts, новая Prisma-модель, отдельные read/write services, teacher create/publish endpoints, student catalog/detail endpoints, tenant scope через `grantedById`, скрытие draft и защита direct URL. Проверен на чистой БД.
2. **Catalog UI — готов.** Плотный student catalog, lesson view, teacher materials screen, create/publish mutations и состояния loading/error/empty. Проверен в browser на desktop/mobile.
3. **Identity & Access UI — готов для teacher/student.** Узкий список учеников учителя, создание через единый identity provisioner, деактивация с отзывом сессий, выдача/снятие `GradeBand`; остаётся вернуть admin provisioning преподавателей.
4. **Редактирование структуры.** Переименование, описание, publish/unpublish, безопасное удаление пустых draft-сущностей и явный reorder для разделов/занятий.
5. **PDF vertical slice.** Presigned upload, metadata validation, immutable version, atomic activation, защищённый view/download URL и PDF.js reader. Добавление PDF не требует deploy.
6. **Interactive vertical slice.** Manifest и CLI для локального build output, versioned upload, atomic publish/rollback, отдельный origin/path и sandboxed iframe без cookie.
7. **Task authoring.** Безопасный текст и MathJax, изображения, lazy-loaded Excalidraw editor, scene JSON и статический preview; student route не загружает editor runtime.
8. **Hardening и cutover.** Полный role/access E2E, mobile/desktop QA, asset cleanup policy, backup/rollback rehearsal, затем только по отдельной команде — production reset и deploy.

## Ближайший порядок

1. Вернуть минимальный admin provisioning преподавателей.
2. Добавить редактирование и reorder без расширения доменной модели.
3. После стабилизации каталога перейти к PDF; interactive package не начинать раньше защищённой asset-выдачи.

### Волна 4 — материалы занятия

- [ ] Реализовать PDF upload/version/publish/view/download.
- [ ] Определить package manifest интерактивной лекции.
- [ ] Реализовать upload/version/atomic publish/rollback.
- [ ] Реализовать sandboxed iframe player без cookie access.
- [ ] Добавить локальную publish-команду, загружающую только build output.

Критерий выхода: новая версия PDF или лекции появляется без platform deploy; предыдущая версия доступна для rollback.

### Волна 5 — задачи и Excalidraw

- [ ] Добавить редактор безопасного текста и MathJax.
- [ ] Добавить изображения.
- [ ] Перенести Excalidraw в Task Authoring: scene JSON + SVG/PNG preview.
- [ ] Не загружать Excalidraw runtime на student read-path.

Критерий выхода: учитель создаёт задачу с диаграммой, ученик видит готовый preview и формулы.

### Волна 6 — удаление legacy runtime

- [x] Удалить Learning, graph, attempts, progress, overrides, photo review и старые contracts.
- [x] Удалить React Flow и неиспользуемые authoring-зависимости.
- [x] Удалить LaTeX endpoints, worker, latex-runtime, BullMQ и Redis.
- [x] Упростить Docker, CI, smoke и env contracts.
- [x] Удалить или переписать legacy SoR docs и regenerate generated docs.
- [x] Удалить локальные legacy images `continuum-api`, `continuum-worker`, `continuum-texlive-base` и Redis.
- [x] Удалить локальные legacy volumes worker/Redis и старые dependency caches.
- [x] После подтверждения удалить старые локальные PostgreSQL/MinIO data volumes и создать чистые.

Критерий выхода: repository search не находит runtime-ссылок на удалённые контуры; clean build/test/smoke проходят без worker и Redis.

### Волна 7 — production cutover

- [ ] Перед cutover проверить чистый build и локальный end-to-end flow.
- [ ] Зафиксировать rollback на предыдущий git/image revision.
- [ ] По явной команде очистить production DB и storage.
- [ ] Развернуть новую схему, bootstrap admin и выполнить smoke по ролям.
- [ ] После успешного smoke удалить production worker/Redis/TeX images, containers и volumes; предыдущий app image держать до окончания rollback window.

Критерий выхода: production health/ready, login, access control, PDF и interactive lesson подтверждены; старые сервисы остановлены.

## Decision log

### 2026-09-23 — controlled rewrite без совместимости данных

Новая модель создаётся без migration/backfill старого учебного состояния. До cutover старый production остаётся нетронутым.

По дополнительному решению пользователя compatibility UI не сохраняется: старые routes удаляются до готовности полного replacement flow, а `/student` и `/teacher` временно остаются минимальными защищёнными точками входа.

### 2026-09-23 — локальная сборка материалов

TeX и интерактивный HTML собираются локально. Платформа принимает готовые артефакты и не выполняет произвольный авторский код на API/worker.

### 2026-09-23 — Excalidraw сохраняется

Удаляется legacy photo-review workflow, но Excalidraw остаётся инструментом диаграмм задач с editable scene и статическим preview.

### 2026-09-23 — один runtime API

После удаления LaTeX pipeline worker и Redis не сохраняются «на всякий случай». Если позже появятся действительно фоновые задачи, очередь выбирается заново под фактическую нагрузку.

## Риски и rollback

- **Случайное удаление auth/storage кода.** Сначала replacement tests, затем удаление legacy callers.
- **Исполняемый HTML в authenticated DOM.** Только отдельный artifact type и sandboxed iframe.
- **Осиротевшие assets.** Явный lifecycle draft/publish/archive и cleanup policy до production.
- **Временная неполнота UI после hard cut.** Старые routes удалены по прямому решению пользователя; доступные `/student` и `/teacher` явно показывают состояние новой библиотеки и не имитируют готовую функциональность.
- **Cutover не запускается.** Откат на предыдущий revision и прежний compose; production reset выполняется только после финального подтверждения.

## Обязательные проверки

- `pnpm docs:check`
- `pnpm lint:boundaries`
- `pnpm --filter @continuum/shared test`
- `pnpm --filter web typecheck`
- `pnpm --filter web test`
- API tests и Docker build для затронутых backend-волн
- desktop/mobile browser smoke для обеих ролей
- перед cutover: auth, RBAC, direct-link access, signed assets, iframe isolation, health/ready

## Progress log

### 2026-09-23

- Пользователь подтвердил полную переработку и отсутствие необходимости сохранять production-данные.
- Зафиксированы целевой продукт, доменный словарь, архитектура и волны реализации.
- Удалены legacy SoR-документы про Learning, события, reliability, старую дизайн-систему и старые product proposals.
- Удалён архив execution plans старой LMS; история остаётся в Git.
- Добавлены первые Zod-контракты новой библиотеки и contract tests.
- API runtime отключён от Content/Learning/Events/Students и debug queue; readiness больше не требует Redis.
- Dev/prod compose больше не поднимают worker и Redis; smoke больше не проверяет очередь.
- Удалены старые web routes курсов, юнитов, review, analytics, events и role-specific login; `/student` и `/teacher` заменены чистыми защищёнными экранами новой библиотеки.
- Admin login переведён со старого `/admin/teachers` на чистый защищённый `/admin`.
- Физически удалены legacy API/web features, worker, LaTeX runtime, старые shared contracts и их тесты; Excalidraw, MathJax и PDF.js сохранены.
- Prisma сведена к Better Auth, профилям, `AccessGrant`, `Section`, `Lesson`, `Asset`, `LessonArtifact` и `Task`; создана новая destructive baseline migration.
- Удалены BullMQ, Redis, React Flow, CodeMirror, DnD и legacy authoring dependencies; lockfile пересчитан.
- Generated API/DB docs обновлены после удаления кода и смены схемы.
- `pnpm docs:check`, shared typecheck, web typecheck, web production build, boundary lint, compose config и `git diff --check` прошли.
- Локальный optional package `@rollup/rollup-darwin-arm64` сначала был установлен без native binary; полная переустановка из lockfile восстановила его.
- API/shared/web Vitest прошёл: 20 + 10 + 12 тестов.
- Несвязанные локальные изменения обнаружены и не затрагиваются.
- Добавлен новый `LibraryModule`: teacher read/write endpoints, student catalog/detail endpoints и проверка доступа по паре `GradeBand + granting teacher`.
- Добавлены unit tests на отсутствие доступа, draft/direct-link bypass, чужого ученика и публикацию только внутри собственного teacher scope.
- `/student` подключён к реальному Library API; добавлен `/student/lessons/[lessonId]` с материалами и задачами.
- Добавлен `/teacher/materials` для создания разделов/занятий и их последовательной публикации.
- После нового среза проходят shared tests (10), API tests (29), web tests (14), web typecheck и boundary lint.
- OrbStack запущен; production API image успешно собран в Docker, включая Prisma generate и backend TypeScript build.
- Локальные legacy images `continuum-api`, `continuum-worker`, `continuum-texlive-base` и оба Redis image удалены; сохранён новый `continuum-prod-api`.
- Legacy worker/Redis/dependency volumes удалены.
- После подтверждения старые PostgreSQL/MinIO volumes удалены; чистая baseline migration успешно применена.
- Исправлен production runner: pnpm заранее активируется через Corepack, поэтому migration command не требует runtime download.
- Удалены пустые каталоги старых Prisma migrations, которые попадали в Docker image и вызывали `P3015`.
- Добавлен повторяемый `smoke:library`; create → publish → grant → student read прошёл.
- `/teacher/materials`, `/student` и lesson detail проверены Playwright на desktop и mobile; console errors отсутствуют, временные screenshots удалены.
- Добавлен `IdentityAccessModule`: teacher-scoped roster, создание ученика через существующий Argon2 provisioning и деактивация с отзывом сессий.
- Добавлен `/teacher/students`: плотный список аккаунтов, создание, активация/деактивация и переключатели доступа для 7, 8, 9 и 10–11 классов.
- Контракты и unit-тесты расширены до shared 13, API 34 и web 15 тестов.
- Browser/API smoke подтвердил цепочку create student → grant 10–11 → student catalog → deactivate → existing session `401`; mobile layout проверен на 390×844, console errors нет.
- Production Docker build API, production build web, общий smoke и Better Auth smoke прошли; production не изменялся.
- Выбранный catalog mock зафиксирован как визуальный baseline: student catalog перенесён на точную геометрию header/tabs/двухколоночного списка; teacher materials и access screen приведены к тому же shell.
- Для visual QA локальная чистая БД заполнена демонстрационными разделами из макета; это локальные данные, не production seed.
- Выполнена проверка формулировок и визуальная полировка по `impeccable`: активные тексты интерфейса, пустые состояния, загрузка, ошибки, подсказки и пользовательские ошибки API приведены к краткому русскому языку; сырые сообщения сервера больше не попадают на экран входа.
- Удалена промежуточная страница учителя с техническим текстом: `/teacher` сразу открывает `/teacher/materials`; административная страница, страница «не найдено» и страницы ошибок приведены к белой дизайн-системе каталога.
- После полировки прошли 16 веб-тестов, 34 теста API, проверка типов и сборка веб-приложения, проверка границ модулей, документации и `git diff --check`; просмотр в браузере на настольной и мобильной ширине прошёл с чистой консолью.

## Task-specific troubleshooting

- Если Rollup снова сообщает `MODULE_NOT_FOUND` для `@rollup/rollup-darwin-arm64`, проверить наличие `rollup.darwin-arm64.node`; в этой сессии помогла полная переустановка `pnpm install --frozen-lockfile --prefer-offline` после пересчёта lockfile.
