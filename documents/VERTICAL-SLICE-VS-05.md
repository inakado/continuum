# VERTICAL-SLICE-VS-05.md
Проект: **Континуум**  
Слайс: **VS-05 Photo Tasks v1: Submission → Teacher Review → Accept/Reject → влияет на solved% (и completion%)**  
Назначение документа: дать агенту “картину целиком” по VS-05 (что и в каком порядке делаем), без глубоких деталей реализации.

---

## 0) Контекст и принципы

### 0.1 Где мы сейчас (после VS-04)
- Есть **Content**: Course/Section/Unit/Task (draft/published), граф внутри section.
- Есть **Learning Core** (VS-03): попытки, статусы задач, 3+3, блокировки, auto-credit, уведомления учителю.
- Есть **VS-04**: unit progress, required gates, unit statuses, unlock AND внутри section-графа.
- Текущий UI student/teacher уже “боевой”, с дашбордами и панелями.

### 0.2 Требование VS-05
Добавить полноценный контур **photo tasks**:
- ученик **прикладывает фото-решение** (upload),
- преподаватель **смотрит**, **принимает/отклоняет**, оставляет комментарий,
- принятое фото **засчитывается как solved** (как “accepted photo”) и также входит в counted,
- все это отражается в прогрессе, графе и профиле ученика.

### 0.3 Storage: dev vs prod
- **Dev**: используем локально **MinIO** (уже поднят в docker-compose).
- **Prod**: будет **S3 Beget**, переключение **только через ENV** (без изменения бизнес-логики).
- В коде везде опираться на абстракцию `StorageAdapter`/`S3Adapter`, а не на MinIO напрямую.

---

## 1) Термины и статусы

### 1.1 Статусы для photo-task на уровне student_task_state (или аналога)
Минимально для VS-05:
- `not_started`
- `submitted_for_review` (есть отправка, ждём решения)
- `rejected` (учитель отклонил; попытка не засчитана)
- `accepted` (учитель принял; задача считается решённой)
- (дополнительно, если уже есть в VS-03): `teacher_credited`, `credited_without_progress`, `correct` — но для photo в VS-05 ключевые `submitted/rejected/accepted`.

### 1.2 Влияние на метрики
- **counted_tasks** растёт при:
  - `accepted` (photo)
  - `credited_without_progress`
  - `teacher_credited`
  - `correct`
- **solved_tasks** растёт при:
  - `correct`
  - `teacher_credited`
  - `accepted` (photo) ✅ (это главная интеграция VS-05)

---

## 2) Scope VS-05

### A) Backend: модели + сервисы + API
1) Хранение подач фото (submissions) и их статусов
2) Upload в storage (MinIO/S3), получение `assetKey`/`objectKey`
3) Student endpoints:
   - создать submission (upload + привязка к task)
   - посмотреть статус/историю submission для task
4) Teacher endpoints:
   - список submissions “на проверку” (по teacher → его ученики)
   - принять/отклонить submission (комментарий)
5) Интеграция с:
   - `student_task_state`
   - `student_unit_state` / прогресс / unlock
   - `notifications` учителю

### B) Web UI/UX
1) Student: UI для photo-task:
   - загрузка фото (drag/drop + mobile file picker)
   - отображение статуса: “отправлено”, “отклонено (комментарий)”, “принято”
   - возможность повторной отправки после rejection
2) Teacher:
   - в профиле ученика/юнита показывать photo submissions
   - отдельная панель “На проверку” (можно встроить в Students → active notifications)
   - accept/reject + комментарий
3) Визуальный стиль по DESIGN-SYSTEM: rounded-none, border-primary, инверсия активного, RU UI.

---

## 3) Out of scope VS-05
- Распознавание текста/ИИ, автопроверка фото
- Редактирование фото, аннотации
- Несколько файлов на одну submission (в v1 — 1 файл)
- Полноценная медиа-галерея и версии вложений
- “Скрывать фото после принятия”, DRM и т.п.
- Глобальные очереди/worker для превью (если будет нужно — позже)

---

## 4) Модель данных (в общих чертах)

### 4.1 PhotoSubmission (новая сущность)
Минимальные поля:
- `id`
- `taskId`
- `studentId`
- `status`: submitted_for_review | rejected | accepted
- `assetKey` (ключ в storage)
- `mimeType`, `sizeBytes`
- `createdAt`, `updatedAt`
- `reviewedAt` (nullable)
- `reviewedByTeacherId` (nullable)
- `teacherComment` (nullable)

Индексы:
- (studentId, taskId, createdAt desc)
- (status, createdAt) для очереди проверки
- (reviewedByTeacherId, reviewedAt)

### 4.2 Взаимодействие с состоянием задачи
- `student_task_state` хранит “сводный” статус по task+student+activeRevision:
  - для photo: `submitted_for_review` / `rejected` / `accepted`
- PhotoSubmission хранит “факт отправки/проверки” (audit trail).

---

## 5) API (в общих чертах)

> Примечание: точные пути/DTO агент выберет по существующим паттернам в проекте. Ниже — канонический набор.

### 5.1 Student API
- `POST /student/tasks/:taskId/photo-submissions`
  - body: `file` (multipart/form-data) + optional `note` (если нужно)
  - результат: submission (id, status, createdAt)
  - правила:
    - task должен быть типа `photo`
    - unit должен быть доступен (не locked)
    - если есть `submitted_for_review` — 409 (или разрешить replace, но лучше 409 в v1)
    - если `accepted` — запретить новую отправку (409), т.к. уже решено
    - если `rejected` — разрешить новую отправку (создаём новый submission)
- `GET /student/tasks/:taskId/photo-submissions`
  - вернуть историю (последние N) или только последний (по решению)
  - student видит только свои

### 5.2 Teacher API
- `GET /teacher/photo-submissions?status=submitted_for_review&studentId=...&limit=...`
  - возвращает список “на проверку” только по ученикам, где teacher = lead
- `POST /teacher/photo-submissions/:submissionId/accept`
  - body: `{ comment?: string }`
  - эффекты:
    - submission.status = accepted
    - student_task_state.status = accepted
    - пересчёт unit progress/availability (VS-04 логика)
    - закрытие/обновление notification (если есть)
- `POST /teacher/photo-submissions/:submissionId/reject`
  - body: `{ comment: string }` (в reject комментарий обязателен)
  - эффекты:
    - submission.status = rejected
    - student_task_state.status = rejected (или not_started — но лучше rejected, чтобы student видел причину)
    - notification “PhotoRejected” (опционально) или обновление существующей

---

## 6) События и уведомления

### 6.1 Domain events (минимально)
- `PhotoTaskSubmittedForReview`
- `PhotoTaskAccepted`
- `PhotoTaskRejected`

Payload (минимум):
- studentUserId
- teacherUserId (для accept/reject)
- taskId
- unitId (если удобно)
- submissionId
- assetKey (без публичного URL)

### 6.2 Notifications
- при `submitted_for_review` → создаём notification ведущему учителю
- при `accepted/rejected` → закрываем/обновляем notification
- в Teacher “Ученики” карточка ученика должна показывать “есть активные уведомления”

---

## 7) UI/UX (картинка целиком)

### 7.1 Student (photo task)
Внутри `/student/units/:id` → вкладка “Задачи”:
- для task.type=photo:
  - блок загрузки (input file)
  - после upload:
    - статус “Отправлено на проверку”
    - предпросмотр изображения (из временного URL или через storage presigned GET)
  - после reject:
    - статус “Отклонено”
    - комментарий учителя
    - кнопка “Отправить заново”
  - после accept:
    - статус “Принято” (задача решена)
    - попытки/3+3 к photo не применяются (это другой процесс)

### 7.2 Teacher review
Вариант A (минимум): внутри профиля ученика → вкладка/секция “Уведомления”:
- список “Фото на проверку”
- клик → модал/панель с:
  - изображением
  - метаданными (ученик, задача, юнит)
  - Accept / Reject (comment)
  - после действия: обновление статуса задачи/юнита

Вариант B (чуть шире): отдельный пункт sidebar “Проверка фото” (в teacher dashboard)
- список всех submissions “на проверку” по ученикам.

---

## 8) Порядок разработки (high level)

### Step 1 — DB + Storage adapter + Student submit
- Prisma: PhotoSubmission + миграция
- StorageAdapter (MinIO/S3 через ENV)
- Student endpoint submit + read
- Notifications на submit

### Step 2 — Teacher review endpoints + интеграция с state/progress/unlock
- Teacher list/accept/reject
- Update student_task_state
- Recompute unit progress/availability (VS-04)
- Close notifications
- Event log записи

### Step 3 — Web UI: student photo task + teacher review UI
- Student загрузка и отображение статусов
- Teacher review экран/панель
- Связка с существующим “Ученики → профиль → курс/юниты/задачи”

---

## 9) Stop-check VS-05 (ручные проверки)

1) Student отправил фото по photo-task → статус `submitted_for_review`, учитель видит notification  
2) Teacher reject с комментарием → student видит `rejected + comment`, может отправить заново  
3) Teacher accept → student-task становится `accepted`, метрики solved% и completion% обновляются, unit может стать completed и открыть downstream в графе  
4) Direct open: student не может “обойти” логику unlock (locked unit по-прежнему 409 UNIT_LOCKED)  
5) Storage switch: при одинаковом коде `STORAGE_ENDPOINT/MINIO_*` → MinIO работает; при `S3_ENDPOINT/ACCESS_KEY/...` → можно переключить на Beget без переписывания бизнес-логики

---

## 10) ENV (на будущее, без конкретики секретов)

Нужно предусмотреть переменные (названия примерные, агент уточнит под текущий код):
- `STORAGE_PROVIDER=minio|s3`
- `STORAGE_ENDPOINT=...`
- `STORAGE_BUCKET=...`
- `STORAGE_ACCESS_KEY=...`
- `STORAGE_SECRET_KEY=...`
- `STORAGE_REGION=...` (если нужно)
- `STORAGE_PUBLIC_BASE_URL=...` (опционально)
- `STORAGE_PRESIGN_TTL_SECONDS=...` (опционально)

---

## 11) Notes / Tech debt
- В VS-05 допустимо хранить только `assetKey` и отдавать UI через presigned URL (лучше), либо через backend proxy (если CSP/корс).
- Photo submissions лучше хранить как immutable записи, а “актуальный статус” держать в `student_task_state`.
- Список “на проверку” должен быть ограничен lead-teacher (как уже сделано для students).