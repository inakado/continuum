# DECISIONS

Назначение: действующие архитектурные решения новой версии Continuum. История старой LMS доступна в Git и не является документацией текущего продукта.

## DEC-01 — Modular Monolith без фонового runtime

**Статус:** Accepted  
**Дата:** 2026-09-23

NestJS API, Next.js web, PostgreSQL и S3-compatible storage образуют production runtime. Отдельные worker и Redis отсутствуют, пока не появится подтверждённая фоновая нагрузка.

## DEC-02 — Домен библиотеки занятий

**Статус:** Accepted  
**Дата:** 2026-09-23

Каталог строится как `GradeBand → Section → Lesson`. Занятие объединяет versioned PDF, интерактивный пакет и задачи. Course, Unit, graph, progress, attempt и unlock не входят в новый домен.

## DEC-03 — Готовые материалы вместо серверной сборки

**Статус:** Accepted  
**Дата:** 2026-09-23

TeX/PDF и интерактивный HTML собираются локально. Сервер принимает готовые артефакты, проверяет их, версионирует и публикует. Добавление занятия не требует platform deploy.

## DEC-04 — Изоляция интерактивных лекций

**Статус:** Accepted  
**Дата:** 2026-09-23

Исполняемый HTML открывается только в sandboxed iframe без доступа к cookie Continuum. Он не проходит через static HTML sanitizer и не вставляется в authenticated DOM.

## DEC-05 — Excalidraw остаётся в Task Authoring

**Статус:** Accepted  
**Дата:** 2026-09-23

Учитель хранит editable Excalidraw scene и статический SVG/PNG preview. Student read-path получает preview и не загружает editor runtime. Legacy photo-review удаляется независимо.

## DEC-06 — Чистый production cutover

**Статус:** Accepted  
**Дата:** 2026-09-23

Старые production-данные не мигрируются. Очистка БД и storage выполняется только по явной команде в отдельный cutover с возможностью отката на предыдущий revision.
