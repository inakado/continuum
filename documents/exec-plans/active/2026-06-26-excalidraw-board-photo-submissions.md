# Excalidraw board answers for photo tasks

Статус: `Active`

## 0. Текущее состояние и правило продолжения

Короткий active plan был создан перед первыми кодовыми правками. После замечания пользователя реализация остановлена; этот документ фиксирует подробный пошаговый план до дальнейшего продолжения.

Уже начатые, но не завершённые направления нужно довести строго по шагам ниже:

- Prisma/shared contracts частично расширены под `answerKind=photo|board`.
- Backend endpoints/write/read/UI ещё не считаются готовыми.
- Generated docs и SoR-доки ещё не обновлены.

## 1. Цель и контекст

Добавить Excalidraw-доску как второй способ отправки ответа для существующей `photo`-задачи.

Ключевой доменный выбор:

- не добавлять `TaskAnswerType.board`;
- `TaskAnswerType.photo` остаётся manual-review задачей;
- способ отправки хранится внутри `PhotoTaskSubmission.answerKind`;
- teacher `accept/reject` и progress/unlock semantics остаются текущими.

Manual Review invariants сохраняются:

- student создаёт `Attempt.kind = photo`;
- до проверки `Attempt.result = pending_review`;
- `accepted` переводит задачу в solved/counted progress;
- `rejected` не увеличивает `wrongAttempts`;
- проверяет только lead teacher;
- S3/MinIO доступ только через backend-generated presigned URLs с ACL.

## 2. In scope

- DB/model: `PhotoTaskSubmission.answerKind = photo | board`.
- Board JSON snapshot + PNG preview как отдельные asset keys.
- Student API: board presign upload + board submit.
- Student UI: выбор `Фото` / `Доска` для `photo`-задачи.
- Teacher review UI: board preview в существующем inbox/detail flow.
- Shared zod contracts и runtime parsing.
- Asset policy/ACL для JSON/PNG.
- Audit payload с `answer_kind`.
- Focused tests и SoR/generated docs.

## 3. Out of scope

- Realtime/collaboration.
- Новый `TaskAnswerType`.
- Автосохранение черновиков доски.
- Отдельный review-flow для board.
- Backend rendering/parsing Excalidraw JSON как HTML.
- Универсальная asset ownership таблица.
- DB check constraints для `answerKind` в первой итерации, если service-level invariant покрыт тестами.

## 4. Архитектурные решения

1. `photo_task_submissions.asset_keys_json` остаётся источником фото-файлов.
2. Для `answerKind='photo'`:
   - `assetKeysJson` содержит 1-5 image keys;
   - `boardAssetKey = null`;
   - `boardPreviewAssetKey = null`.
3. Для `answerKind='board'`:
   - `assetKeysJson = []`;
   - `boardAssetKey` хранит Excalidraw JSON;
   - `boardPreviewAssetKey` хранит PNG preview.
4. Board keys живут под prefix:
   - `tasks/{taskId}/photo/{studentId}/{taskRevisionId}/board/`.
5. Excalidraw грузится только client-side и только в student board UI.
6. Teacher side по умолчанию показывает PNG preview; JSON нужен как source asset, не как обязательный viewer.

## 5. Пошаговый Backend/DB/API план

### 5.1 Prisma и migration

1. Проверить `apps/api/prisma/schema.prisma`.
2. Добавить/оставить enum:
   - `PhotoTaskSubmissionAnswerKind { photo, board }`.
3. Добавить/оставить поля в `PhotoTaskSubmission`:
   - `answerKind PhotoTaskSubmissionAnswerKind @default(photo) @map("answer_kind")`;
   - `boardAssetKey String? @map("board_asset_key")`;
   - `boardPreviewAssetKey String? @map("board_preview_asset_key")`.
4. Создать migration:
   - `answer_kind NOT NULL DEFAULT 'photo'`;
   - nullable `board_asset_key`;
   - nullable `board_preview_asset_key`.
5. Не менять:
   - `TaskAnswerType`;
   - `AttemptKind`;
   - `AttemptResult`;
   - progress schema.
6. После schema edit запустить `prisma format` в корректном Docker/Prisma контуре, если локальный binary доступен.

### 5.2 Shared contracts

1. В `packages/shared/src/contracts/learning-photo.ts` добавить board schemas:
   - `StudentPhotoBoardPresignUploadRequestSchema`;
   - `StudentPhotoBoardPresignUploadResponseSchema`;
   - `StudentPhotoBoardSubmitRequestSchema`.
2. Зафиксировать limits:
   - JSON content type: `application/json`;
   - JSON max size: 5 MB;
   - preview content type: `image/png`;
   - preview max size: 10 MB;
   - TTL max: 600 sec.
3. Расширить read/review response schemas:
   - `answerKind: "photo" | "board"`;
   - `boardAssetKey: string | null`;
   - `boardPreviewAssetKey: string | null`.
4. Сохранить backward compatibility:
   - старые payload без `answerKind` должны парситься как `photo`, если это нужно web runtime parsing.
5. Экспортировать board request/response types.

### 5.3 Policy-as-code

1. В `photo-task-policy.constants.ts` добавить board constants.
2. В `PhotoTaskPolicyService` добавить:
   - strict content type helpers для JSON/PNG;
   - generated key pattern validation для `.json` и `.png`;
   - `inferResponseContentType` для `.json`.
3. Проверять:
   - key format;
   - prefix ownership;
   - exact generated suffix;
   - TTL через существующий resolver.
4. Не добавлять ad hoc regex в controllers/services.

### 5.4 Student board endpoints

1. В `StudentPhotoTasksController` добавить:
   - `POST /student/tasks/:taskId/photo/board/presign-upload`;
   - `POST /student/tasks/:taskId/photo/board/submit`.
2. Использовать `ZodValidationPipe` и shared schemas.
3. Оставить существующие photo endpoints без breaking changes.
4. Ошибки:
   - invalid payload/size/ttl -> boundary validation error;
   - invalid generated key/prefix -> `INVALID_ASSET_KEY`;
   - unavailable unit -> `UNIT_LOCKED`;
   - non-photo task -> `TASK_NOT_PHOTO`.

### 5.5 Write-path

1. В `PhotoTaskService` и `PhotoTaskReviewWriteService` добавить:
   - `presignBoardUpload`;
   - `submitBoard`.
2. В `photo-task-student-write.ts` добавить:
   - `presignStudentPhotoBoardUpload`;
   - `submitStudentPhotoBoardTask`.
3. `presignStudentPhotoBoardUpload`:
   - `requirePublishedPhotoTask`;
   - `assertUnitAvailableForStudent`;
   - build board prefix;
   - generate JSON key;
   - generate PNG preview key;
   - return two presigned `PUT` URLs.
4. `submitStudentPhotoBoardTask` должен переиспользовать текущую photo submit логику:
   - transaction;
   - `requirePublishedPhotoTask`;
   - availability recompute/check;
   - create/reset `StudentTaskState` при смене active revision;
   - reject if credited;
   - create `Attempt.kind=photo`, `result=pending_review`;
   - create `PhotoTaskSubmission.answerKind=board`;
   - set `assetKeysJson=[]`;
   - set `boardAssetKey`, `boardPreviewAssetKey`;
   - update task state to `pending_review`;
   - recompute section availability.
5. Audit `PhotoAttemptSubmitted` payload:
   - `answer_kind: "board"`;
   - `board_asset_key`;
   - `board_preview_asset_key`.

### 5.6 Read-path and ACL

1. Во всех Prisma `select`, которые идут в `mapSubmission`, добавить:
   - `answerKind`;
   - `boardAssetKey`;
   - `boardPreviewAssetKey`.
2. Student list submissions:
   - возвращать `answerKind` и board keys.
3. Teacher queue/inbox/detail:
   - возвращать `answerKind`;
   - для board показывать `assetKeysCount=0` или отдельный label на frontend;
   - detail возвращает `boardPreviewAssetKey`.
4. Student/teacher presign-view:
   - считать key owned, если он найден в `assetKeysJson`;
   - или равен `boardAssetKey`;
   - или равен `boardPreviewAssetKey`.
5. ACL не ослаблять:
   - student только свои submissions и доступный unit;
   - teacher только lead-teacher submissions.

### 5.7 Teacher review accept/reject

1. Не менять endpoint semantics.
2. Accept/reject работают для `answerKind=photo` и `answerKind=board`.
3. Audit `PhotoAttemptAccepted/Rejected` payload расширить:
   - `answer_kind`;
   - board keys для board;
   - `asset_keys` для photo.
4. Progress recompute оставить текущим.

## 6. Пошаговый Frontend план

### 6.1 Dependency и Excalidraw assets

1. Добавить `@excalidraw/excalidraw` только в `apps/web`.
2. Обновить lockfile.
3. Не запускать `CI=true pnpm install --frozen-lockfile` в агентской sandbox-сессии.
4. Добавить script рядом с `apps/web/scripts/sync-mathjax-assets.mjs`:
   - копировать `node_modules/@excalidraw/excalidraw/dist/prod/fonts`;
   - target: `apps/web/public/vendor/excalidraw/`.
5. Подключить script в web `dev/build/start`, если нужно гарантировать assets.
6. В `apps/web/app/layout.tsx` через `next/script` до интерактива выставить:
   - `window.EXCALIDRAW_ASSET_PATH = "/vendor/excalidraw/"` или согласованный public path.

### 6.2 Excalidraw client-only wrapper

1. Создать локальный student-content компонент:
   - `apps/web/features/student-content/units/components/StudentExcalidrawBoard.tsx`.
2. Внутри:
   - `"use client"`;
   - import `@excalidraw/excalidraw/index.css`;
   - use `Excalidraw`;
   - accept callback/ref для `excalidrawAPI`;
   - stable non-zero height.
3. Импортировать wrapper через `next/dynamic(..., { ssr: false })`.
4. Не импортировать Excalidraw в server/shared components.
5. Использовать `serializeAsJSON` и `exportToBlob`.

### 6.3 Web API client/query keys

1. В `apps/web/lib/api/student.ts` добавить:
   - `presignPhotoBoardUpload(taskId, body)`;
   - `submitPhotoBoard(taskId, body)`.
2. Использовать shared runtime parsing schemas.
3. В `apps/web/lib/api/teacher.ts` убедиться, что detail response type включает:
   - `answerKind`;
   - `boardAssetKey`;
   - `boardPreviewAssetKey`.
4. В `apps/web/lib/query/keys.ts` добавить отдельный key для board preview, чтобы не смешивать photo gallery и board PNG.

### 6.4 Student UI

1. Не трогать `student-dashboard` и shared UI-kit без необходимости.
2. В зоне `apps/web/features/student-content/units/*` вынести photo controls из `StudentUnitDetailScreen.tsx` в локальный panel:
   - `StudentPhotoTaskSubmissionPanel`.
3. В panel сделать режимы:
   - `Фото`;
   - `Доска`.
4. Photo path оставить текущим.
5. Board path:
   - открывать доску в рабочей области с достаточной высотой;
   - на mobile не допускать горизонтального overflow;
   - submit disabled, если доска пустая.
6. Submit board:
   - получить scene elements/appState/files через `excalidrawAPI`;
   - проверить non-deleted elements;
   - `serializeAsJSON`;
   - `exportToBlob({ mimeType: "image/png" })`;
   - presign board upload;
   - `PUT application/json`;
   - `PUT image/png`;
   - call board submit endpoint;
   - invalidate `learningPhotoQueryKeys.studentUnit(unitId)`.
7. Ошибки upload/export/submit не глотать:
   - показывать локальное `submissionError`;
   - сохранить current photo behavior, но улучшить empty catch при касании.
8. Не обещать автосохранение. Dirty guard для непустой доски можно добавить, либо явно зафиксировать риск и оставить out of scope.

### 6.5 Teacher review UI

1. В `apps/web/features/teacher-review/*` не трогать student UI.
2. Inbox:
   - заменить колонку/label `Фото` на `Ответ`;
   - для `answerKind=photo`: `Фото N`;
   - для `answerKind=board`: `Доска`.
3. Detail viewer:
   - `answerKind=photo`: текущая gallery;
   - `answerKind=board`: presign `boardPreviewAssetKey`, показать PNG preview;
   - если preview key отсутствует, показать fail-closed empty/error state.
4. Sidebar:
   - добавить тип ответа;
   - accept/reject buttons оставить без изменений.
5. Teacher-side Excalidraw read-only viewer не делать в первой итерации.

## 7. Тест-план

### 7.1 Shared

- board presign request accepts valid sizes and ttl;
- rejects oversize JSON/preview;
- rejects ttl > 600;
- board submit accepts valid generated-ish keys;
- rejects invalid key format;
- teacher detail response accepts `answerKind=board`;
- old response without board fields remains compatible where intended.

### 7.2 API unit/focused

- policy validates `board/*.json` and `board/*.png`;
- board presign returns JSON + PNG uploads under board prefix;
- board submit creates:
  - `AttemptKind.photo`;
  - `AttemptResult.pending_review`;
  - `PhotoTaskSubmission.answerKind=board`;
  - `assetKeysJson=[]`;
  - board keys;
  - `StudentTaskState.pending_review`;
- board submit rejects unavailable unit;
- board submit rejects mismatched asset prefix;
- student presign-view allows own board JSON/preview only;
- teacher presign-view allows lead-teacher board JSON/preview only;
- accept/reject board submission updates progress exactly like photo;
- audit payload includes `answer_kind`.

### 7.3 API integration

- board presign endpoint happy path;
- board submit endpoint happy path;
- invalid board payload returns expected validation error semantics;
- non-owner student cannot view board key;
- non-lead teacher cannot view/review board submission.

### 7.4 Web

- API runtime parsing covers board endpoints.
- Student photo task shows `Фото` and `Доска` modes.
- Empty board cannot be submitted.
- Successful board submit calls:
  - presign board upload;
  - storage `PUT`s;
  - board submit;
  - unit query invalidation.
- Existing photo submit still works.
- Teacher inbox renders `Доска`.
- Teacher detail renders board preview instead of photo thumbnails.
- Teacher accept/reject still calls existing mutation endpoints.

## 8. Документация

Обновить SoR после кода:

- `documents/ARCHITECTURE.md`:
  - BC4/BC5: `PhotoTaskSubmission` может хранить `assetKeysJson` или `boardAssetKey|boardPreviewAssetKey`.
- `documents/LEARNING.md`:
  - photo tasks support `answerKind=photo|board`;
  - accepted/rejected/progress semantics unchanged.
- `documents/SECURITY.md`:
  - board JSON/PNG access through backend presign ACL;
  - storage CORS needs `PUT application/json` and `PUT image/png`.
- `documents/FRONTEND.md`:
  - student board UI is client-only dynamic Excalidraw;
  - teacher review uses PNG preview.
- `documents/HANDLER-MAP.md`:
  - add board presign/submit endpoints and service flow.
- `documents/DOMAIN-EVENTS.md`:
  - only if audit payload is expanded with `answer_kind`.

Generated:

- run `pnpm docs:generate`;
- verify `documents/generated/db-schema.md`;
- verify `documents/generated/api-routes.md`;
- run `pnpm docs:check`.

Не трогать без причины:

- `documents/CONTENT.md`;
- `documents/ARCHITECTURE-PRINCIPLES.md`;
- `documents/DEVELOPMENT.md`;
- `documents/DOCS-INDEX.md`.

## 9. Проверки и команды

Локально/sandbox, если dependencies уже стоят:

- `pnpm lint:boundaries`;
- `pnpm --filter @continuum/shared test`;
- `pnpm --filter web typecheck`;
- `pnpm --filter web test`;
- `pnpm docs:generate`;
- `pnpm docs:check`.

Backend Docker contour:

- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec vitest run --config vitest.integration.config.ts test/integration/learning-photo-boundary.integration.test.ts"`;
- `docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"`.

Manual smoke:

- student `/student/units/[id]`: photo task -> board submit;
- teacher `/teacher/review`: board preview -> accept/reject;
- verify progress/unlock after accepted board.

Operational constraints:

- host backend build/typecheck не запускать;
- `CI=true pnpm install --frozen-lockfile` в агентской sandbox-сессии не запускать;
- npm install/update для Excalidraw требует network escalation или выполнение пользователем локально.

## 10. Rollback

До применения migration:

- revert schema/migration/contracts/API/web/package lock/docs.

После применения migration:

1. Disable frontend board mode.
2. Disable board endpoints.
3. Оставить nullable columns до cleanup, чтобы existing photo submissions не пострадали.
4. Если нужен destructive rollback:
   - export/delete board submissions;
   - delete orphan storage objects under `.../board/`;
   - drop `board_asset_key`, `board_preview_asset_key`, `answer_kind`;
   - drop enum `PhotoTaskSubmissionAnswerKind`.

Existing photo submissions должны работать из-за default `answer_kind='photo'`.

## 11. Риски

- Excalidraw heavy bundle: dynamic import только при выборе доски.
- Excalidraw SSR-sensitive: не импортировать на server path.
- Excalidraw fonts/assets: без self-host path будет внешний CDN.
- Storage CORS: нужен `PUT application/json` и `PUT image/png`.
- Board JSON недоверенный: не рендерить как HTML.
- `assetKeysJson` non-null: для board строго использовать `[]`.
- Read-path легко сломать, если не добавить board fields во все `select`.
- Generated docs будут stale до `pnpm docs:generate`.

## 12. Decision log

- 2026-06-26: Excalidraw выбран вместо tldraw; причина: MIT license, collaboration не нужен.
- 2026-06-26: Board не становится новым `TaskAnswerType`; это `answerKind` внутри photo manual-review submission.
- 2026-06-26: Teacher первой итерации смотрит PNG preview, не read-only Excalidraw scene.
- 2026-06-26: DB check constraint для `answerKind` не обязателен в первой итерации; invariant enforce в service/policy/tests.

## 13. Progress log

- 2026-06-26: Прочитаны `AGENTS.md`, `DOCS-INDEX`, `ARCHITECTURE`, `ARCHITECTURE-PRINCIPLES`, `LEARNING`, `SECURITY`, `FRONTEND`, `DESIGN-SYSTEM`, `PLANS`, `DEVELOPMENT`.
- 2026-06-26: Сверены Excalidraw docs: installation, Next.js dynamic `ssr:false`, `excalidrawAPI`, `initialData`, export/restore utils, `UIOptions`, license/peer deps.
- 2026-06-26: Сабагенты проанализировали backend, frontend и docs/verification план.
- 2026-06-26: Подробный пошаговый план зафиксирован; дальнейшая реализация должна идти по разделам 5-9.
- 2026-06-26: Завершён foundation stage без UI: Prisma enum/columns + migration, shared board contracts, backend policy/read-contract support, generated docs. Проверка: `pnpm --filter @continuum/shared test`.
- 2026-06-26: Завершены backend этапы 5.4-5.5: добавлены student board presign/submit endpoints, service/write-path для `answerKind=board`, focused unit/integration tests, regenerated `documents/generated/api-routes.md`. Проверки: API unit tests 10/10, Docker integration boundary 7/7, docs checks OK. `pnpm --filter @continuum/api typecheck` блокируется существующим `ioredis` type mismatch в `latex-compile-queue.service.ts` и `debug.controller.ts`.
- 2026-06-26: Завершён backend этап 5.7: teacher accept/reject audit payload теперь пишет `answer_kind`, `asset_keys` для photo и board JSON/preview keys для board. Проверки: API unit tests 10/10, Docker integration boundary 7/7. Typecheck по-прежнему блокируется тем же `ioredis` mismatch вне этого изменения.
- 2026-06-26: Устранён backend typecheck blocker: BullMQ queues в `latex-compile-queue.service.ts` и `debug.controller.ts` переведены с прямого `IORedis` instance на plain connection options, чтобы не смешивать типы разных версий `ioredis`. Проверки: `pnpm --filter @continuum/api typecheck` в Docker OK, `/debug/enqueue-ping` вернул `queued=true`, API unit tests 10/10.
- 2026-06-26: Завершён frontend student board stage: добавлен client-only Excalidraw wrapper, self-hosted assets sync, `Фото/Доска` mode switch, JSON+PNG export/upload/submit flow и focused unit coverage. После ручной проверки исправлен contrast active-state в dark theme через role accent tokens. Проверки: `pnpm --filter web typecheck`, `pnpm lint:boundaries`; ранее для этого stage пройдены `pnpm --filter web test -- StudentUnitDetailScreen.test.tsx` и `pnpm --filter web build`.
- 2026-06-26: Исправлен teacher review board preview: detail-view теперь использует `boardPreviewAssetKey` как display asset для `answerKind=board`, а не ждёт пустой `assetKeys`. Проверки: live presigned board PNG `200 image/png`, `pnpm --filter web test -- TeacherReviewSubmissionDetailPanel.test.tsx`, `pnpm --filter web typecheck`, `pnpm lint:boundaries`.
- 2026-06-26: Scope расширен: вместо static PNG preview нужен teacher editable Excalidraw review board и student-facing feedback board после `accepted/rejected`. Старые ограничения `teacher-side Excalidraw viewer не делать` и `teacher review uses PNG preview` считаются промежуточным состоянием, не финальным UX.
- 2026-06-26: Завершён backend foundation для teacher feedback board: добавлены `teacher_feedback_*` поля и миграция, shared contracts для feedback presign/accept/reject, teacher feedback presign endpoint, storage policy prefix `teacher-feedback/`, accept/reject сохраняют feedback keys и создают student notification `photo_reviewed`, read ACL расширен для feedback keys. Проверки: `pnpm --filter @continuum/shared test`, focused API tests, Docker API typecheck, `pnpm --filter web typecheck`, `pnpm lint:boundaries`, live feedback presign `HTTP 200`.

## 14. Scope expansion: teacher feedback board

### 14.1 Product contract

1. Оригинальный ответ ученика immutable:
   - `PhotoTaskSubmission.boardAssetKey` и `boardPreviewAssetKey` остаются snapshot ответа ученика;
   - teacher edits никогда не перезаписывают student asset keys.
2. Учитель в review detail для `answerKind=board` открывает Excalidraw scene из student `boardAssetKey`.
3. Учитель может писать/помечать поверх сцены и затем:
   - `Принять`;
   - `Отклонить`.
4. Если teacher board содержит разбор, он сохраняется как отдельный feedback artifact:
   - feedback JSON;
   - feedback PNG preview.
5. Ученик после review получает уведомление и может открыть teacher feedback board.
6. Первая реализация ограничена `answerKind=board`; annotation поверх обычных photo submissions не входит в этот этап.

### 14.2 Data model

1. В `PhotoTaskSubmission` добавить nullable поля:
   - `teacherFeedbackBoardAssetKey String? @map("teacher_feedback_board_asset_key")`;
   - `teacherFeedbackPreviewAssetKey String? @map("teacher_feedback_preview_asset_key")`.
2. Не добавлять новую таблицу feedback в первой итерации:
   - у submission максимум один итоговый teacher feedback board;
   - repeated edit после review не входит в этап.
3. Существующий `NotificationType.photo_reviewed` использовать как student-facing notification type, если он ещё не используется для другого контракта.
4. Payload notification:
   - `studentId`;
   - `teacherId`;
   - `submissionId`;
   - `taskId`;
   - `taskRevisionId`;
   - `unitId`;
   - `status: accepted | rejected`;
   - `answerKind`;
   - `teacherFeedbackBoardAssetKey?`;
   - `teacherFeedbackPreviewAssetKey?`.

### 14.3 Storage policy

1. Feedback keys живут под отдельным prefix:
   - `tasks/{taskId}/photo/{studentId}/{taskRevisionId}/teacher-feedback/`.
2. Allowed content:
   - JSON: `application/json`, same board JSON max size;
   - preview: `image/png`, same preview max size.
3. Policy service расширить без ad hoc regex в controllers:
   - generate/validate teacher feedback JSON key;
   - generate/validate teacher feedback PNG key;
   - infer response content type для этих keys.
4. ACL:
   - teacher can GET student board JSON/preview and feedback board JSON/preview only for lead-teacher submissions;
   - student can GET own submitted board and teacher feedback board after review;
   - other students/teachers cannot presign these keys.

### 14.4 API contracts

1. Shared contracts добавить:
   - `TeacherPhotoFeedbackBoardPresignUploadRequestSchema`;
   - `TeacherPhotoFeedbackBoardPresignUploadResponseSchema`;
   - `TeacherPhotoReviewWithFeedbackRequestSchema` или расширить existing accept/reject bodies optional feedback keys.
2. Teacher endpoints:
   - `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/feedback-board/presign-upload`;
   - `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/accept`;
   - `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/reject`.
3. Accept/reject body optional fields:
   - `teacherFeedbackBoardAssetKey`;
   - `teacherFeedbackPreviewAssetKey`.
4. Accept/reject service:
   - validates feedback keys if present;
   - stores feedback fields on `PhotoTaskSubmission`;
   - keeps current progress semantics unchanged;
   - creates student notification `photo_reviewed`;
   - audit payload includes feedback keys.
5. Student endpoints:
   - extend `GET /student/tasks/:taskId/photo/submissions` response with feedback keys;
   - extend student `presign-view` ownership check for feedback keys;
   - add `GET /student/notifications` and mark-read endpoint only if no existing student notification surface can be reused.

### 14.5 Teacher frontend

1. Reuse installed `@excalidraw/excalidraw`; no new drawing dependency.
2. Split current student wrapper into reusable local board primitives only where it reduces duplication:
   - client-only Excalidraw shell;
   - scene fetch/restore helpers;
   - export JSON+PNG helper.
3. In `TeacherReviewSubmissionDetailPanel`:
   - `answerKind=photo`: keep existing image viewer;
   - `answerKind=board`: load student `boardAssetKey` JSON through teacher presign-view;
   - render editable Excalidraw board in main review area;
   - keep student board as initial state; teacher annotations happen in current scene.
4. Review actions:
   - if board changed, export feedback JSON+PNG;
   - presign feedback upload;
   - `PUT` feedback JSON+PNG;
   - call accept/reject with feedback keys;
   - if no board change, allow accept/reject without feedback keys.
5. UX:
   - action buttons show upload/review busy state;
   - failed export/upload blocks accept/reject and shows recoverable error;
   - no autosave in first iteration;
   - no collaborative editing.

### 14.6 Student frontend

1. Add student-facing reviewed feedback surface:
   - notification item links to `/student/units/:unitId?taskId=...` or existing unit route with focus;
   - unit task card shows reviewed board feedback when `teacherFeedbackBoardAssetKey` exists.
2. Student opens teacher feedback as read-only Excalidraw board:
   - load `teacherFeedbackBoardAssetKey` via student presign-view;
   - no edit controls;
   - fallback PNG preview if JSON load fails but preview key exists.
3. For rejected status:
   - show rejection reason if present;
   - show “Посмотреть разбор” action.
4. For accepted status:
   - show “Посмотреть разбор” when teacher feedback exists.

### 14.7 Tests

1. Shared:
   - feedback presign schemas accept valid JSON/PNG sizes;
   - reject invalid/oversize payloads;
   - review response schemas include feedback keys.
2. API unit:
   - teacher feedback presign returns keys under `teacher-feedback/`;
   - accept with feedback stores feedback keys and creates notification;
   - reject with feedback stores feedback keys, reason, and creates notification;
   - feedback key prefix mismatch rejected;
   - student presign-view allows own feedback keys only after review.
3. API integration:
   - non-lead teacher cannot presign feedback upload;
   - non-owner student cannot view feedback board;
   - reviewed board submission appears in student submissions with feedback keys.
4. Web:
   - teacher board detail loads Excalidraw from student JSON;
   - accept/reject exports and uploads feedback board before mutation;
   - upload failure prevents review mutation;
   - student reviewed submission renders “Посмотреть разбор” and read-only board.

### 14.8 Documentation

After code:

- `documents/LEARNING.md`: teacher feedback board lifecycle.
- `documents/FRONTEND.md`: teacher editable review board and student read-only feedback board.
- `documents/SECURITY.md`: feedback board presign ACL.
- `documents/DOMAIN-EVENTS.md`: `PhotoAttemptAccepted/Rejected` payload feedback keys and student `photo_reviewed` notification payload.
- generated docs after `pnpm docs:generate`.
