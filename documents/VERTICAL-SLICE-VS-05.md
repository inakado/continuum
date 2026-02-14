# VERTICAL-SLICE-VS-05.md
Проект: **Континуум**  
Слайс: **VS-05 — Photo Tasks v1 + Photo Review + Solution PDF (LaTeX→PDF) для задач**  
Назначение документа: дать агенту “картину целиком” по VS-05 (что и в каком порядке делаем), **без глубоких деталей реализации**.

---

## 0) Контекст и предпосылки (что уже есть)
1) **Learning Core (VS-03/VS-04)** уже реализован:
- попытки, статусы задач, 3+3, блокировки, auto-credit, teacher-credit, уведомления
- student_task_state и student unit metrics (completion/solved, locked/available/completed)

2) **Object storage + worker LaTeX compile pipeline (VS-09)** уже реализован:
- единый `ObjectStorageService` (S3/MinIO)
- presigned URL как основной путь доставки PDF
- компиляция LaTeX через `tectonic` в worker (очередь), `apply` в API (idempotent + stale-safe)
- policy TTL + пресайн для student/teacher
- PDF viewer на web (pdfjs canvas) + refresh presign при expiry

3) **Task Builder (VS-02)** уже есть:
- типы задач: numeric / single / multi / photo
- решение задачи сейчас временно рендерится через **KaTeX (LiteTex)** → этого недостаточно.

---

## 1) Цель VS-05
### A) Photo задачи: загрузка ответа учеником + статус + teacher review
- Ученик может приложить **фото-ответ** к задаче типа `photo`.
- Преподаватель может **принять/отклонить** фото-ответ.
- Принятое фото считается **solved** (как “accepted photo”), влияет на **Task Solved %** и на completed-логику юнита через required-гейт.

### B) Solution PDF для задач (LaTeX→PDF pipeline)
- В Teacher UI в билдере задачи появляется **Tex editor решения + кнопка “Скомпилировать PDF” + предпросмотр** (в компактном UI).
- Компиляция решения задачи использует **тот же LaTeX pipeline**, что и теория/методика (через worker очередь).
- В Student UI, при просмотре решения задачи (после зачёта/пропуска/кредита), показывается **PDF решения**, а не KaTeX.

---

## 2) Не входит в VS-05 (явно)
- Полная “фото-ревью система” уровня LMS (комментарии цепочкой, версии, разметка на изображении, модерация несколькими преподавателями).
- Мульти-файлы/сканы в PDF (пока допускаем 1–N фото, но без сложного UI).
- Генерация “красивого” PDF решения из шаблонов с авто-инклюдом условия/рисунков.
- Публичные ссылки на фото/решения без авторизации.
- Сложные попытки/баллы/время/анализ ошибок.

---

## 3) Главные бизнес-инварианты
### 3.1 Статусы и зачёт
- **Photo задача**:
  - ученик отправляет фото → `photo_submission.status = submitted`, а `student_task_state.status = pending_review`
  - преподаватель принимает → `accepted` (это **solved**)
  - преподаватель отклоняет → `rejected` (ученик может отправить заново)
- **Solved %** растёт при:
  - `correct`
  - `teacher_credited`
  - `accepted` (photo)  ← **это цель VS-05**
- **Completion %** растёт при:
  - `correct`
  - `credited_without_progress`
  - `teacher_credited`
  - `accepted` (photo) — можно включить, если принято как “учтённая” (рекомендуется, чтобы completion не расходился странно)
- Required-гейт:
  - required photo-задача считается выполненной только при `accepted` (или `teacher_credited`, если допускается логикой VS-03/04).

### 3.2 Доступность решения
- Решение задачи (PDF) показывается ученику **только после** статуса задачи:
  - `correct` / `credited_without_progress` / `teacher_credited` / `accepted`
  - (и/или после required-skipped по вашей текущей политике)
- До этого решение скрыто.

### 3.3 Единый storage/ACL слой
- Все бинарные assets (PDF, фото) проходят через **единый ObjectStorageService**.
- Доступ к PDF/фото — **через presigned URL** (основной путь), с проверкой прав на backend (student/teacher).

---

## 4) Данные и модель (высокоуровнево)
### 4.1 Photo submission (минимальная модель)
Нужно хранить:
- кто отправил (studentId)
- к какой задаче/ревизии относится (taskId + activeRevisionId или taskRevisionId)
- список ключей файлов в object storage (assetKeys)
- текущий review статус (submitted/accepted/rejected)
- timestamps (submittedAt/reviewedAt)
- reviewer (teacherId)
- опционально: reason/comment для reject

> Важно: привязка должна быть **к актуальной ревизии** (или фиксировать revisionId на момент отправки), чтобы попытки/состояния не “поплыли” после правок задачи.

### 4.2 Solution PDF для задач
С учётом того, что у нас уже есть **ревизии задач**, решение должно храниться **в ревизии**:
- `task_revision.solutionRichLatex` (исходник)
- `task_revision.solutionPdfAssetKey` (результат компиляции)
- компиляция/применение решения — как “compile job” (аналогично unit theory/method)

> Старое поле `solution_lite` (KaTeX) убрать, даже не смотря на то что там хранятся данные.

---

## 5) API контракты (уровень “что нужно”, без реализации)
### 5.1 Student: upload photo answer
Два варианта допустимы, выбрать один как стандарт:
- **A) presigned PUT** (предпочтительно)
- **B) proxy upload** через API (fallback/debug)

Рекомендуемая схема (A):
1) `POST /student/tasks/:taskId/photo/presign-upload`
- body: `{ files: [{ filename, contentType, sizeBytes }] }`
- response: `{ uploads: [{ assetKey, url, headers }] }`
2) браузер грузит файлы напрямую в S3/MinIO по `url`
3) `POST /student/tasks/:taskId/photo/submit`
- body: `{ assetKeys: string[] }`
- response: `{ ok: true, taskState: ... }`

### 5.2 Teacher: review photo answer
- `GET /teacher/students/:studentId/tasks/:taskId/photo-submissions`
  - отдаёт активные/последние сабмиты, статусы, preview presigns
- `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/accept`
- `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/reject`
  - body: `{ reason?: string }`

### 5.3 Presign preview (photo + solution pdf)
- `GET /student/tasks/:taskId/photo/presign-view?assetKey=...`
- `GET /teacher/tasks/:taskId/photo/presign-view?assetKey=...`
- `GET /student/tasks/:taskId/solution/pdf-presign?ttlSec=...`
- `GET /teacher/tasks/:taskId/solution/pdf-presign?ttlSec=...`

> TTL, target allowlist и лимиты — через единый policy слой (как в VS-09).

### 5.4 Teacher: compile solution LaTeX (worker queue)
Аналогично VS-09:
- `POST /teacher/tasks/:taskId/solution/latex/compile` → `202 { jobId }`
- `GET /teacher/latex/jobs/:jobId` → status + presignedUrl + assetKey
- `POST /teacher/latex/jobs/:jobId/apply` → записывает `solutionPdfAssetKey` в активную ревизию задачи  
(или auto-apply, если вы так сделали в VS-09)

---

## 6) Backend логика (ядро)
### 6.1 Photo submission → state transitions
- submit:
  - проверить доступность юнита/задачи (unit availability уже есть)
  - проверить тип задачи = `photo`
  - создать submission запись, привязать к taskRevisionId
  - обновить `student_task_state` в `pending_review`
  - event log: `PhotoAttemptSubmitted`

- accept:
  - только lead teacher/роль teacher
  - пометить submission accepted
  - выставить `student_task_state = accepted`
  - пересчитать unit metrics + unlock downstream (VS-04 availability service)
  - уведомление (опционально): “photo accepted” (можно пропустить)
  - event log: `PhotoAttemptAccepted`

- reject:
  - пометить rejected + reason
  - `student_task_state = rejected`
  - event log: `PhotoAttemptRejected`

### 6.2 Влияние на метрики
- `accepted` считается как:
  - solved_tasks++ (обязательно)
  - counted_tasks++ (рекомендуется)
- required gate:
  - required photo задача считается выполненной только если `accepted` (или teacher_credited, если допускаете).

### 6.3 Семантика attempts для photo
- `attempt.kind=photo` допускается как audit-факт отправки/решения review-потока.
- Эти записи не участвуют в механике 3+3/lock и не считаются “wrong attempts”.
- UI/метрики попыток для VS-03/VS-04 должны считать только auto-check attempts (numeric/single/multi).

### 6.4 Security / ACL
- Student:
  - может presign-view только для своих submissions и только если имеет доступ к unit
- Teacher:
  - presign-view для submissions только своих учеников (lead teacher)
- Никаких “общих” proxy endpoint’ов для student, чтобы нельзя было обойти ACL.

---

## 7) Web UX (что должно получиться)
### 7.1 Student — Photo task
В runner’е задачи:
- Если тип `photo`:
  - кнопка “Загрузить фото”
  - после upload → “Отправить на проверку”
  - статус:
    - “Отправлено” / “На проверке”
    - “Отклонено” + reason (если есть) + CTA “Отправить снова”
    - “Принято” → задача зелёная, Next доступен
- Просмотр отправленного фото:
  - мини-превью (через presigned view), без сложного редактора

### 7.2 Teacher — Review
В профиле ученика (там где дерево курса/юнитов/задач):
- На карточке ученика: бейдж “Есть уведомления” уже есть — расширить/использовать для photo review.
- Внутри ученика:
  - вкладка/секция “На проверке” (или фильтр по задачам)
  - список сабмитов: ученик → задача → превью → Accept/Reject
  - reject reason textarea (короткая)

### 7.3 Teacher — Solution PDF editor (в Task Builder)
В редакторе задачи (внутри юнита):
- Раздел “Решение (PDF)”:
  - компактный Tex editor (CodeMirror)
  - кнопка “Скомпилировать PDF”
  - маленький preview (pdfjs canvas), с scroll/zoom минимально
  - статус компиляции (queued/running/succeeded/failed + logSnippet)
- После compile/apply:
  - `solutionPdfAssetKey` сохранён в active revision
  - student при показе решения грузит PDF через presign

### 7.4 Student — View solution as PDF
В задаче, когда разрешено показывать решение:
- вместо KaTeX блока → PDF viewer (тот же PdfCanvasPreview)
- refresh presign при expiry — уже реализовано для unit theory/method, переиспользовать.

---

## 8) Порядок разработки (Step-by-step)
### Step 1 — Backend: Photo submissions (DB + API contracts)
- добавить модели (submission + статус + ссылки на assets)
- endpoints presign-upload / submit / list-for-teacher / accept / reject
- связать со student_task_state и availability recompute
- event log + notifications (минимально)

### Step 2 — Web: Student photo task UX
- upload flow (presign PUT) + submit
- отображение статусов + retry после reject
- preview

### Step 3 — Web: Teacher review UX
- список “ожидают проверки”
- accept/reject + reason
- отражение статуса в дереве курса/юнитов/задач

### Step 4 — Backend: Solution PDF pipeline для task revision
- добавить поля solutionRichLatex/solutionPdfAssetKey в task revision
- compile queue endpoint для решения задачи (worker)
- apply в active revision (auto-apply допускается)

### Step 5 — Web: Solution PDF editor + Student PDF render
- teacher: компактный editor + compile + preview
- student: PDF render решения (по доступности)

---

## 9) Stop-check VS-05 (ручные проверки)
1) **Photo accepted влияет на solved%**:
- сделать photo required, отправить фото → teacher accept
- unit solved% растёт, required gate закрывается, unit может стать completed

2) **Reject не засчитывает**:
- reject → задача не solved, unit не completed

3) **ACL**:
- student не может получить presigned на чужой assetKey
- teacher не может review не своих учеников

4) **Solution PDF**:
- teacher компилирует решение → сохраняется assetKey в task revision
- student после зачёта видит PDF решения
- при истечении TTL viewer обновляет presign (1 retry)

---

## 10) Tech Debt / Notes
- Legacy `solution_lite` (KaTeX) либо оставляем как fallback на время, либо мигрируем/удаляем позже.
- В будущем можно вынести часть upload/preview в общий “Assets” модуль (если VS-10 это покрывает).
- Лимиты на фото (size/type/count) должны быть чётко прописаны policy’ем и одинаковы в API+UI.

---
