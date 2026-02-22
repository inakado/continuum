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

- Все запросы идут с `credentials: "include"` (cookie auth).
- На `401` клиент пытается сделать `POST /auth/refresh` и повторить исходный запрос (кроме `/auth/login|/auth/refresh|/auth/logout`).
- Базовый URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000`).

## Dashboard shell UX (`Implemented`)

- Sidebar в `DashboardShell` использует hover/focus intent с задержками открытия/закрытия.
- Анимация раскрытия выполняется через width/padding custom properties (без `scaleX`), чтобы снизить visual jitter на тексте и иконках.

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
- `apps/web/lib/status-labels.ts`
