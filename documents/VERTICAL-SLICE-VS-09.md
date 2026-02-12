# VERTICAL-SLICE-VS-09.md
Проект: **Континуум**  
Слайс: **VS-09 Theory Render v1: LaTeX → PDF (tectonic) → Object Storage (MinIO/S3) → Preview in Web**  
Назначение документа: дать агенту “картину целиком” по VS-09 — что и в каком порядке делаем, **без глубоких деталей реализации**, но с чёткими границами и stop-check.

---

## 0) Контекст и границы

### Что уже есть в проекте (ожидаемо к моменту VS-09)
- NestJS API (`apps/api`)
- Next.js Web (`apps/web`)
- MinIO в dev (через docker-compose) и env-конфиг для S3-совместимого хранилища
- Сущность `Unit` уже содержит поля для теории/методики (как минимум ключи ассетов PDF)
- Роли teacher/student, cookie-auth, RBAC, event log

### Цель VS-09
Сделать **рабочий end-to-end контур**:
1) Учитель редактирует **полный LaTeX документ** (не “кусочки”) для Theory/Method.  
2) Backend компилирует LaTeX в PDF с помощью **tectonic**.  
3) PDF складывается в **объектное хранилище** (MinIO локально, S3 Beget в проде).  
4) Web показывает **предпросмотр PDF** (без browser PDF viewer UI — через PDF.js canvas/text layer).

### Вне scope (не делаем в VS-09)
- Rich текст/версии “по страницам”, коллаборация, комментарии.
- Расширенные права доступа (presigned URL, public bucket) — только если нужно минимально.
- Миграция на фото-задачи/вложения — только подготовка storage-адаптера (см. ниже).
- Сложный build-farm, очередь компиляций на воркере (можно, но только если реально необходимо для стабильности; baseline допускает sync/async минимально).

---

## 1) Роли и UX-потоки

### Teacher (редактор)
- Вкладки юнита: **Теория** / **Методика** (остальные вкладки не цель VS-09).
- Для каждой вкладки:
  - Поле редактора LaTeX (полный документ).
  - Кнопки:
    - **Сохранить**
    - **Скомпилировать PDF**
    - **Предпросмотр PDF**
- Состояния UI:
  - “Сохранено”
  - “Компиляция…”
  - “PDF обновлён (дата/время)”
  - Ошибка компиляции (лог/вырезка)

### Student (просмотр)
- Student видит **только PDF**:
  - Theory PDF
  - Method PDF
- Пока PDF не собран/не опубликован — показываем понятную заглушку “Материал ещё не опубликован”.

---

## 2) Данные и модель Unit

### Поля в Unit (минимум для VS-09)
Для **Theory**:
- `theoryRichLatex` (string | null) — исходник LaTeX
- `theoryPdfAssetKey` (string | null) — ключ PDF в объектном хранилище

Для **Method**:
- `methodRichLatex` (string | null)
- `methodPdfAssetKey` (string | null)

Дополнительно (желательно, но не обязательно):
- `theoryPdfUpdatedAt` / `methodPdfUpdatedAt` (timestamp | null) — чтобы UI показывал актуальность
- `theoryCompileError` / `methodCompileError` (string | null) — кратко (не гигантские логи)

Примечание: ревизии/история LaTeX в VS-09 не обязательны. Если уже есть EventLog — пишем событие “UnitTheoryPdfCompiled/Failed” и “UnitMethodPdfCompiled/Failed”.

---

## 3) Object Storage Adapter (shared) — ОБЯЗАТЕЛЬНО

### 3.1 Принцип: один адаптер на всё
В проекте должен существовать **единый модуль object storage**, который инкапсулирует всю работу с S3-совместимым хранилищем.

- **Запрещено**: вызывать AWS SDK/MinIO SDK напрямую из контроллеров/доменных сервисов/воркеров.
- **Разрешено**: использовать только `ObjectStorageService` (или `S3StorageService`) через DI.

Этот адаптер будет переиспользован в будущих слайсах:
- PDF теории/методики (VS-09)
- фото-задачи (VS-05)
- вложения/ассеты/“кассеты” и т.д.

### 3.2 Конфиг: MinIO dev и S3 Beget prod через env
Переключение окружений — **только через env**, без изменения кода.

Переменные окружения (пример):
- `S3_ENDPOINT` (для MinIO обязателен; для S3 Beget тоже может быть endpoint)
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_FORCE_PATH_STYLE` (true для MinIO)
- `S3_PUBLIC_BASE_URL` (опционально, если потребуется URL-строитель)

### 3.3 API адаптера (минимальный, но универсальный)
Адаптер обязан поддерживать минимум:
- `putObject({ key, contentType, body, cacheControl? })`
- `getObject({ key })` (stream/buffer)
- `headObject({ key })` (exists/metadata)
- `deleteObject({ key })`

Опционально (не обязательно в VS-09):
- `getPresignedGetUrl({ key, expiresInSec })`

### 3.4 Key-naming: единый формат ключей
Должен быть единый helper/функция построения ключей, чтобы дальше переиспользовать для любых ассетов:
- `theory/unit/{unitId}/theory.pdf`
- `method/unit/{unitId}/method.pdf`

(Если захотите ревизии позже — добавим `v{n}`.)

---

## 4) Tectonic (LaTeX → PDF) — установка и запуск

### 4.1 Требование
- Компиляция LaTeX должна происходить **через tectonic**.
- Компиляция запускается в backend (или worker), но результат всегда загружается в storage через `ObjectStorageService`.

### 4.2 Установка tectonic (обязательный подпункт)
Нужно добавить в проект **явную инструкцию и/или Docker provisioning**, чтобы tectonic реально присутствовал в окружении выполнения:

Варианты:
- **A) В контейнере api/worker** (предпочтительно для воспроизводимости):
  - добавить установку tectonic в Dockerfile (лучше в worker, но допускается api если нет worker pipeline)
- **B) Локально на хосте** (нежелательно, но допустимо для dev):
  - документируем установку через brew/apt и проверяем `tectonic --version`

В любом случае должны быть stop-check команды, подтверждающие наличие tectonic.

### 4.3 Политика компиляции (минимальная)
- Вход: LaTeX string (полный документ)
- Выход: PDF bytes + статус (ok/error)
- При ошибке: вернуть учителю **короткий лог** (кусок stderr + строка/контекст), не гигабайты.

---

## 5) Backend API: команды и чтение PDF

### 5.1 Teacher: сохранить LaTeX
- `PATCH /teacher/units/:id`
  - сохраняет `theoryRichLatex` / `methodRichLatex` (без компиляции)

### 5.2 Teacher: скомпилировать PDF
Два отдельных действия (чётко):
- `POST /teacher/units/:id/theory/compile`
- `POST /teacher/units/:id/method/compile`

Поведение:
- Берём соответствующий `*RichLatex`
- Компилируем tectonic → PDF bytes
- Загружаем PDF bytes в storage через `ObjectStorageService.putObject`
- Обновляем `*PdfAssetKey` и `*PdfUpdatedAt`
- Пишем событие в event log (успех/ошибка)

Ответ API (минимально):
- success: `{ assetKey, updatedAt }`
- error: `{ code: "LATEX_COMPILE_FAILED", message, logSnippet }`

### 5.3 Student/Web: получить PDF (без public bucket)
Чтобы не делать бакет публичным, web получает PDF через backend-proxy:

- `GET /units/:id/theory.pdf`
- `GET /units/:id/method.pdf`

RBAC:
- Student должен иметь доступ к юниту по VS-04 (locked → запрет)
- Teacher может смотреть всегда

Реализация:
- backend читает из storage `getObject(assetKey)` и стримит `application/pdf`
- без browser viewer UI на фронте

(В будущем можно заменить на presigned URL, но это не обязательно в VS-09.)

---

## 6) Web: PDF preview (PDF.js)

### 6.1 Требование
- Не использовать встроенный браузерный PDF viewer (никаких тулбаров/рамок).
- Рендер PDF как часть страницы: PDF.js canvas + text layer, lazy-load страниц, масштаб под ширину контейнера.

### 6.2 Teacher preview
- Во вкладке “Теория/Методика”:
  - кнопка “Предпросмотр PDF”
  - если `assetKey` есть → показать PDF viewer
  - если нет → заглушка “PDF ещё не собран”

### 6.3 Student preview
- Student видит только PDF (если assetKey есть).
- Если нет — заглушка.

---

## 7) Порядок разработки (backend-first, step-by-step)

### Step 1 — ObjectStorageService (shared) + smoke-check
- Реализовать единый адаптер.
- Поднять MinIO в dev (если ещё не поднят).
- Smoke:
  - `putObject` → `headObject` → `getObject` (маленький файл) — успех.

### Step 2 — Tectonic availability
- Добавить установку tectonic (Dockerfile или documented host install).
- Stop-check: `tectonic --version` в окружении выполнения.

### Step 3 — Teacher compile endpoints
- `POST /teacher/units/:id/theory/compile`
- `POST /teacher/units/:id/method/compile`
- Компиляция → upload → save assetKey → event log.

### Step 4 — Backend PDF proxy
- `GET /units/:id/theory.pdf`
- `GET /units/:id/method.pdf`
- Проверка RBAC и unit доступности.

### Step 5 — Web PDF viewer (Teacher + Student)
- PDF.js viewer компонент (реюз).
- Teacher: preview + кнопки compile/save.
- Student: только preview.

---

## 8) Stop-check VS-09 (минимум, но железно)

1) **Storage smoke**  
   - кладём объект в MinIO через ObjectStorageService  
   - читаем обратно байты → совпадают

2) **Tectonic доступен**  
   - `tectonic --version` в том же окружении, где будет компиляция

3) **Teacher compile**  
   - teacher вводит валидный LaTeX → compile → получает `assetKey`  
   - `GET /units/:id/theory.pdf` возвращает `200` и `application/pdf`

4) **Student preview**  
   - student открывает юнит → вкладка Theory → PDF рендерится  
   - если юнит locked → доступ к `/units/:id/theory.pdf` запрещён (ожидаемая ошибка как в VS-04)

5) **Ошибка компиляции**  
   - teacher отправляет заведомо битый LaTeX → compile → `LATEX_COMPILE_FAILED` + `logSnippet`  
   - ничего не загружается в storage, assetKey не обновляется

---

### 9) Future-proofing (сразу закладываем, но НЕ реализуем в VS-09)

### 9.1 Компиляция LaTeX через worker + очередь (позже)
**Зачем:** компиляция PDF может быть тяжёлой/долгой; API не должен блокироваться на CPU/IO.

**Как закладываем сейчас (в VS-09):**
- Вводим “use case”/сервис `TheoryRenderService` (или `UnitPdfRenderService`) с методом:
  - `compileAndStore(unitId, kind: "theory"|"method") -> { assetKey, updatedAt }`
- Контроллеры `POST /teacher/units/:id/{theory|method}/compile` вызывают этот сервис.
- Внутри сервиса компиляция сейчас выполняется синхронно (baseline), но сервис проектируется так, чтобы потом заменить реализацию на:
  - enqueue job в Redis/BullMQ,
  - worker выполняет `compileAndStore`,
  - API возвращает `202 Accepted` + jobId / или сразу “queued”.

**Ограничение VS-09:** никаких очередей/джобов сейчас не добавляем, только правильные точки расширения.

### 9.2 Выдача PDF: proxy сейчас, presigned позже
**Сейчас (VS-09):** выдаём PDF через backend-proxy эндпоинты:
- `GET /units/:id/theory.pdf`
- `GET /units/:id/method.pdf`

**Почему:** проще контроль доступа (RBAC + locked/available) и не нужно делать бакет публичным.

**Как закладываем сейчас (в VS-09):**
- В `ObjectStorageService` добавляем метод (может быть неиспользуемым сейчас):
  - `getPresignedGetUrl(key, expiresInSec) -> url`
- В коде выдачи PDF делаем стратегию (не обязательно внедрять сложный DI):
  - `PDF_DELIVERY_MODE=proxy|presigned` (по умолчанию proxy)
- Контракт фронта не должен зависеть от режима:
  - либо фронт всегда ходит в `GET /units/:id/theory.pdf`,
  - либо фронт получает `pdfUrl` из API (но тогда сейчас это будет proxy-url, а позже presigned-url).
  
**Ограничение VS-09:** presigned не включаем, только готовим интерфейс и env-переключатель.
---
END