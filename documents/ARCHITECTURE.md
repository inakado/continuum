# ARCHITECTURE.md
**Проект:** «Континуум» закрытая платформа обучения (Teachers + Students)  
**Аудитория:** нейросетевой агент / разработчики  


---

## 1) Архитектурный стиль и принципы

### 1.1 Стиль
- **Modular Monolith** на **NestJS** (единый деплой API), разбиение по модулям/Bounded Contexts.
- Отдельный процесс **Worker** (BullMQ consumers) для:
  - Rich LaTeX рендера (Tectonic),
  - batch-пересчётов прогресса/доступности при publish/unpublish и обновлениях графа.

### 1.2 Доменная декомпозиция (DDD)
- Ключевая доменная сложность: **Learning Progress & Unlock** (attempts, 3+3, два процента, required-гейт, граф unlock).
- Контент и прогресс разделены по BC: **Content** отдельно от **Learning**.
- Audit log и Domain Events — единый механизм фиксации фактов домена.

### 1.3 Консистентность
- **Прогресс и unlock**: консистентно и “сразу” (синхронно/инкрементально на критическом пути).
- **Analytics и Search**: eventual consistency (проекции/агрегаты по доменным событиям).
- **Rendering**: асинхронно через очередь; API поток не блокируется.

---

## 2) Bounded Contexts (BC) и ответственность

> BC = изолированный модуль внутри монолита (Nest module + слой Application/Domain/Infra).  
> BC взаимодействуют через явно определённые интерфейсы (порт/адаптер).

### BC1 — Identity & Access
**Ответственность:** пользователи, роли (teacher/student), login/password, сессии/JWT, ведущий учитель ученика.  
**Инварианты:**
- студент создаётся учителем
- ведущего учителя можно сменить; прогресс сохраняется, меняется проверяющий фото

### BC2 — Content (Authoring & Publishing)
**Ответственность:** курс/раздел/юнит/задача + публикация + граф юнитов внутри раздела + concepts + ревизии задач.  
**Инварианты:**
- иерархическая видимость draft/published: draft родителя скрывает всё
- любая правка задачи → новая ревизия, активная ревизия переключается
- граф не пересекает разделы

### BC3 — Learning (Progress, Attempts, Unlock)
**Ответственность:** прогресс ученика, попытки, статусы, блокировки, 6-й auto-credit, required_skipped, unit status, unlock, override.  
**Инварианты:**
- `Unit.in_progress` строго при первом Attempt в юните
- `Unit.completed` автоматически при required-гейте + min_counted_tasks
- счётчики ошибок/блокировок — по активной ревизии задачи
- solved% и completion% считаются строго по правилам
- override открывает юнит навсегда

### BC4 — Manual Review (Photo)
**Ответственность:** фото-попытки, очередь, accept/reject, комментарий к попытке.  
**Инварианты:**
- проверяет только ведущий учитель ученика
- rejected не увеличивает ошибки, пересдачи безлимитны
- засчитывание только после accepted

> Примечание: реализационно может быть подмодуль Learning, но границы и права удобно держать отдельно.

### BC5 — Files & Assets
**Ответственность:** загрузка/хранение/выдача файлов (S3), signed URLs, ACL/права доступа, универсальная привязка файлов к сущностям.  
**Инварианты:**
- доступ к файлам только через backend-проверку прав
- единый механизм для: attachments, фото, pdf теории/решений

### BC6 — Rendering (Rich LaTeX)
**Ответственность:** RenderJob lifecycle, очередь компиляции, статусы, логи, связь с Assets.  
**Инварианты:**
- компиляция Tectonic выполняется worker’ом
- статусы: idle/queued/rendering/ok/error
- при ошибке лог сохраняется и отображается в UI учителя

### BC7 — Search (Concepts & Content Search)
**Ответственность:** поиск по понятиям и выдача юнитов с путём Course→Section→Unit и статусом доступности.  
**Правила:**
- Student: только опубликованный контент (по цепочке)
- Teacher: поиск включая draft

### BC8 — Analytics
**Ответственность:** отчёты по юнитам/задачам (reach, avg percents, top ошибок/пропусков/pending/rejected) и расширяемость метрик.  
**Подход:** проекции на доменных событиях.

### BC9 — Audit & Domain Events Log
**Ответственность:** единый лог доменных событий (admin/learning/system) с фильтрацией и payload.  
**Принцип:** “события — факт домена”, покрывают и админские, и учебные действия.

---

## 3) Связи BC и зависимости (dependency rules)

### 3.1 Разрешённые зависимости (на уровне чтения/портов)
- **Learning → Content (read)**: total_tasks, required, граф prereq, min_counted_tasks, активная ревизия.
- **ManualReview → Learning**: принятие/отклонение фото меняет состояние задачи/прогресса.
- **Rendering → Files**: результат (PDF) сохраняется как Asset.
- **Content/Learning/ManualReview/Files/Rendering → Audit**: пишут события.
- **Search/Analytics ← Audit (+ read)**: строят проекции и агрегаты.

### 3.2 Запрещённые зависимости
- UI/Next.js не обращается напрямую к S3 — только через API выдачи signed URL.
- Worker не трогает UI; только очереди/DB/S3 через модульные интерфейсы.

---

## 4) Application/Domain/Infra слои (внутри каждого BC)

### 4.1 Domain layer
- агрегаты/сущности/инварианты
- доменные сервисы (например, расчёт “task counted/solved” и “unit eligible”)

### 4.2 Application layer
- команды (commands) и их handlers
- транзакции, оркестрация внутри BC
- публикация доменных событий в BC9

### 4.3 Infrastructure layer
- Prisma repositories
- S3 адаптер
- BullMQ producers/consumers
- PDF.js здесь не участвует (это фронт)

---

## 5) Очереди и фоновые процессы

### 5.1 Очереди (BullMQ)
- `render` — RenderJob для Tectonic
- `batch` — массовые пересчёты (publish/unpublish, graph updates)
- (опционально) `projections` — обновление analytics/search если нужно отделять

### 5.2 Worker процессы
- `worker-render`: consumer очереди `render`
- `worker-batch`: consumer очереди `batch` (можно объединить с render, но лучше логически разделять)

---

## 6) Фиксация политики пересчётов (unlock/progress)

### DEC-11 (зафиксировано)
**RecomputeAvailability: событийно + инкрементально, синхронно на критических путях**
- Attempt/PhotoAccepted/TeacherCredit/Override:
  - обновить состояния и метрики в транзакции,
  - пересчитать доступность “вперёд” по section-графу для ученика,
  - эмитить `UnitBecameAvailableForStudent` при переходе locked→available (это “reach”).
- Publish/Unpublish, Graph update:
  - запуск batch job пересчёта по затронутым ученикам.

---

## 7) Безопасность (архитектурные требования)

### 7.1 RBAC и права
- Все write endpoints защищены ролью `teacher`.
- Student endpoints ограничены по `student_id = me`.
- Photo review endpoints требуют `lead_teacher_id == actor_id`.

### 7.2 S3/Assets
- Только signed URLs с TTL.
- Проверка прав доступа в API перед выдачей URL.
- Привязка файла к сущности хранится в БД (entity_assets), выдача URL — через эту привязку.

### 7.3 LaTeX sandbox
- Воркер запускается не от root, с лимитами CPU/mem.
- Ограничения на внешние зависимости/сеть (по возможности).
- Очистка временных директорий после job.

### 7.4 Dependency hygiene
- Next.js/React держим на latest stable из-за уязвимостей RSC (включая CVE-2025-55182).
- Автоматические обновления зависимостей и блокировка мержа при critical/high CVE.

## 8) Frontend Architecture (Next.js)


### Слои и ответственность

1) **app/** (routes/pages)
- Файлы: `apps/web/app/**/page.tsx`, `layout.tsx`
- Роль: **композиция** компонентов, чтение `params/searchParams`, навигация.
- Запрещено:
  - прямые запросы к API (fetch/axios) из страниц
  - бизнес-логика и “толстая” верстка на сотни строк
  - хранение токена/сессионной логики

2) **features/** (feature modules)
- Путь: `apps/web/features/<feature>/**`
- Роль: use-cases UI: загрузка/мутации/состояния, адаптация данных под компоненты.
- Здесь живут:
  - hooks/containers
  - feature-level компоненты (не универсальные)
  - схемы валидации форм (если нужны)

3) **components/** (UI kit + shared UI)
- Путь: `apps/web/components/**`
- Роль: переиспользуемые “кирпичи” UI без знания домена.
- Примеры: Button, Input, Card.

4) **lib/** (infra)
- Путь: `apps/web/lib/**`
- Роль: инфраструктура фронта:
  - `lib/api/*` — API client + функции вызовов
  - `lib/auth/*` — хранение токена/сессии (dev/prod политика)
  - `lib/utils/*` — утилиты

### Правила зависимости (границы)
- `app/*` может импортировать только из `features/*` и `components/*` и `lib/*`.
- `features/*` может импортировать из `components/*` и `lib/*`.
- `components/*` не импортирует `features/*` и не знает про API.
- Запросы к backend — только через `lib/api/*`, не напрямую из UI.

### Принцип “тонких страниц”
Если `page.tsx` начинает содержать:
- сложные запросы/мутации,
- много условной логики,
- крупную верстку,

то это сигнал вынести логику в `features/*`, а UI в `components/*`.

### Примечание про стили
UI следует правилам `DESIGN-SYSTEM.md` (геометрия, шрифты, токены цветов).

### Конвенция: подписи статусов в UI
- Единый источник текстов статусов: `apps/web/lib/status-labels.ts`.
- Используем только централизованные мапперы:
  `getContentStatusLabel`, `getStudentUnitStatusLabel`, `getStudentTaskStatusLabel`.
- В экранах/компонентах запрещено рендерить сырой enum напрямую
  (`locked`, `available`, `in_progress`, `completed`, `draft`, `published` и т.д.).
- При добавлении нового статуса сначала обновляется `status-labels.ts`, затем подключается в UI.
- Минимальный smoke после правки статусов:
  `pnpm --filter web exec tsc -p tsconfig.json --noEmit`.
---

## 8) Документы, связанные с архитектурой
- `PROJECT-OVERVIEW.md` — описание продукта и правил
- `TECH-STACK.md` — технологии/библиотеки/безопасность
- `DOMAIN-EVENTS.md` — доменные события (A3)
- `HANDLER-MAP.md` — handlers (A4)
- `ER-MODEL.md` — ER модель (A5)
- `DECISIONS.md` — Decision Cards
- `DOCS-INDEX.md` — навигация по документации
