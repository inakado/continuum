# FRONTEND

Назначение: текущая frontend-архитектура, UI-конвенции и поведение клиентского слоя.

## Scope

- App Router структура (Next.js)
- Feature boundaries (`features/components/lib`)
- API client слой (cookie auth + refresh)
- Server-state правила
- UI primitives, motion и asset preview rules
- rendered-content flow для student unit `theory/method`

## Structure

### Слои и ответственность

1. `apps/web/app/**`
- композиция routes, layout, page shells и navigation boundaries.

2. `apps/web/features/**`
- use-case уровень: загрузка данных, мутации, orchestration, адаптация данных под UI.

3. `apps/web/components/**`
- shared UI primitives и презентационные блоки без доменной логики.

4. `apps/web/lib/**`
- infra/helpers:
  - `apps/web/lib/api/**` — API client;
  - `apps/web/lib/query/**` — query client и query keys;
  - `apps/web/lib/status-labels.ts` — единый источник статусов и label mapping.

### Конвенция статусов в UI

- В экранах и компонентах запрещено рендерить сырой enum напрямую (`locked`, `available`, `draft`, `published` и т.п.).
- Любой новый статус сначала добавляется в `apps/web/lib/status-labels.ts`, затем используется через явный mapping-layer.

## Routes Map

- `/login` — общий логин.
- `/student/login`, `/teacher/login` — role-specific entrypoints.
- `/student` — student dashboard.
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

## Presigned Assets and CORS

- Presigned PDF/asset preview из object storage рендерится без credentials (`withCredentials = false`).
- Это исключает отправку auth-cookie на внешний storage origin и предотвращает CORS-блокировку при `credentials: include`.
- В student unit PDF tabs zoom хранится отдельно по target; теория и методика открываются с масштабом `50%`.
- Для student unit `theory/method` primary read-path теперь идёт через backend endpoint `rendered-content`, который отдаёт уже подписанный HTML fragment и optional `pdfUrl`.
- В `StudentUnitHtmlPanel` кнопка `Скачать PDF` не использует сохранённый при первичной загрузке `pdfUrl` как единственный источник: перед открытием файла panel запрашивает свежий rendered-content (`refresh*Content`) и берёт актуальный presigned URL.
- HTML fragment рендерится как часть страницы; legacy PDF preview остаётся fallback path для unit без собранного HTML.
- Rich math внутри student/teacher HTML preview typeset'ится локальным MathJax helper из workspace, а не CDN/runtime с внешнего origin.
- MathJax helper работает как сериализованный runtime:
  - typeset вызовы выполняются через очередь (без конкурентных гонок);
  - при runtime-сбое есть controlled retry с переинициализацией MathJax script.
- В teacher unit editor preview для `theory/method` живёт внутри того же preview container и поддерживает два режима: `PDF` и `HTML`. HTML preview читает backend `teacher/units/:id/rendered-content`, а PDF preview остаётся canvas-based.

## UI Primitives and Motion

- Базовый UI-kit живёт в `apps/web/components/ui/*`.
- Для сложных interactive primitives используются локальные обёртки над Radix primitives.
- `framer-motion` применяется точечно для React UI-анимаций; layout-size анимации по возможности остаются на CSS custom properties.
- Для frequently triggered interactions избегаем тяжёлых `filter: blur(...)` и уважаем `prefers-reduced-motion`.

## Typography Runtime

- Шрифты подключаются локально через `@fontsource/*` в `apps/web/app/layout.tsx`; CDN/Google Fonts runtime не используется.
- Токены в `apps/web/app/globals.css`:
  - `--font-logo` = `Unbounded` (только для логотипного текста `Континуум`),
  - `--font-onest` = `Onest` (заголовки и интерфейсные акценты),
  - `--font-inter` = `Inter` (основной текст).
- Для совместимости существующих CSS-модулей `--font-unbounded` алиасится на `--font-onest`; новая вёрстка не должна использовать `--font-unbounded` как “брендовый” шрифт.

## Navigation Patterns

- Teacher dashboard edit flow и student dashboard синхронизируют внутридашбордную навигацию с `window.history.state`.
- Browser `Back/Forward` должен возвращать предыдущий UI-шаг внутри dashboard, а не ломать user journey.

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
