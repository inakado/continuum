# SECURITY

Статус: целевая security-модель активной переработки; фактические гарантии подтверждаются кодом и тестами.

## Scope

- Better Auth sessions;
- RBAC;
- доступ ученика к возрастным группам;
- object storage, защищённая загрузка и presigned view URLs;
- безопасная публикация PDF, изображений, Excalidraw-сцен и интерактивных пакетов;
- изоляция исполняемого HTML.

## Инварианты

### Auth

- Публичная регистрация и email-login отключены.
- Session identifier хранится только в `HttpOnly` cookie.
- Production требует `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` и точный trusted origin.
- Logout и смена пароля отзывают активные сессии.
- Глобальный auth guard защищает routes по умолчанию; public routes помечаются явно.

### Authorization

- `admin` управляет преподавателями.
- `teacher` управляет учениками, доступами и материалами.
- `student` читает только опубликованные материалы выданных ему возрастных групп.
- Проверка доступа выполняется в API для catalog, lesson, asset и direct-link flows.

### Assets

- Bucket не является публичным.
- API проверяет роль, ownership и назначение до приёма файла или выдачи presigned view URL.
- Upload policy ограничивает тип, размер и ключ объекта; запрос требует точного `Content-Length` и проверяется после сохранения в S3.
- PDF, изображения, Excalidraw JSON/preview и interactive packages имеют разные policies.
- Asset key хранится в доменной модели; storage URL не сохраняется.

### Interactive packages

- Интерактивный пакет не вставляется через `dangerouslySetInnerHTML`.
- Player использует отдельный origin или изоляцию, эквивалентную opaque origin.
- Iframe получает минимальный `sandbox`; `allow-same-origin` не добавляется без отдельного security review.
- Пакет не получает cookie, auth headers или Better Auth session.
- Package manifest, entry point, content hash, file count и общий размер проверяются до публикации.
- Связь с платформой возможна только через версионированный allowlist `postMessage`-сообщений.

### Excalidraw

- Scene JSON считается пользовательским файлом и проверяется по size/content-type policy.
- Student read-path использует статический preview.
- Raw scene доступна только авторизованному teacher authoring flow.

## Cutover

- Старые production-данные не мигрируются.
- Очистка БД и bucket выполняется только в явно подтверждённое окно деплоя.
- После reset обязательно проверяются bootstrap admin, login, RBAC, direct-link denial и asset access.

## Source Links

- `apps/api/src/auth/*`
- `apps/api/src/infra/storage/*`
- `apps/api/src/main.ts`
- `documents/ARCHITECTURE.md`
- `documents/exec-plans/active/2026-09-23-content-library-rewrite.md`
