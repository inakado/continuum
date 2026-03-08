# Execution Plan: Student Dashboard Redesign

Статус плана: `Active`

## 1. Цель

Переделать student dashboard (`/student`) под визуальный язык из `course_dashboards_export.md`, сохранив архитектурные принципы репозитория и улучшив UX:
- сделать главный экран ученика визуально сильным, но не “декоративным ради декора”;
- дать очевидный основной сценарий: `продолжить обучение`;
- сделать навигацию `курсы → разделы → граф` более понятной и эмоционально цельной;
- не сломать текущие инварианты history/localStorage restore, server-state discipline и typed contracts.

## 2. Контекст и исходные ограничения

### Что есть в референсе

- Главный экран с крупным hero-carousel курсов, glass-карточками и атмосферным фоном.
- Экран курса с большим заголовком, сводкой прогресса и карточками разделов.
- Анимации и переходы на базе `framer-motion`.
- Иконки и action affordances на базе `lucide-react`.
- Визуальный код написан через Tailwind utility classes.

### Что есть в текущем проекте

- Student dashboard реализован в [StudentDashboardScreen.tsx](../../../apps/web/features/student-dashboard/StudentDashboardScreen.tsx) и уже держит внутреннюю навигацию `courses → sections → graph`.
- Навигация синхронизируется через `window.history.state` и `LAST_SECTION_KEY`.
- Базовый shell и glass-контекст уже существуют в [DashboardShell.tsx](../../../apps/web/components/DashboardShell.tsx).
- Graph screen уже использует `ReactFlow`, `framer-motion` в проекте уже установлен, `lucide-react` уже используется.

### Архитектурные и дизайн-ограничения

- Tailwind нельзя переносить в продуктовый экран; референс нужно адаптировать в CSS Modules и дизайн-токены.
- Чтение данных должно оставаться в `@tanstack/react-query`, без ручного разрастания `useEffect` orchestration.
- UI не должен рендерить сырые статусы без mapping-слоя.
- Motion нужен точечно; частые interaction-path не должны опираться на тяжёлые blur/filter анимации.
- Нужно уважать `prefers-reduced-motion`.

### Выявленные продуктовые гэпы

- `GET /courses` и `GET /courses/:id` не отдают агрегированный course/section progress.
- Нет student read-path для карточки `Продолжить обучение`.
- Нет student notifications endpoint для правой информационной карточки из референса.
- В student content model нет image/cover полей для course/section, поэтому иллюстративный стиль из референса нельзя перенести один в один.
- В teacher content flow нет upload/edit path для course/section cover image, хотя это нужно для качественного наполнения нового dashboard UI.

## 3. Scope

### In scope

- Редизайн `/student` и связанных состояний `courses`, `sections`, `graph`.
- Добавление `course/section cover image` в teacher authoring flow, если это нужно для целевого student UX.
- Выделение нового student dashboard overview/read-model, если он нужен для UX.
- Декомпозиция frontend-кода student dashboard на container/hooks/presentational blocks.
- Перенос visual language и motion-паттернов из референса в рамках текущей дизайн-системы.
- Обновление SoR-доков при изменении фактического поведения или UI-конвенций.

### Out of scope

- Полный редизайн student unit screen (`/student/units/[id]`).
- Изменения teacher dashboard.
- Внедрение Tailwind в продуктовые экраны.
- Обязательное добавление course/section media pipeline в первый проход.

## 4. Decision log

1. Переносим не код Tailwind, а визуальную систему: композицию, иерархию, motion и affordances.
2. Сохраняем текущую IA `courses → sections → graph`; редизайн не должен ломать existing history/back-forward restore.
3. Для hero/summary/continue-learning/notifications предпочтителен отдельный read-only dashboard endpoint, а не склейка UI из нескольких несвязанных запросов.
4. Course/section images добавляем через тот же storage-паттерн, что и task statement image: `presign-upload -> PUT -> apply assetKey -> presign-view`, без прямого доступа UI к bucket.
5. Для cover images предпочтителен generic content-image policy/helper, а не копирование task-specific policy с другим неймингом.
6. До появления реальных изображений MVP может опираться на абстрактные background/gradient/decorative surfaces.
7. `framer-motion` используем только для high-signal моментов: hero swap, deck reordering, entry transitions. Hover/focus оставляем на CSS.
8. Если progress-метрики недоступны в контракте, UI не должен рисовать “фейковые” проценты; сначала контракт, потом визуализация.

## 5. Целевой UX

### Courses view

- Крупный персонализированный заголовок + короткий subcopy.
- Hero-carousel курсов как основная точка выбора.
- Отдельная карточка `Продолжить обучение` с самым полезным следующим действием.
- Отдельная карточка активности/уведомлений справа, если есть реальные данные; иначе fallback на “что нового/что доступно”.

### Sections view

- Курс ощущается отдельным экраном, а не просто списком кнопок.
- Вверху: название курса, краткое описание, агрегированный прогресс курса и счётчик разделов.
- Разделы показываются как большие карточки со статусом доступности, ясным CTA и аккуратным lock-state.

### Graph view

- Сохраняем почти full-viewport canvas и текущую кликабельную модель.
- Визуально связываем graph screen с новыми courses/sections экранами через общий header, glass surfaces и статусные подсказки.
- Легенда и lock-hints должны быть вторичными и не спорить с графом за внимание.

### Mobile

- Carousel не должен ломаться на узких экранах: deck либо ужимается в горизонтальный rail, либо упрощается до single-card pager.
- Карточки секций и summary stack’аются вертикально без потери CTA и статусов.
- Граф остаётся viewport-aware, но overlay и legend не должны перекрывать nodes.

## 6. План реализации

### Wave 0. UX inventory и freeze структуры

- Зафиксировать состав экранов `courses / sections / graph`.
- Решить, какие блоки обязательны для MVP:
  - `hero carousel`;
  - `continue learning`;
  - `activity/notifications`;
  - `course summary`;
  - `section cards`.
- Зафиксировать, какие блоки могут рендериться conditionally при отсутствии новых данных.

### Wave 1. Dashboard read-model и контракты

- Добавить shared contract для student dashboard overview, например отдельный `StudentDashboardOverviewResponseSchema`.
- Реализовать read-only endpoint для `/student/dashboard` или эквивалентный student-specific route.
- В агрегате предусмотреть:
  - `courses[]` c минимумом для hero-card;
  - `continueLearning` c маршрутом до следующего полезного шага;
  - `notifications/activity` для правой карточки;
  - course/section summary metrics, если они нужны на экране.
- Собрать read-model через `Content + Learning + Notification` read-path без смешивания с write orchestration.
- Добавить boundary tests для нового API-контракта и shared schema tests.

### Wave 1A. Course/section cover image pipeline

- Расширить Prisma/контракты для `Course` и `Section` полями cover asset key, например:
  - `Course.coverImageAssetKey`
  - `Section.coverImageAssetKey`
- Добавить teacher endpoints для:
  - `presign-upload`
  - `apply`
  - `delete`
  - `presign-view`
- Использовать существующий `ObjectStorageService` и S3-compatible runtime (`MinIO` в dev, внешний S3 в production) без отдельного storage контура.
- Вынести ограничения в policy-as-code:
  - allowed content types;
  - max size;
  - TTL;
  - server-generated asset key prefix/pattern.
- Предпочтительно сделать это как reusable content-cover-image helper/policy для `course` и `section`, а не двумя полностью независимыми реализациями.
- Добавить teacher UI в dashboard/edit mode:
  - upload/replace/remove cover;
  - preview по presigned view URL;
  - честные loading/error states.
- Протянуть cover image в student read-model и использовать его в hero/section cards там, где это улучшает UX.

### Wave 2. Frontend decomposition

- Разделить [StudentDashboardScreen.tsx](../../../apps/web/features/student-dashboard/StudentDashboardScreen.tsx) на:
  - container/state orchestration;
  - dashboard read hooks;
  - presentational screens;
  - reusable card/carousel primitives.
- Вынести navigation/history logic в отдельный hook/helper, чтобы редизайн не смешивался с back/restore логикой.
- Сохранить `react-query` как единственный server-state слой для dashboard reads.

### Wave 3. Visual foundation

- Перенести стеклянную композицию из референса в CSS Modules с опорой на текущие `--glass-*`, `--surface-*`, `--card-*`, `--panel-*`.
- Добавить локальные dashboard tokens для:
  - hero/deck heights;
  - ambient background layers;
  - section card variants;
  - stat badges и action areas.
- Переписать motion-паттерны референса на `framer-motion` + CSS transitions без Tailwind.
- Сразу встроить reduced-motion fallback.

### Wave 4. Courses screen redesign

- Реализовать `StudentCourseCarousel` как отдельный компонент/блок, а не внутри большого screen file.
- Добавить обзорный hero-блок с title/description/progress/CTA.
- Добавить карточку `Продолжить обучение`:
  - если есть `continueLearning`, вести в unit или section;
  - если данных нет, fallback на последний section graph или первый доступный course/section.
- Добавить правую secondary card:
  - сначала на реальных notifications/activity;
  - временный fallback допустим только как честный informational block, а не fake inbox.

### Wave 5. Sections screen redesign

- Сделать отдельный course-header с прогрессом, описанием и meta.
- Пересобрать section cards:
  - явный статус доступности;
  - краткое описание, если появится в student contract;
  - аккуратный locked state;
  - единый CTA `Открыть`.
- Если section progress отсутствует в контракте, не мимикрировать под референс; лучше показать count/meta, чем рисовать недостоверный прогресс.

### Wave 6. Graph screen alignment

- Сохранить [StudentSectionGraphPanel.tsx](../../../apps/web/features/student-dashboard/StudentSectionGraphPanel.tsx) как отдельную feature-boundary.
- Обновить top summary, back affordance, legend presentation и visual container.
- Не трогать поведение unlock/locked hints и node click rules, кроме UI-слоя.
- Проверить, что высота canvas по-прежнему соответствует SoR-правилу viewport-aware graph screen.

### Wave 7. Docs и quality gates

- Обновить `documents/FRONTEND.md`, если меняется frontend route behavior/read-model organization.
- Обновить `documents/DESIGN-SYSTEM.md`, если появятся новые фактические dashboard patterns/tokens.
- При изменении UX-семантики dashboard обновить `documents/DESIGN.md`.
- Прогнать:
  - `pnpm lint`
  - `pnpm lint:boundaries`
  - `pnpm typecheck`
  - `pnpm --filter web test`
  - при API-изменениях: `pnpm --filter @continuum/api test`

## 7. Риски и меры контроля

- Риск: референс провоцирует копирование Tailwind-структуры в продуктовый код.
  Контроль: портировать только layout/motion ideas, реализацию строить на CSS Modules и design tokens.

- Риск: UI-дизайн потребует данных, которых нет в текущем student contract.
  Контроль: сначала зафиксировать read-model, потом рисовать финальные summary cards.

- Риск: upload flow для `course/section` будет скопирован с task statement image почти дословно и разведёт дублирующую policy-логику.
  Контроль: выделить reusable image-upload primitives/contracts там, где это не ломает SRP и не размывает domain boundaries.

- Риск: новый overview screen раздутым контейнером смешает reads, navigation state и UI.
  Контроль: жёсткая декомпозиция `query hooks / nav hook / presentational blocks`.

- Риск: анимации ухудшат производительность и читаемость.
  Контроль: no heavy blur in repeated interactions, reduced-motion path, CSS-first hover states.

- Риск: будет сломан restore flow через `LAST_SECTION_KEY` и browser history.
  Контроль: сохранить существующие тест-кейсы и расширить их под новый layout.

## 8. Критерии завершения

- `/student` визуально соответствует новому direction: hero-first, glass, ясная иерархия, понятный CTA.
- Учитель может загрузить/заменить/удалить cover image для курса и раздела через S3-compatible flow, согласованный с текущими storage-паттернами.
- Основной user journey `зайти → выбрать курс → выбрать раздел → открыть граф/юнит` стал короче и понятнее без потери текущей логики восстановления состояния.
- `continue learning` и secondary activity card работают на реальных данных либо имеют честный fallback.
- Sections screen визуально отделён от courses screen и ясно показывает доступность разделов.
- Graph screen выглядит частью единой dashboard-системы, не ломая ReactFlow UX.
- Код остаётся в рамках SRP, server-state discipline и typed contracts.

## 9. Проверки по UX/UI

- Заголовки и акцентная типографика используют текущие font roles, без возврата к случайным font stacks.
- Контраст текста и CTA проходит для light/dark theme.
- Hover/focus состояния понятны клавиатурному пользователю.
- На mobile нет горизонтального развала hero/section cards.
- Progress UI не смешивает `completionPercent` и `solvedPercent` в один “магический” показатель.

## 10. Progress log

- `2026-03-08`: разобран `course_dashboards_export.md`, текущий student dashboard, SoR-доки и выявлены контрактные гэпы для `continue learning`, notifications и aggregated progress.

## 11. Troubleshooting

- Пока пусто.
