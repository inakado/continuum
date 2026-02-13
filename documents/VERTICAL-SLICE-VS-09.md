# VERTICAL-SLICE-VS-09.md
Проект: **CONTINUUM**  
Слайс: **VS-09 Theory/Method PDF Pipeline**  
Статус: **STEP 4 (override) реализован**

---

## 0) Цель VS-09
Собрать рабочий контур:

1. Teacher редактирует LaTeX в юните (Theory/Method).
2. Компиляция PDF выполняется асинхронно через очередь и worker (tectonic).
3. PDF загружается в объектное хранилище (MinIO dev / S3 prod) через общий storage слой.
4. Ключ PDF сохраняется в `Unit`.
5. Teacher/Student получают доступ к PDF через **presigned URL** (основной путь доставки).

Proxy-стрим остаётся только как debug/fallback путь, не как основной delivery path.

---

## 1) Реализованный поток (текущее состояние)

### 1.1 Teacher compile flow (основной)
1. `POST /teacher/units/:id/latex/compile`  
   - body: `{ target, tex, ttlSec? }`
   - ответ: `202 { jobId }`
2. API ставит job в BullMQ queue `latex.compile`, job name `unit_pdf_compile`.
3. Worker:
   - валидирует payload
   - компилирует LaTeX через `tectonic`
   - применяет fallback-слой совместимости (T2A/xcolor)
   - загружает PDF в storage (`ContentType: application/pdf`)
   - возвращает `assetKey` в результат job
4. Teacher читает статус:
   - `GET /teacher/latex/jobs/:jobId`
   - статусы: `queued | running | succeeded | failed`
5. После `succeeded`:
   - `POST /teacher/latex/jobs/:jobId/apply`
   - сервер сохраняет `assetKey` в `Unit.theoryPdfAssetKey` или `Unit.methodPdfAssetKey`.

### 1.2 Teacher/Student preview flow
- Presigned endpoints:
  - `GET /teacher/units/:id/pdf-presign?target=...&ttlSec=...`
  - `GET /units/:id/pdf-presign?target=...&ttlSec=...`
- Web рендерит PDF через PDF.js canvas preview.

---

## 2) Access rules (STEP 4 hardening)

### 2.1 Teacher
- Только роль `teacher`.
- Для compile/presign/apply используется текущая проектная модель доступа:
  - RBAC teacher
  - unit должен существовать.

### 2.2 Student
- Только роль `student`.
- Доступ к presign только для доступных студенту юнитов (learning availability).
- Если юнит locked:
  - HTTP `409`
  - `{ code: "UNIT_LOCKED", message: "Unit is locked" }`.

### 2.3 Утечки assetKey
- Student не получает assetKey/URL для locked unit.
- Проверка locked выполняется до выдачи presigned URL.

---

## 3) TTL policy (STEP 4)

Единая policy для teacher/student presign:

- `student` default TTL: **180 сек**
- `teacher` default TTL: **600 сек**
- upper bound: **3600 сек**

Ошибки policy:

- invalid ttl: `400 { code: "INVALID_TTL" }`
- ttl выше лимита: `400 { code: "TTL_TOO_LARGE" }`
- invalid target: `400 { code: "INVALID_PDF_TARGET" }`

---

## 4) Key naming standard

Стандарт ключей PDF юнита:

- `units/<unitId>/theory/<timestamp>.pdf`
- `units/<unitId>/method/<timestamp>.pdf`

Этот формат обязателен для worker compile pipeline и сохранения в `Unit`.

---

## 5) Storage contract

Используется общий `ObjectStorageService` в API.

Ключевые требования:
- upload PDF с `ContentType: application/pdf`
- presigned выдача с response content-type hint для корректного отображения PDF
- MinIO/S3 конфигурируется через env (`S3_*`, `S3_PUBLIC_BASE_URL` для dev host rewrite кейса).

---

## 6) API contracts (актуальные)

### 6.1 Compile enqueue
`POST /teacher/units/:id/latex/compile`

Request:
```json
{
  "target": "theory",
  "tex": "\\documentclass{article} ...",
  "ttlSec": 600
}
```

Response `202`:
```json
{ "jobId": "12345" }
```

### 6.2 Job status
`GET /teacher/latex/jobs/:jobId?ttlSec=600`

Response:
```json
{
  "jobId": "12345",
  "status": "succeeded",
  "assetKey": "units/<unitId>/theory/<timestamp>.pdf",
  "presignedUrl": "https://..."
}
```

failed:
```json
{
  "jobId": "12345",
  "status": "failed",
  "error": {
    "code": "LATEX_COMPILE_FAILED",
    "message": "...",
    "logSnippet": "..."
  }
}
```

### 6.3 Apply
`POST /teacher/latex/jobs/:jobId/apply`

Response:
```json
{
  "ok": true,
  "unitId": "<unitId>",
  "target": "theory",
  "assetKey": "units/<unitId>/theory/<timestamp>.pdf"
}
```

---

## 7) Frontend scope (минимальный)

### Teacher
- Вкладки Theory/Method внутри редактирования юнита.
- Кнопка compile запускает enqueue + polling + apply.
- После apply обновляется preview URL.

### Student
- Вкладки Theory/Method подтягивают PDF из S3 через student presign endpoint.
- Прогресс-блоки на вкладках Theory/Method скрыты (чтобы освободить место для PDF).

---

## 8) Техдолг (зафиксировано)

1. **Worker pipeline evolution**
   - добавить retry policy/attempt strategy, metrics, dead-letter handling.
   - добавить cancellation/idempotency для повторных compile запросов.

2. **Presigned policy (prod)**
   - формализовать TTL/security policy по окружениям.
   - ротация ключей/доп. ограничения для production S3.

3. **LaTeX compatibility fallback layer**
   - текущие fallback’и (font/T2A/xcolor/tikz) временные.
   - нужен отдельный формальный compatibility profile + список поддерживаемых пакетов.

4. **Observability**
   - единый compile audit trail в event log + job diagnostics.
   - структурированные метрики compile durations/fail rates.

---

## 9) Stop-check (базовые проверки STEP 4)

1. TTL upper bound:
   - запрос `ttlSec=999999`
   - ожидаем `400` + `TTL_TOO_LARGE`.
2. Student locked unit:
   - `GET /units/:id/pdf-presign?...`
   - ожидаем `409` + `UNIT_LOCKED`.
3. Worker lifecycle:
   - enqueue -> queued/running -> succeeded/failed.
4. Apply + naming:
   - после apply ключ в `Unit` начинается с `units/<unitId>/<target>/`.
5. Content-Type:
   - `curl -I "<presignedUrl>"` содержит `application/pdf`.

---

END
