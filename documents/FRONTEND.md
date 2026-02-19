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
