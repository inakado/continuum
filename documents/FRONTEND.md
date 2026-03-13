# FRONTEND

Назначение: текущая frontend-архитектура, UI-конвенции и поведение клиентского слоя.

## Scope

- App Router структура (Next.js)
- Feature boundaries (`features/components/lib`)
- API client слой (cookie auth + refresh)
- Server-state правила
- UI primitives, motion и asset preview rules
- rendered-content flow для student unit `theory/method`
- rendered-content flow для `task solution` (teacher + student)

## Structure

### Слои и ответственность

1. `apps/web/app/**`
- композиция routes, layout, page shells и navigation boundaries.

2. `apps/web/features/**`
- use-case уровень: загрузка данных, мутации, orchestration, адаптация данных под UI.

3. `apps/web/components/**`
- shared role-neutral UI primitives и инфраструктурные presentation helpers без доменной логики.

4. `apps/web/lib/**`
- infra/helpers:
  - `apps/web/lib/api/**` — API client;
  - `apps/web/lib/query/**` — query client и query keys;
  - `apps/web/lib/status-labels.ts` — единый источник статусов и label mapping.

### Role-scoped dashboard boundaries

- Teacher dashboard visual system и student dashboard visual system считаются разными baseline, даже если используют общие foundation tokens и общий UI-kit.
- Teacher-specific presentation patterns живут в teacher feature-модулях и shared teacher-first primitives.
- Student-specific presentation patterns для нового dashboard живут в `apps/web/features/student-dashboard/*`.
- Прямой импорт teacher feature UI в student feature UI (и наоборот) не допускается; переиспользование идёт через role-neutral слой.
- Enforced guardrails:
  - `eslint-plugin-boundaries` запрещает cross-import между `features/student-*` и `features/teacher-*`;
  - `no-restricted-imports` запрещает прямой импорт `@/components/DashboardShell` из role-specific feature-кода; используются `StudentDashboardShell` / `TeacherDashboardShell`.
- Sidebar/shell реализация разделена по ролям:
  - student routes используют отдельный `StudentDashboardShell` + `student-dashboard-shell.module.css`;
  - teacher routes используют отдельный `TeacherDashboardShell` + `teacher-dashboard-shell.module.css`.
  - `DashboardShell` оставлен только как deprecated compatibility alias и не используется в role-specific feature-коде.
- Role-scoped theme слой также разделён:
  - student dashboard theme: `apps/web/components/student-dashboard-theme.module.css`;
  - teacher dashboard theme: `apps/web/components/teacher-dashboard-theme.module.css`.
  - Theme-модули подключаются на root shell и переопределяют semantic tokens (`--bg-accent`, `--button-hover-*`, `--nav-*`) только в пределах своей role subtree.

### Практическая карта UI-правок (role ownership)

| Что меняем | Где менять | Что не трогать в этой задаче |
|---|---|---|
| Teacher sidebar layout/анимации | `apps/web/components/TeacherDashboardShell.tsx`, `apps/web/components/teacher-dashboard-shell.module.css` | `StudentDashboardShell.tsx`, `student-dashboard-shell.module.css` |
| Teacher sidebar/button/nav цвета и hover/active | `apps/web/components/teacher-dashboard-theme.module.css` | `student-dashboard-theme.module.css`, `globals.css` (если задача только teacher) |
| Student sidebar layout/анимации | `apps/web/components/StudentDashboardShell.tsx`, `apps/web/components/student-dashboard-shell.module.css` | `TeacherDashboardShell.tsx`, `teacher-dashboard-shell.module.css` |
| Student sidebar/button/nav цвета и hover/active | `apps/web/components/student-dashboard-theme.module.css` | `teacher-dashboard-theme.module.css`, `globals.css` (если задача только student) |
| Teacher feature-экран UI | `apps/web/features/teacher-*/*` | `apps/web/features/student-*/*` |
| Student dashboard feature-экран UI | `apps/web/features/student-dashboard/*` | `apps/web/features/teacher-*/*` |
| Shared кнопки/инпуты/примитивы для обеих ролей | `apps/web/components/ui/*` | role theme-файлы, если изменение должно быть глобальным |
| Foundation tokens и reset | `apps/web/app/globals.css` | role-specific theme-файлы, если изменение должно быть только для одной роли |

Правило применения:
- Если UX-изменение относится к одной роли, сначала ищем решение в role theme/shell/feature слое.
- До `components/ui/*` и `globals.css` доходим только если изменение осознанно общее для teacher и student.

### Конвенция статусов в UI

- В экранах и компонентах запрещено рендерить сырой enum напрямую (`locked`, `available`, `draft`, `published` и т.п.).
- Любой новый статус сначала добавляется в `apps/web/lib/status-labels.ts`, затем используется через явный mapping-layer.

### Терминология required-задач в UI

- В user-facing копирайте фронта required-задачи именуются как `Ключевая`/`Ключевые`.
- Доменный и контрактный нейминг не меняется: `isRequired`, `requiredSkipped`, `required_*` events/notification codes.
- На student unit screen (`/student/units/[id]`) ключевые задачи визуально отмечаются иконкой в task tabs и в заголовке task card.

## Routes Map

- `/login` — общий логин.
- `/student/login`, `/teacher/login` — role-specific entrypoints.
- `/student` — student dashboard.
- `/student/courses`, `/student/courses/[id]`, `/student/sections/[id]` — legacy student content routes (compatibility layer, не целевой baseline для нового student dashboard).
- `/student/units/[id]` — просмотр юнита студентом.
- `/teacher` — teacher dashboard.
- `/teacher/sections/[id]` — section + graph view.
- `/teacher/units/[id]` — unit editor/view.
- `/teacher/students` и `/teacher/students/[studentId]` — управление учениками.
- `/teacher/review` и `/teacher/review/[submissionId]` — фото-проверка.
- `/teacher/events` — audit/event log.
- `/teacher/analytics` — analytics route, если включена в текущем UI.
- `/teacher/settings` — teacher settings.

## API Client Behavior

- Все запросы к backend идут с `credentials: "include"`.
- На `401` клиент пытается сделать `POST /auth/refresh` и повторить исходный запрос, кроме `/auth/login`, `/auth/refresh`, `/auth/logout`.
- Если refresh вернул `REFRESH_TOKEN_STALE`, клиент делает короткую паузу и повторяет исходный запрос с текущими cookie.
- Базовый URL — `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000`).
- Для ключевых transport boundaries используется runtime parsing через shared contracts.

## Server-State Rules

- `@tanstack/react-query` — основной server-state слой web.
- Query client и key factories централизованы в `apps/web/lib/query/*`.
- Query-driven read flows и mutation + invalidation model являются default для экранов с server-state.
- Ручные anti-race паттерны, `cancelled` guards и `requestIdRef` допустимы только там, где их нельзя заменить query lifecycle.
- Read-path и write-path должны быть разделены: чтение через query, запись через mutation/hook orchestration.
- Student dashboard overview читает aggregated read-model через отдельный query (`/student/dashboard`), а не собирает hero/continue-learning сводку вручную из нескольких client-side запросов.
- Student dashboard course landing использует hybrid read-path:
  - overview/hero/stat cards — из aggregated query `/student/dashboard`;
  - sections landing — из `GET /courses/:id`, где student UI использует section descriptions и student-specific `accessStatus` для навигационных карточек.
- Locked section cards на student dashboard не ведут в graph view: UI рендерит их disabled-state, а backend дополнительно защищает `GET /sections/:id`, `GET /sections/:id/graph` и direct unit access от обхода последовательности курса.

## Presigned Assets and CORS

- Presigned PDF/asset preview из object storage рендерится без credentials (`withCredentials = false`).
- Это исключает отправку auth-cookie на внешний storage origin и предотвращает CORS-блокировку при `credentials: include`.
- Teacher cover image flow для `Course/Section` использует тот же presign pattern, что и другие content assets:
  - backend выдаёт upload/view URLs;
  - web делает direct upload в storage;
  - сохранение asset key подтверждается отдельным apply step.
- В student unit PDF tabs zoom хранится отдельно по target; теория и методика открываются с масштабом `50%`.
- Для student unit `theory/method` primary read-path теперь идёт через backend endpoint `rendered-content`, который отдаёт уже подписанный HTML fragment и optional `pdfUrl`.
- Для student task solution primary read-path идёт через `GET /student/tasks/:taskId/solution/rendered-content`; PDF viewer для решения задачи не используется.
- В `StudentUnitHtmlPanel` кнопка `Скачать PDF` не использует сохранённый при первичной загрузке `pdfUrl` как единственный источник: перед открытием файла panel запрашивает свежий rendered-content (`refresh*Content`) и берёт актуальный presigned URL.
- HTML fragment рендерится как часть страницы; legacy PDF preview остаётся fallback path для unit без собранного HTML.
- Rich math внутри student/teacher HTML preview typeset'ится локальным MathJax helper из workspace, а не CDN/runtime с внешнего origin.
- MathJax helper работает как сериализованный runtime:
  - typeset вызовы выполняются через очередь (без конкурентных гонок);
  - при runtime-сбое есть controlled retry с переинициализацией MathJax script.
- В teacher unit editor preview для `theory/method` живёт внутри того же preview container и поддерживает два режима: `PDF` и `HTML`. HTML preview читает backend `teacher/units/:id/rendered-content`, а PDF preview остаётся canvas-based.
- В teacher unit tasks editor preview решения задачи (`TeacherTaskSolutionSection`) рендерится только HTML через `GET /teacher/tasks/:taskId/solution/rendered-content`.

## UI Primitives and Motion

- Базовый UI-kit живёт в `apps/web/components/ui/*`.
- Shared presentation primitives для teacher dashboard живут там же:
  - `PageHeader`
  - `SurfaceCard` / `PanelCard` / `SectionCard` / `InsetCard`
  - `FieldLabel`
  - `InlineStatus`
  - `EmptyState`
  - `Kicker`
- Для сложных interactive primitives используются локальные обёртки над Radix primitives.
- В teacher dashboard карточки курса и раздела переключают publish/draft через `Switch`-контрол (а не icon-only toggle button).
- В teacher unit tasks list публикация задачи переключается через `Switch` на карточке задачи; форма создания новой задачи не публикует её сразу и оставляет `draft` по умолчанию.
- `Button` использует typed semantic API:
  - variants: `primary`, `secondary`, `ghost`, `danger`
  - sizes: `sm`, `md`, `lg`
- `Button`/`ButtonLink` остаются role-neutral primitives (`apps/web/components/ui/button.module.css`), а финальный visual результат зависит от role-scoped tokens, заданных в соответствующем dashboard shell theme module.
- Для route navigation, которая выглядит как button CTA, используем `ButtonLink`/`Link`, а не `button + router.push`.
- Teacher screens не должны по умолчанию строить CTA через контейнерные `--button-*` overrides; сначала выбирается variant/size, overrides остаются только для локально уникальных случаев.
- Button semantics для teacher routes:
  - `primary` = create/save/confirm/accept/next-step;
  - `secondary` = refresh/open/compile/utility;
  - `ghost` = quiet nav, inline edit или non-destructive dismiss без сильного акцента;
  - `danger` = delete/reject/remove.
- `framer-motion` применяется точечно для React UI-анимаций; layout-size анимации по возможности остаются на CSS custom properties.
- Для frequently triggered interactions избегаем тяжёлых `filter: blur(...)` и уважаем `prefers-reduced-motion`.
- Student dashboard может иметь другой visual language и набор presentation blocks; teacher shared primitives не являются обязательным baseline для student feature UI.

## Typography Runtime

- Шрифты подключаются локально через `@fontsource/*` в `apps/web/app/layout.tsx`; CDN/Google Fonts runtime не используется.
- Токены в `apps/web/app/globals.css`:
  - `--font-logo` = `Unbounded` (только для логотипного текста `Континуум`),
  - `--font-onest` = `Onest` (заголовки и интерфейсные акценты),
  - `--font-inter` = `Inter` (основной текст).
- Semantic typography layer:
  - title roles: `--text-title-display-*`, `--text-title-page-*`, `--text-title-section-*`, `--text-title-card-*`
  - body roles: `--text-body-md-*`, `--text-body-sm-*`
  - label/meta roles: `--text-label-*`, `--text-caption-*`, `--text-overline-*`, `--text-mono-*`
- Teacher dashboard baseline:
  - `Onest` = headings/kickers/labels
  - `Inter` = body/forms/tables/meta
  - `Unbounded` не используется как обычный heading face вне бренда
- Teacher `students` / `review` detail screens не вводят свой отдельный scale:
  - identity headers = `page-title`,
  - drilldown headings = `section-title`,
  - table/card titles = `card-title`,
  - table/meta/help text = `body-sm` / `caption`.
- Для совместимости существующих CSS-модулей `--font-unbounded` алиасится на `--font-onest`; новая вёрстка не должна использовать `--font-unbounded` как “брендовый” шрифт.

## Teacher Dashboard Baseline

- Канонический visual baseline teacher UI = `TeacherDashboardShell` + glass tokens + shared UI primitives + feature CSS Modules.
- В репозитории больше нет параллельного legacy teacher CRUD flow для курсов/разделов; teacher dashboard baseline является единственным SoR для этого домена на web.
- Teacher features собираются по схеме:
  - data/query orchestration в `features/**`
  - presentation composition в shared `components/ui/*`
  - локальные CSS только для feature-specific layout/state, а не для дублирования базовых panel/header/label/status/button patterns
- Новые и существующие teacher read screens используют `react-query`; `useEffect + useState` CRUD-read flow не считается допустимым baseline для teacher dashboard.

## Student Dashboard Baseline (`In progress`)

- Новый student dashboard baseline развивается в `apps/web/features/student-dashboard/*` и используется маршрутом `/student`.
- Shell-уровень student dashboard использует `StudentDashboardShell` с отдельным CSS-модулем (`student-dashboard-shell.module.css`).
- Цвет/hover/CTA токены student dashboard задаются отдельным `student-dashboard-theme.module.css`, поэтому изменение кнопок и sidebar-интерактивов студента не должно затрагивать teacher dashboard.
- Текущий student flow опирается на aggregated read-model (`GET /student/dashboard`) + course detail read (`GET /courses/:id`) и встроенную навигацию `courses -> sections -> graph`.
- Визуальная система student dashboard может осознанно отличаться от teacher dashboard; совпадение токенов/компонентов не является целью само по себе.
- Legacy маршруты `/student/courses*` и `/student/sections/[id]` поддерживаются как переходный compatibility слой до завершения миграции.

## Navigation Patterns

- Teacher dashboard edit flow и student dashboard (`/student`) синхронизируют внутридашбордную навигацию с `window.history.state`.
- Browser `Back/Forward` должен возвращать предыдущий UI-шаг внутри dashboard, а не ломать user journey.
- В teacher unit editor route exits через breadcrumbs/back-actions обязаны проходить через shared dirty-form guard; минимум инварианта:
  - `beforeunload` предупреждение при `isDirty`;
  - in-app exit из editor не теряет изменения без confirm dialog.
- В student и teacher view `Раздел → Граф` canvas-контейнер должен занимать почти весь viewport по высоте (viewport-aware `dvh`) с сохранением нижнего визуального зазора.
- Teacher create/edit flow для `Course/Section` открывает формы в modal `Dialog` с overlay/focus trap; inline-формы внутри списка карточек не используются, а create modal поддерживает тот же cover image flow (`pick preview -> create -> presign upload -> apply`) что и edit.
- Teacher students flow использует focused modal `Dialog` для создания и редактирования ученика, а также для одноразового показа нового/сброшенного пароля; inline-формы внутри списка учеников не используются.
- Teacher students list при больших наборах данных использует windowing/virtualized rendering; не рендерим длинный список учеников как full unbounded `.map()` без причины.
- В teacher student profile drilldown (`/teacher/students/[studentId]`) карточки курсов и разделов рендерятся вертикальным списком; для раздела сохраняется внутренний drilldown в прогресс ученика и отдельное прямое действие `Открыть раздел`, ведущее в `/teacher/sections/[id]`.
- Teacher `students` visual baseline:
  - список учеников = compact registry rows, а не высокие dashboard cards;
  - профиль ученика = compact identity header + immediate workspace;
  - `courses -> sections -> units` уплотняются по мере drilldown, где `units` остаётся table-first рабочим уровнем;
  - breadcrumbs в `Материалы и прогресс` остаются secondary navigation и не дублируются отдельными stage titles.
- Teacher dashboard interactive card pattern:
  - hover у карточек `курсы/разделы/ученики` и у row-like drilldown cards должен быть одинаковым;
  - базовое состояние hover = лёгкий подъём (`translateY(-2px)`), `--glass-shadow`, `--surface-2`, мягкий `--glass-border`;
  - новые teacher screens не вводят отдельные локальные card-hover эффекты без явной причины.

## Related Source Links

- `apps/web/app/`
- `apps/web/features/`
- `apps/web/components/`
- `apps/web/components/ui/`
- `apps/web/lib/api/client.ts`
- `apps/web/lib/query/query-client.ts`
- `apps/web/lib/query/query-provider.tsx`
- `apps/web/lib/query/keys.ts`
- `apps/web/lib/status-labels.ts`
