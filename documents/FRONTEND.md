# FRONTEND

Назначение: целевая frontend-архитектура, UI-конвенции и правила клиентского слоя.

## Structure

1. `apps/web/app/**` — routes, layouts и navigation seams.
2. `apps/web/features/student-*` — student catalog и lesson read-path.
3. `apps/web/features/teacher-*` — authoring, students и access grants.
4. `apps/web/components/ui/*` — role-neutral primitives без доменной логики.
5. `apps/web/lib/api/*` и `apps/web/lib/query/*` — transport и server state.

Teacher и student получают отдельные role-specific layouts и feature-контуры. Старые dashboard shells удалены; новые создаются только вместе с реальным каталогом и authoring flow. Cross-import между role-specific features запрещён.

## Routes Map

- `/login` — единый вход.
- `/student` — доступные возрастные группы и каталог.
- `/student/lessons/[lessonId]` — PDF, интерактив и задачи.
- `/teacher` — обзор материалов.
- `/teacher/materials` — разделы и занятия.
- `/teacher/materials/[lessonId]` — редактирование и публикация занятия.
- `/teacher/students` — ученики и доступы.
- `/admin` — системное администрирование; управление преподавателями будет добавлено в новом identity flow.

Старые `/student/courses*`, `/student/sections*`, `/student/units*`, `/teacher/sections*`, `/teacher/units*`, `/teacher/review*`, `/teacher/events` и `/teacher/analytics` удалены. `/student`, `/student/lessons/[lessonId]`, `/teacher/materials` и `/teacher/students` уже работают через новый API; asset authoring пока не реализован.

## API Client Behavior

- Все запросы к API используют `credentials: "include"`.
- Login/session/logout выполняются Better Auth client.
- `401` означает отсутствие сессии; `403` — отсутствие роли или доступа к возрастной группе.
- Ответы критичных transport interfaces проходят Zod parsing.
- Object storage URL используется без cookie/credentials.

## Server-State Rules

- `@tanstack/react-query` — единственный общий server-state слой.
- Query keys и invalidation централизованы.
- Чтение и запись разделены: query для read-path, mutation для write-path.
- Draft editor state может быть локальным, но опубликованное состояние всегда перечитывается с сервера.
- UI не вычисляет доступ: API возвращает только разрешённые ученику сущности.

## Materials

- PDF рендерится через PDF.js и скачивается по свежей presigned URL.
- Интерактивная лекция запускается отдельным sandboxed iframe, а не через `dangerouslySetInnerHTML`.
- MathJax загружается локально.
- Excalidraw lazy-load используется только в teacher authoring; student видит SVG/PNG preview.

## Visual baseline

- Светлая редакционная поверхность, почти чёрный текст, тёмно-зелёный акцент.
- Плотные списки и тонкие разделители вместо избыточных карточек.
- Desktop может использовать две колонки; mobile — одну.
- Без glass, градиентного SaaS-декора и игровых progress-элементов.
- Общий shell: header `64px`, tabs `71px`, desktop gutter `48px`, Inter и акцент `#0B6B4F`.

## Related Source Links

- `apps/web/app/*`
- `apps/web/features/*`
- `apps/web/components/ui/*`
- `apps/web/lib/api/*`
- `apps/web/lib/query/*`
