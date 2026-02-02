# DOCS-INDEX.md
**Проект**: «Континуум»  
**Назначение**: навигация по документации для нейро-агента. Прочитав этот файл, агент должен понимать:  
1) какие документы существуют,  
2) что в каждом лежит,  
3) куда идти за ответом в зависимости от задачи.  
**Правило**: сначала прочитай этот индекс, затем открывай только нужные документы (минимизируй контекст).

---

## 0) Быстрый роутер: “что мне нужно сделать → что читать”

### UI / фронтенд (обычный интерфейс ученика/учителя)
Читай:
- DESIGN-SYSTEM.md — шрифты/цвета/компоненты/UX паттерны, ReactFlow визуал, PDF/LiteTeX UX правила
- TECH-STACK.md — библиотеки, версии, интеграции, безопасность (React/Next latest)

Не читай по умолчанию:
- LANDING-MOTION-VANTA.md (только если работаешь над landing или переходом landing → dashboard)

---

### Landing / анимации / Vanta
Читай:
- LANDING-MOTION-VANTA.md — Vanta Topology (код), theme re-init, motion “погружение”, perf правила
- DESIGN-SYSTEM.md — для общего совпадения стиля (шрифты/цвета)

---

### Бэкенд / API / доменная логика
Читай:
- ARCHITECTURE.md — modular monolith (DDD), BC/modules, принципы, границы ответственности
- HANDLER-MAP.md — список команд/хендлеров/ивент-хендлеров/джобов, поток “UI → domain → events → jobs/projections”
- DOMAIN-EVENTS.md — каталог доменных событий (audit/projections), категории admin/learning/system
- ER-MODEL.md — таблицы, PK/FK, индексы, модель ревизий, прогресс, попытки, файлы
- DECISIONS.md — фиксации (DEC-xx), как именно трактуем спорные места требований

---

### База данных / миграции / Prisma schema
Читай:
- ER-MODEL.md — источник истины по сущностям и связям (PK/FK/уникальности/индексы)
- DECISIONS.md — логика ревизий, unpublish пересчёт, 3+3, required и т.п. (чтобы БД отражала правила)

---

### Очереди, воркеры, LaTeX рендер, S3
Читай:
- TECH-STACK.md — конкретные библиотеки и компоненты (BullMQ, Redis, Tectonic, S3/MinIO, PDF.js)
- HANDLER-MAP.md — render/batch job handlers и когда они запускаются
- DECISIONS.md — почему так, и какие ограничения (async, не блокировать API)

---

### Публикация/видимость (draft/published) и пересчёты
Читай:
- DECISIONS.md — DEC-04, DEC-11 (иерархическое скрытие, unpublish пересчёт)
- HANDLER-MAP.md — batch recompute jobs
- ER-MODEL.md — где храним статус и что пересчитываем

---

### Audit log / события / аналитика
Читай:
- DOMAIN-EVENTS.md — список событий и их смысл
- HANDLER-MAP.md — кто эмитит события, кто строит проекции/analytics
- ER-MODEL.md — domain_event_log и индексы
- DECISIONS.md — политика логирования и расширяемости метрик

---

## 1) Список документов (канонический)

Ниже перечислены документы проекта и “что там искать”.

### 1.1 PROJECT-OVERVIEW.md
- Краткое описание продукта и границ (One-pager / A0)
- Роли, основные сценарии, MVP/не-MVP, ограничения, базовая терминология

### 1.2 ARCHITECTURE.md
- DDD карта мира: поддомены/BC, границы модулей
- Modular monolith структура NestJS
- Интеграции и основные принципы (без схем БД)

### 1.3 TECH-STACK.md
- Технологии и библиотеки (backend/frontend/storage/queue/PDF)
- Версионность: React/Next latest (в т.ч. по CVE), правила обновлений
- Security базовые практики на уровне зависимостей и сборки

### 1.4 DOMAIN-EVENTS.md
- Каталог доменных событий (admin/learning/system)
- Какие события считаются фактами домена
- Для чего используются (audit/projections/analytics/notifications)

### 1.5 HANDLER-MAP.md
- API Command Handlers (UI → команды)
- Event Handlers (оркестрация, нотификации, проекции)
- Job Handlers (render/batch воркеры)
- Что читают/что пишут обработчики (data contours)

### 1.6 ER-MODEL.md
- ER модель для MVP (PostgreSQL)
- Таблицы/поля, PK/FK, уникальности/индексы
- Ревизии задач, прогресс, попытки, блокировки, overrides, файлы, render jobs, audit log

### 1.7 DECISIONS.md
- Decision Cards (DEC-xx)
- Фиксации трактовок требований: 2 метрики, 3+3 попытки, required гейты, фото review, ревизии, publish/unpublish пересчёт, PDF view и т.д.

### 1.8 DESIGN-SYSTEM.md
- UI стиль: шрифты/цвета/геометрия/кнопки/формы
- ReactFlow визуальные правила
- Контент: LiteTeX/KaTeX и PDF.js правила отображения
- Anti-patterns и чеклист ревью UI

### 1.9 LANDING-MOTION-VANTA.md
- Только landing: Vanta Topology (код), polling-init, theme re-init
- Motion “погружение” landing → dashboard и perf правила
- Не читать при обычной разработке UI (чтобы не забивать контекст)

### 1.10 DEVELOPMENT.md

Краткий контрольный контур для dev‑запуска.

---

## 2) Как агенту отвечать/действовать (процесс)

1) Прочитай DOCS-INDEX.md  
2) Определи тип задачи:
   - UI? Landing? Backend? DB? Rendering? Security?  
3) Открой 1–3 наиболее релевантных документа по роутеру из раздела 0  
4) Если сталкиваешься с неоднозначностью трактовки требований — открой DECISIONS.md  
5) Если задача касается событий/логирования/аналитики — DOMAIN-EVENTS.md + HANDLER-MAP.md  
6) Если задача касается схемы данных — ER-MODEL.md является источником истины

---

## 3) Именование терминов (коротко, чтобы не путаться)

- Course / Section / Unit / Task — контентная иерархия
- Task Revision — ревизии задач (любая правка = новая ревизия)
- Attempt — попытка решения (авто-check или photo)
- Completion% — counted_tasks/total_tasks
- Solved% — solved_tasks/total_tasks
- Required — жёсткий гейт на unlock, возможен required_skipped после auto-credit
- Draft/Published — видимость (иерархически), unpublish требует пересчёта

---
Конец DOCS-INDEX.md