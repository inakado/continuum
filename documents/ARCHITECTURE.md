# ARCHITECTURE.md
**Проект:** «Континуум» закрытая платформа обучения (Teachers + Students)  
**Аудитория:** нейросетевой агент / разработчики  


---

## 1) Архитектурный стиль и принципы

### 1.1 Стиль
- **Modular Monolith** на **NestJS** (единый деплой API), разбиение по модулям/Bounded Contexts.
- Отдельный процесс **Worker** (BullMQ consumers) для:
  - Rich LaTeX рендера (Tectonic),
  - (Planned) batch-пересчётов прогресса/доступности при publish/unpublish и обновлениях графа (в текущем коде пересчёт делается синхронно в API).

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
- `Unit.completed` автоматически при required-гейте + пороге optional counted задач (`minOptionalCountedTasksToComplete`, с guard’ом для “нулевого гейта”)
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
**Ответственность:** хранение/выдача файлов (S3/MinIO), presigned URLs, проверки доступа на уровне API endpoints.  
**Инварианты:**
- доступ к файлам только через backend-проверку прав
- asset keys хранятся в доменных сущностях (например `Unit.theoryPdfAssetKey`, `TaskRevision.solutionPdfAssetKey`, `PhotoTaskSubmission.assetKeysJson`)
- (Planned) универсальная привязка файлов к сущностям (если понадобится)

### BC6 — Rendering (Rich LaTeX)
**Ответственность:** очередь компиляции LaTeX → PDF, worker compile + apply результата в API, логи ошибок/сниппеты.  
**Инварианты:**
- компиляция Tectonic выполняется worker’ом (BullMQ queue `latex.compile`)
- API защищается от stale-результатов при apply (сравнение assetKey и active revision)

### BC7 — Search (Concepts & Content Search)
**Статус:** `Planned` (в коде сейчас нет моделей `concepts`/индекса).

### BC8 — Analytics
**Статус:** `Planned` (в коде сейчас нет проекций/агрегатов).

### BC9 — Audit & Domain Events Log
**Ответственность:** единый лог доменных событий (admin/learning/system) с фильтрацией и payload.  
**Принцип:** “события — факт домена”, покрывают и админские, и учебные действия.

---

## 3) Связи BC и зависимости (dependency rules)

### 3.1 Разрешённые зависимости (на уровне чтения/портов)
- **Learning → Content (read)**: published tasks (required/optional), граф prereq, `minOptionalCountedTasksToComplete`, активная ревизия.
- **ManualReview → Learning**: принятие/отклонение фото меняет состояние задачи/прогресса.
- **Rendering → Storage/Content**: результат (PDF) сохраняется в object storage и применяется в Content через internal endpoint.
- **Content/Learning/ManualReview/Rendering → Audit**: пишут события.
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
- `latex.compile` — compile LaTeX→PDF (unit theory/method, task solution)
- `system.ping` — debug queue (smoke/проверка worker)
- (Planned) `batch.*` — массовые пересчёты (publish/unpublish, graph updates)

### 5.2 Worker процессы
- `apps/worker` обрабатывает `latex.compile` и `system.ping` (в одном процессе).

---

## 6) Фиксация политики пересчётов (unlock/progress)

### Политика пересчётов сейчас (`Implemented`)

**RecomputeAvailability: детерминированный пересчёт снапшотов по section-графу**

- `LearningAvailabilityService.recomputeSectionAvailability(studentId, sectionId)`:
  - загружает published units/edges/tasks,
  - считает снапшоты (status + counters + percents),
  - persisted в `student_unit_state` (upsert).
- На критических путях (attempt, student views) пересчёт вызывается синхронно.
- На publish/unpublish и обновлениях графа пересчёт выполняется синхронно в API через `LearningRecomputeService` (по всем активным студентам).

### Planned evolution

- Инкрементальный пересчёт “вперёд” + события reach (`UnitBecameAvailableForStudent`).
- Перенос тяжёлых batch-пересчётов в worker queue.

---

## 7) Безопасность (архитектурные требования)

### 7.1 RBAC и права
- Все write endpoints защищены ролью `teacher`.
- Student endpoints ограничены по `student_id = me`.
- Photo review endpoints требуют `lead_teacher_id == actor_id`.

### 7.2 S3/Assets
- Только signed URLs с TTL.
- Проверка прав доступа в API перед выдачей URL.
- Asset keys хранятся в доменных сущностях (см. Prisma schema); универсальной таблицы привязок пока нет.

### 7.3 LaTeX sandbox
- Воркер запускается не от root, с лимитами CPU/mem.
- Ограничения на внешние зависимости/сеть (по возможности).
- Очистка временных директорий после job.

### 7.4 Dependency hygiene
- Next.js/React держим на latest stable из-за уязвимостей RSC (включая CVE-2025-55182).
- Автоматические обновления зависимостей и блокировка мержа при critical/high CVE.

## 8) Frontend Architecture (Next.js)

См. `FRONTEND.md` (SoR для UI).

## 8) Документы, связанные с архитектурой
- `CONTENT.md` — content/publishing/graph/LaTeX pipeline (SoR)
- `LEARNING.md` — attempts/progress/availability/3+3 (SoR)
- `FRONTEND.md` — frontend SoR
- `DOMAIN-EVENTS.md` — каталог событий (audit)
- `HANDLER-MAP.md` — карта обработчиков (HTTP → services → events/jobs)
- `generated/db-schema.md` — срез текущей БД модели (source: Prisma schema)
- `DECISIONS.md` — decision cards (архитектурные фиксации; сверяются по коду)
- `DOCS-INDEX.md` — навигация по документации
