# FRONTEND

Статус: `Draft` (источник истины — код).

## Scope

- App Router структура (Next.js)
- Feature boundaries (features/components/lib)
- API-client слой (cookie auth + refresh)
- Конвенции статусов/лейблов

## Structure (`Implemented`)

### Слои и ответственность

1) `apps/web/app/**` (routes/pages)
- Роль: композиция страниц, навигация, layout/error boundaries.

2) `apps/web/features/**` (feature modules)
- Роль: use-cases UI: загрузка/мутации/состояния, адаптация данных под компоненты.

3) `apps/web/components/**` (shared UI)
- Роль: переиспользуемые UI-кирпичи без знания домена.

4) `apps/web/lib/**` (infra)
- `apps/web/lib/api/**` — API client и typed wrappers.
- `apps/web/lib/status-labels.ts` — единый источник текстов статусов.

### Конвенция: подписи статусов в UI

- В экранах/компонентах запрещено рендерить сырой enum напрямую (`locked`, `available`, `draft`, `published`, ...).
- Любой новый статус сначала добавляется в `apps/web/lib/status-labels.ts`, затем используется через мапперы.

## Routes map (`Implemented`, current)

- `/login` — общий логин.
- `/student/login`, `/teacher/login` — role-specific entrypoints.
- `/student` — student dashboard.
- `/student/units/[id]` — просмотр юнита студентом.
- `/teacher` — teacher dashboard.
- `/teacher/sections/[id]` — section + graph view.
- `/teacher/units/[id]` — unit editor/view.
- `/teacher/students` и `/teacher/students/[studentId]` — students management.
- `/teacher/review` и `/teacher/review/[submissionId]` — фото-проверка.
- `/teacher/events` — просмотр domain events (audit).
- `/teacher/analytics` — analytics (если включено в текущем UI).
- `/teacher/settings` — teacher settings.

## API client (`Implemented`)

- Все запросы к backend API (`NEXT_PUBLIC_API_BASE_URL`) идут с `credentials: "include"` (cookie auth).
- На `401` клиент пытается сделать `POST /auth/refresh` и повторить исходный запрос (кроме `/auth/login|/auth/refresh|/auth/logout`).
- Если refresh вернул `REFRESH_TOKEN_STALE`, клиент делает короткую паузу и повторяет исходный запрос с текущими cookie (race-tolerant сценарий).
- Базовый URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000`).

## Server-state foundation (`Implemented`, Phase 3 Wave 1)

- В web подключён `@tanstack/react-query` как базовый server-state слой.
- В `apps/web/app/layout.tsx` добавлен `QueryProvider`, который оборачивает все routes.
- Query client вынесен в `apps/web/lib/query/query-client.ts`:
  - дефолтный `staleTime=30s`, `gcTime=5m`;
  - `refetchOnWindowFocus=false`;
  - retry для queries отключён на 4xx `ApiError` и ограничен для остальных ошибок.
- Базовый key factory для Learning/Photo вынесен в `apps/web/lib/query/keys.ts`.
- Foundation используется как базовый слой для migration waves 2+.

## Server-state adoption (`Implemented/Planned`, Phase 3 Waves 2-6 + Phase 4 Wave 1)

- `Implemented` (read-path migration):
  - `apps/web/features/teacher-review/TeacherReviewInboxPanel.tsx` использует `useQuery` для inbox/students read-flow;
  - `apps/web/features/teacher-review/TeacherReviewSubmissionDetailPanel.tsx` использует `useQuery` для detail и `useQueries` для photo preview presign read-flow;
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` использует `useQuery` для `getUnit` и unit PDF preview (`theory/method`).
- `Implemented` (write-path migration):
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` использует `useMutation` для `submitAttempt` и `submitPhoto`;
  - `apps/web/features/teacher-review/TeacherReviewSubmissionDetailPanel.tsx` использует `useMutation` для `accept/reject`.
- `Implemented` (cache invalidation rules for migrated scope):
  - после student writes invalidируется `learningPhotoQueryKeys.studentUnit(unitId)`;
  - после teacher review action invalidируется ветка `["learning-photo","teacher","review"]`.
- `Implemented` (anti-race simplification):
  - ручные `cancelled` ветки в review initial-load read-flow убраны там, где их заменяет query lifecycle.
- `Implemented` (wave4 decomposition, Student Unit):
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` оставлен composition-shell (`1327 -> 508` строк);
  - orchestration вынесен в hooks:
    - `use-student-task-attempt.ts`,
    - `use-student-photo-submit.ts`,
    - `use-student-unit-pdf-preview.ts`,
    - `use-student-task-media-preview.ts`,
    - `use-student-task-navigation.ts`;
  - UI-блоки вынесены в subcomponents:
    - `StudentTaskCardShell.tsx`,
    - `StudentTaskAnswerForm.tsx`,
    - `StudentTaskMediaPreview.tsx`,
    - `StudentTaskTabs.tsx`,
    - `StudentUnitPdfPanel.tsx`.
- `Implemented` (wave5 decomposition, Teacher Unit):
  - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx` оставлен composition-shell (`2140 -> 815` строк);
  - orchestration вынесен в hooks:
    - `use-teacher-unit-fetch-save.ts`,
    - `use-teacher-unit-latex-compile.ts`,
    - `use-teacher-task-statement-image.ts`;
  - UI-блоки вынесены в subcomponents:
    - `TeacherUnitLatexPanel.tsx`,
    - `TeacherUnitTasksPanel.tsx`,
    - `TeacherTaskStatementImageSection.tsx`,
    - `TeacherTaskSolutionSection.tsx`,
    - `TeacherCompileErrorDialog.tsx`.
- `Implemented` (wave6 API client cleanup):
  - `apps/web/lib/api/student.ts` и `apps/web/lib/api/teacher.ts` очищены от дублей request/query типов в migration-срезе Learning/Photo;
  - для wave1 endpoint-ов в клиентских сигнатурах используются shared aliases/contracts из `@continuum/shared`;
  - повторяющаяся сборка query/path wrappers в `teacher.ts` вынесена в dedup helpers без изменения API shape.
- `Implemented` (Phase 4 wave1, non-learning migration):
  - добавлен non-learning key factory `contentQueryKeys` в `apps/web/lib/query/keys.ts`;
  - на query-driven загрузку переведены non-learning экраны:
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`,
    - `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`,
    - `apps/web/features/student-dashboard/StudentDashboardScreen.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentsPanel.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`;
  - в перечисленных экранах удалены ручные `requestIdRef`/`cancelled` anti-race паттерны.
- `Implemented` (Phase 4 wave2, error catalog consistency):
  - добавлен единый error-catalog helper `apps/web/lib/api/error-catalog.ts`;
  - `apps/web/features/student-content/shared/student-errors.ts` и `apps/web/features/teacher-content/shared/api-errors.ts` переведены на общий mapping-layer;
  - сохранены текущие user-facing semantics для student/teacher веток.
- `Implemented` (Phase 4 wave3, contracts/runtime parsing expansion):
  - в `packages/shared` добавлен non-learning contract slice `src/contracts/content-non-learning.ts` и экспорт из `src/index.ts`;
  - в `apps/web/lib/api/student.ts` и `apps/web/lib/api/teacher.ts` non-learning методы migration-среза переведены на `apiRequestParsed` + shared schemas;
  - в API client surface для wave3-среза локальные transport-типы заменены на aliases из `@continuum/shared`.

## Presigned assets (CORS) (`Implemented`)

- Для загрузки PDF по presigned object-storage URL (`PdfCanvasPreview`) используется `withCredentials = false` по умолчанию.
- Это исключает отправку cookie/credentials на внешний storage origin и предотвращает CORS-блокировку вида:
  `Access-Control-Allow-Credentials must be 'true' when request credentials mode is 'include'`.

## Dashboard shell UX (`Implemented`)

- Sidebar в `DashboardShell` использует hover intent и keyboard-focus intent с задержками открытия/закрытия `80/140ms`.
- Переключение `--sidebar-width/--sidebar-pad-*` выполняется декларативно через `data-sidebar-open` и CSS custom properties (без `style.setProperty` в JS).
- Текстовые лейблы в меню анимируются через `framer-motion` (`opacity/x/stagger`, без blur); для non-hover устройств sidebar фиксируется в раскрытом состоянии, чтобы не ломать mobile/touch UX.

## Animation stack (`Implemented`)

- Для React UI-анимаций используется `framer-motion` (см. `apps/web/package.json`).
- `framer-motion` применяется точечно для микровзаимодействий/поэлементных входов (пример: labels в `DashboardShell`), тогда как layout-size анимации остаются на CSS custom properties.
- Приоритет производительности: избегаем `filter: blur(...)` в часто триггерящихся sidebar-анимациях и уважаем `prefers-reduced-motion`.

## UI primitives stack (`Implemented`)

- Базовый UI-kit остаётся в `apps/web/components/ui/*` как единая точка API для продуктовых экранов.
- Для сложных интерактивов используется Radix primitives (через локальные обёртки):
  - `Dialog`, `AlertDialog`, `DropdownMenu`, `Select`, `Switch`, `Tabs`.
- `Tabs` и `Select` работают через текущие CSS variables/Glass tokens, без перехода на Tailwind.
- Подтверждения опасных действий (`delete/reset`) переведены с `window.confirm` на единый `AlertDialog`-паттерн.
- Меню действий в списке учеников переведено на `DropdownMenu` (убран ручной `pointerdown/keydown` outside/escape-контроль).
- Правила консистентности для Radix wrappers:
  - стили применяются только в `apps/web/components/ui/*` + feature-level CSS Modules, без прямого импорта Radix в feature-слой;
  - для `Portal`-контента явно задаются DS-токены радиусов/границ (не опираться на `:root --control-radius`);
  - `Select`/`DropdownMenu` в списках делаются непрозрачными (без `backdrop-filter`), чтобы не терялась читаемость пунктов.

## Dashboard navigation history (`Implemented`)

- В teacher edit flow (`/teacher`) переходы `курсы → разделы → граф` синхронизированы с `window.history.state`, поэтому браузерный `Back/Forward` возвращает предыдущий UI-шаг в рамках dashboard.
- В student dashboard (`/student`) переходы `курсы → разделы → граф` также пишут/читают `history.state`; кнопка браузера “Назад” теперь возвращает к предыдущему экрану dashboard, а не перескакивает на логин при внутридашбордной навигации.

## Planned / TODO

- UI state patterns (loading/empty/error), retry/backoff для list screens.
- Accessibility baseline (keyboard nav, focus, aria).
- Явная “карта экранов” teacher/student (user journeys).

## Source links

- `apps/web/app/`
- `apps/web/features/`
- `apps/web/components/`
- `apps/web/lib/api/client.ts`
- `apps/web/lib/query/query-client.ts`
- `apps/web/lib/query/query-provider.tsx`
- `apps/web/lib/query/keys.ts`
- `apps/web/lib/status-labels.ts`
- `apps/web/components/ui/`
