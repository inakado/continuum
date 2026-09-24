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
- задачи как versioned PDF-артефакт;
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

Excalidraw удалению не подлежит, но после перехода задач на PDF не входит в текущий authoring flow.

## Порядок выполнения

### Волна 0 — документация и инвентаризация

- [x] Зафиксировать продукт, словарь и целевую архитектуру.
- [x] Зафиксировать отсутствие миграции production-данных.
- [x] Создать active execution plan.
- [x] Составить карту keep/replace/delete по routes, modules, models, dependencies и env и проверить её repository search.
- [x] Отметить несвязанные изменения working tree и не перетирать их при зачистке.

### Волна 1 — новый контракт библиотеки

- [x] Добавить Zod-контракты `GradeBand`, `Section`, `Lesson`, `LessonArtifact`, `AccessGrant`.
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
- [x] Добавить переименование разделов/занятий; удаление и порядок остаются следующими операциями.
- [x] Добавить управление доступом ученика к возрастным группам.
- [x] Сохранить teacher/student provisioning, удалить зависимости от progress/photo-review.
- [ ] Вернуть admin provisioning преподавателей в новый минимальный UI.

Критерий выхода: учитель полностью готовит каталог и доступы без старых Course/Unit screens.

## Рабочая декомпозиция

Каждый пункт заканчивается проверяемым пользовательским потоком. Следующий пункт не должен расширять модель предыдущего «на будущее».

1. **Catalog core — готов.** Shared contracts, новая Prisma-модель, отдельные read/write services, teacher create/publish endpoints, student catalog/detail endpoints, tenant scope через `grantedById`, скрытие draft и защита direct URL. Проверен на чистой БД.
2. **Catalog UI — готов.** Плотный student catalog, lesson view, teacher materials screen, create/publish mutations и состояния loading/error/empty. Проверен в browser на desktop/mobile.
3. **Identity & Access UI — готов для teacher/student.** Узкий список учеников учителя, создание через единый identity provisioner, деактивация с отзывом сессий, выдача/снятие `GradeBand`; остаётся вернуть admin provisioning преподавателей.
4. **Редактирование структуры.** Переименование готово; описание, publish/unpublish, безопасное удаление пустых draft-сущностей и явный reorder остаются.
5. **PDF vertical slice.** Presigned upload, проверка метаданных и сигнатуры, SHA-256, versioned teacher view и защищённая выдача опубликованных PDF ученику реализованы; browser upload/publish и API smoke прошли локально. Отдельное скачивание и rollback остаются.
6. **Interactive vertical slice.** Manifest и CLI для локального build output, versioned upload, atomic publish/rollback, отдельный origin/path и sandboxed iframe без cookie.
7. **Задачи PDF.** Отдельный versioned `tasks_pdf` загружается и публикуется тем же защищённым потоком, что и конспект.
8. **Hardening и cutover.** Полный role/access E2E, mobile/desktop QA, asset cleanup policy, backup/rollback rehearsal, затем только по отдельной команде — production reset и deploy.

## Ближайший порядок

1. Вернуть минимальный admin provisioning преподавателей.
2. Добавить редактирование и reorder без расширения доменной модели.
3. После стабилизации каталога перейти к PDF; interactive package не начинать раньше защищённой asset-выдачи.

### Волна 4 — материалы занятия

- [ ] Завершить PDF vertical slice: teacher upload/version/publish/view, student view URL и browser upload smoke готовы; остаются отдельное скачивание и rollback.
- [ ] Определить package manifest интерактивной лекции.
- [ ] Реализовать upload/version/atomic publish/rollback.
- [ ] Реализовать sandboxed iframe player без cookie access.
- [ ] Добавить локальную publish-команду, загружающую только build output.

Критерий выхода: новая версия PDF или лекции появляется без platform deploy; предыдущая версия доступна для rollback.

### Волна 5 — задачи PDF

- [x] Добавить отдельный тип `tasks_pdf` и тот же versioned upload flow, что для конспекта.
- [x] Добавить защищённое открытие задач PDF учеником после проверки публикации и доступа.
- [x] Не загружать Excalidraw runtime на student read-path.

Критерий выхода: учитель загружает PDF с задачами, ученик открывает опубликованную версию.

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

- [x] Перед cutover проверить чистый build и локальный end-to-end flow.
- [x] Зафиксировать предыдущий Git revision `e9d5677`; из-за несовместимого destructive reset откат старого runtime не используется.
- [x] По явной команде очистить production DB и storage.
- [x] Развернуть новую схему, восстановить существующие auth identities без старых сессий и выполнить production auth smoke.
- [x] После успешного smoke удалить production worker/Redis/TeX images, containers, volumes и старый BuildKit cache.

Критерий выхода текущего cutover выполнен: production health/ready, login и access control подтверждены; старые сервисы удалены. Загрузка PDF и interactive artifacts остаётся следующей продуктовой волной, а не частью этого cutover.

## Decision log

### 2026-09-23 — controlled rewrite без совместимости данных

Новая модель создаётся без migration/backfill старого учебного состояния. До cutover старый production остаётся нетронутым.

По дополнительному решению пользователя compatibility UI не сохраняется: старые routes удаляются до готовности полного replacement flow, а `/student` и `/teacher` временно остаются минимальными защищёнными точками входа.

### 2026-09-23 — локальная сборка материалов

TeX и интерактивный HTML собираются локально. Платформа принимает готовые артефакты и не выполняет произвольный авторский код на API/worker.

### 2026-09-23 — Excalidraw сохраняется

Удаляется legacy photo-review workflow. Excalidraw остаётся зависимостью для будущих авторских инструментов, но текущие задачи публикуются готовым PDF.

### 2026-09-23 — задачи публикуются PDF-файлом

Пользователь отказался от структурированного редактора задач в первой версии. Конспект и задачи являются независимыми versioned PDF-артефактами; публикация занятия атомарно активирует их последние версии.

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
- Runtime-модель сведена к Better Auth, профилям, `AccessGrant`, `Section`, `Lesson`, `Asset` и `LessonArtifact`; старая физическая таблица `tasks` оставлена до отдельной подтверждённой очистки локальных данных.
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
- Переработка зафиксирована в `6c88b80`; после блокировки Trivy зависимости обновлены в `09315f6` до исправленных версий, повторный GitHub CI (quality + security) прошёл.
- Production cutover выполнен на `09315f6`: чистая baseline migration применена, 5 существующих auth identities и профили сохранены, прежние сессии и учебные данные удалены, S3 подтверждён пустым.
- Production auth smoke прошёл через временные teacher/student identities; временные записи после проверки удалены.
- Worker, Redis, TeX Live, старые PostgreSQL/Redis volumes и около 9,9 ГБ старого BuildKit cache удалены; Orbit не затронут. После очистки на VPS свободно около 25 ГБ.

### 2026-09-24

- Экран материалов переведён на выбранный двухпанельный дизайн: вкладки классов, сворачиваемые разделы, редактирование названий и инспектор занятия.
- Конспект и задачи загружаются независимыми PDF-версиями; ученик получает подписанную ссылку только на опубликованную активную версию в разрешённом классе.
- Локальный API smoke и браузерная загрузка/публикация PDF прошли; desktop `1488 × 1058` и mobile `390 × 844` просмотрены. Пять созданных smoke-разделов и пять S3-объектов удалены после проверки.
- Production API Docker image, web build, shared/API/web tests, boundary lint и docs checks прошли. Для production S3 подготовлены CORS-настройка и проверка preflight до переключения API.

## Task-specific troubleshooting

- Если Rollup снова сообщает `MODULE_NOT_FOUND` для `@rollup/rollup-darwin-arm64`, проверить наличие `rollup.darwin-arm64.node`; в этой сессии помогла полная переустановка `pnpm install --frozen-lockfile --prefer-offline` после пересчёта lockfile.
