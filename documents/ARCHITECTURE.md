# ARCHITECTURE

Статус: целевая архитектура активной переработки. До завершения плана часть legacy-кода не соответствует этому документу; расхождения перечислены в `documents/exec-plans/active/2026-09-23-content-library-rewrite.md`.

## 1. Архитектурная форма

- Modular Monolith: NestJS API, Next.js web, PostgreSQL и S3-compatible object storage.
- Один API-процесс без отдельного worker и Redis после удаления legacy LaTeX pipeline.
- Better Auth отвечает за login/password и DB-backed sessions.
- Shared Zod-контракты являются единственным transport-контрактом между API и web.
- Локальные авторские инструменты не являются частью production runtime.

## 2. Модули

### Identity & Access

Хранит пользователей, роли, профили и доступ учеников к возрастным группам.

Инварианты:

- `admin` управляет преподавателями;
- `teacher` управляет учениками и их доступами;
- ученик создаётся только через единый identity provisioning path с тем же Argon2 password hashing, что использует Better Auth;
- преподаватель видит и изменяет только учеников, у которых он указан как `leadTeacherId`;
- деактивация ученика немедленно отзывает все его активные сессии;
- ученик читает только собственные доступы;
- отсутствие доступа скрывает всю возрастную группу независимо от прямой ссылки.

Первый transport slice:

- `GET /teacher/students`;
- `POST /teacher/students`;
- `PATCH /teacher/students/:id/active`.

### Library

Хранит возрастные группы, разделы, занятия, файловые материалы и состояние публикации.

Инварианты:

- поддерживаются только группы `grade_7`, `grade_8`, `grade_9`, `grade_10_11`;
- раздел принадлежит одной возрастной группе;
- занятие принадлежит одному разделу;
- ученик видит только опубликованные занятия;
- порядок разделов и занятий явный и детерминированный.
- каталог ученика ограничен не только `GradeBand`, но и преподавателем, выдавшим доступ; материалы другого преподавателя той же группы не протекают между контурами.

Первый transport slice:

- `GET /teacher/library`;
- `POST /teacher/library/sections`;
- `PATCH /teacher/library/sections/:id/publish`;
- `POST /teacher/library/lessons`;
- `PATCH /teacher/library/lessons/:id/publish`;
- `PUT /teacher/library/access-grants`;
- `GET /student/library`;
- `GET /student/library/lessons/:id`.

Отсутствие доступа, unpublished section или unpublished lesson возвращают одинаковый `LESSON_NOT_FOUND` на student detail path и не позволяют определить наличие скрытой сущности.

### Assets

Управляет загрузкой и защищённой выдачей конспектов PDF, задач PDF и интерактивных пакетов.

Инварианты:

- браузер загружает файл через авторизованный API; view URL выдаётся только после backend-проверки прав;
- доменные записи хранят asset key и метаданные, а не публичный URL;
- тип, размер и назначение файла валидируются policy-as-code;
- удаление доменной записи не должно молча оставлять активную ссылку на материал.

### Interactive Delivery

Целевой контур: принимает локально собранный HTML-пакет и публикует его только после проверки и подключения изолированного проигрывателя. Сейчас ZIP можно сохранить как черновик, но учителю доступно лишь скачивание, а ученику он не выдаётся.

Инварианты:

- исходники и зависимости лекции не собираются на сервере;
- пакет запускается в sandboxed iframe без доступа к cookie Continuum;
- произвольный JavaScript не попадает в DOM аутентифицированного приложения;
- пакет проходит проверку manifest, размера, entry point и content hash;
- новая версия не изменяет предыдущую и может быть откачена.

## 3. Основные данные

- `User`, `Session`, `Account`, `Verification`
- `TeacherProfile`, `StudentProfile`
- `AccessGrant`
- `Section`
- `Lesson`
- `LessonArtifact`
- `Asset`

`LessonArtifact` имеет тип `pdf`, `tasks_pdf` или `interactive`, номер версии, asset key, hash и состояние публикации. У занятия одновременно не более одной активной опубликованной версии каждого типа.

## 4. Основные потоки

### Публикация PDF

1. Учитель отправляет PDF в API; API проверяет роль, владельца, тип и размер.
2. API потоково сохраняет PDF в object storage, проверяет сигнатуру и создаёт версию материала.
4. Учитель публикует занятие, активируя последнюю версию каждого PDF.
5. Ученик получает короткоживущую view-ссылку после проверки доступа.

### Публикация интерактивной лекции

1. Лекция собирается локально.
2. Учитель загружает ZIP как черновик; сценарии CLI и manifest ещё не реализованы.
3. После реализации проверки пакета и iframe проигрывателя учитель сможет публиковать версию.

Загрузка лекции не запускает CI и не требует деплоя Continuum.

## 5. Frontend

- `/login` — единая существующая страница входа.
- `/student` — библиотека доступных возрастных групп и занятия.
- `/teacher` — материалы, ученики и доступы.
- `/teacher/students` — создание/деактивация учеников и доступы к возрастным группам.
- `/admin` — системное администрирование; teacher provisioning подключается новым Identity & Access flow.

Teacher и student используют отдельные layouts/feature-контуры и общие токены, UI-примитивы, API client и query infrastructure. Старые dashboard shells не переиспользуются.

## 6. Удаляемая legacy-архитектура

- `Course` и `Unit` как учебная траектория;
- unit graph, layout и prerequisites;
- attempts, progress, unlock и overrides;
- photo-review и notifications;
- серверный Rich LaTeX rendering;
- BullMQ, Redis, worker и `packages/latex-runtime`;
- React Flow и старые course/unit экраны;
- Domain Events Log, если после удаления legacy-потоков у него не останется продуктового назначения.

Excalidraw не входит в удаляемую legacy-архитектуру, но не участвует в текущем PDF-пути задач.

## 7. Dependency rules

- Web загружает материалы только через API; короткоживущую ссылку на чтение API выдаёт после проверки доступа.
- Library не знает о S3 SDK: storage implementation скрыта за Assets module.
- Interactive Delivery не использует sanitizer статического HTML и не разделяет с ним read-path.
- Role-specific frontend features не импортируют друг друга.
- Внешние входы валидируются Zod-контрактом до application logic.

## 8. Production после cutover

- текущие production-данные не мигрируются;
- БД и object storage могут быть очищены в согласованный cutover;
- после reset создаётся новый admin и тестовые учётные записи;
- production меняется только отдельным явным деплоем с проверкой `/health`, `/ready`, login и чтения опубликованного занятия.
