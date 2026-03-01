# 2026-03-01 — Architecture alignment tail refactor

Статус: `Active`

## Цель

Закрыть остаточные архитектурные хвосты после foundation-refactor:
- убрать manual boundary parsing в отдельных API ветках;
- убрать manual server-state во frontend вне migration-срезов;
- физически разрезать слишком крупные модули, которые уже декомпозированы логически, но остаются тяжёлыми по размеру и ответственности.

## Контекст

По состоянию после закрытия foundation plan:
- lint/typecheck/tests/docs-check зелёные;
- `apps/api` и `apps/web` не имеют lint warnings;
- основные complexity и contract-first migration waves завершены;
- при этом статический аудит по `documents/ARCHITECTURE-PRINCIPLES.md` показал остаточные зоны drift:
  - manual boundary parsing в `content/latex` и statement-image endpoints;
  - manual server-state и ручные `useEffect` read-flows в отдельных frontend ветках;
  - очень крупные файлы, которые уже улучшены логически, но ещё не доведены до физически устойчивой композиции.

Эта инициатива не меняет доменные инварианты. Её задача — довести кодовую базу до более чистого соответствия `P1/P2/P3/P4/P8/P9/P10`.

## Scope

### In scope

- API cleanup:
  - `apps/api/src/content/teacher-tasks.controller.ts`
  - `apps/api/src/content/teacher-latex.controller.ts`
  - `apps/api/src/content/internal-latex.controller.ts`
- Frontend cleanup:
  - `apps/web/features/teacher-content/events/TeacherEventsScreen.tsx`
  - `apps/web/features/teacher-content/shared/use-teacher-identity.ts`
  - `apps/web/features/teacher-content/units/hooks/use-teacher-task-statement-image.ts`
  - при необходимости adjacent cleanup в `TeacherSectionGraphPanel.tsx`, если без него нельзя завершить wave без архитектурного долга.
- Physical decomposition:
  - `apps/api/src/students/students.service.ts`
  - `apps/api/src/content/content-write.service.ts`
  - при необходимости второй очередью:
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`
    - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`

### Out of scope

- Изменение продуктового поведения.
- Переписывание уже стабилизированных migration-срезов без явной необходимости.
- Performance micro-optimization без архитектурной причины.
- Отдельный profiling/perf initiative с browser traces и DB profiling.

## Зафиксированный порядок выполнения

### Wave 1 — Manual boundary parsing в API

Цель:
- довести остаточные API ветки до `contract-first` / `fail-fast boundary validation`.

Целевые файлы:
- `apps/api/src/content/teacher-tasks.controller.ts`
- `apps/api/src/content/teacher-latex.controller.ts`
- `apps/api/src/content/internal-latex.controller.ts`

Что делаем:
- выносим request/query/job payload parsing в schema/helper слой;
- для внешних teacher endpoints используем shared contracts там, где это оправдано HTTP/web reuse;
- для internal latex apply/job payload/result убираем дублирование `parseJobPayload/parseJobResult`;
- сохраняем текущие `error.code`, HTTP semantics и response shape.

Ожидаемая польза:
- меньше ручного `unknown/as Record<string, unknown>`;
- меньше дублирования;
- чище соответствие `P2/P3/P8`.

Текущий прогресс:
- `teacher-tasks.controller.ts` statement-image endpoints переведены на `ZodValidationPipe` + shared contracts:
  - `POST /teacher/tasks/:taskId/statement-image/presign-upload`
  - `POST /teacher/tasks/:taskId/statement-image/apply`
  - `GET /teacher/tasks/:taskId/statement-image/presign-view`
- для этого среза добавлены shared contracts:
  - `packages/shared/src/contracts/content-assets.ts`
- API boundary safety-net добавлен:
  - `apps/api/test/integration/task-statement-image-boundary.integration.test.ts`
- exact error compatibility сохранена для:
  - `INVALID_TTL`
  - `TTL_TOO_LARGE`
  - `INVALID_FILE_TYPE`
  - `FILE_TOO_LARGE`
  - `INVALID_ASSET_KEY`
- `task-statement-image-policy.constants.ts` переведён на shared constants, чтобы убрать дубли лимитов внутри API boundary.
- `teacher-latex.controller.ts` и `internal-latex.controller.ts` переведены на общий LaTeX boundary/helper слой:
  - `POST /teacher/units/:id/latex/compile`
  - `POST /teacher/tasks/:taskId/solution/latex/compile`
  - `GET /teacher/tasks/:taskId/solution/pdf-presign`
  - `GET /teacher/latex/jobs/:jobId`
  - `POST /internal/latex/jobs/:jobId/apply`
- добавлен API-local contract/helper слой:
  - `apps/api/src/content/latex-boundary.contracts.ts`
- в `teacher-latex.controller.ts` внешний boundary переведён на `ZodValidationPipe`;
- дубли `parseJobPayload/parseJobResult` убраны из `teacher-latex.controller.ts` и `internal-latex.controller.ts`, обе ветки используют общий helper;
- API boundary safety-net добавлен:
  - `apps/api/test/integration/latex-boundary.integration.test.ts`
- exact error compatibility сохранена для:
  - `INVALID_PDF_TARGET`
  - `INVALID_LATEX_INPUT`
  - `LATEX_TOO_LARGE`
  - `INVALID_TTL`
  - `TTL_TOO_LARGE`
  - `LATEX_JOB_PAYLOAD_INVALID`
  - `LATEX_JOB_RESULT_INVALID`
- По факту Wave 1 закрыта целиком: остаточный manual boundary parsing в API ветках `statement-image` и `latex` удалён без изменения response shape и legacy error semantics.

### Wave 2 — Manual server-state во frontend вне migration-срезов

Цель:
- убрать оставшиеся ручные read-flow и auth/data fetch patterns вне общего query-layer.

Целевые файлы:
- `apps/web/features/teacher-content/events/TeacherEventsScreen.tsx`
- `apps/web/features/teacher-content/shared/use-teacher-identity.ts`
- `apps/web/features/teacher-content/units/hooks/use-teacher-task-statement-image.ts`

Adjacency candidate:
- `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`

Что делаем:
- переводим read-path на `@tanstack/react-query`;
- заменяем ручные `useEffect + loading/error` на query/mutation model;
- там, где upload/apply/delete требуют refresh, используем query invalidation или точечный cache update;
- не вносим `TanStack Query` насильно в purely-local UI state.

Ожидаемая польза:
- меньше лишних cold-fetch;
- меньше рассинхронизации UI state;
- лучшее соответствие `P9/P10`;
- дешевле дальнейший refactor teacher content flows.

### Wave 3 — Physical decomposition больших модулей

Цель:
- довести уже логически выпрямленные модули до физически устойчивой композиции.

Первый приоритет:
- `apps/api/src/students/students.service.ts`
- `apps/api/src/content/content-write.service.ts`

Второй приоритет:
- `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`
- `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`

Что делаем:
- выносим под-домены/подзадачи в отдельные сервисы/hooks/components;
- не размазываем domain rules по call-sites;
- сохраняем public contract текущих controllers/screens;
- не режем ради размера самого по себе, а режем по ответственности.

Ожидаемая польза:
- лучшее соответствие `P1/P4/P8`;
- ниже стоимость следующих изменений;
- проще targeted testing и code review.

## Правила безопасного выполнения

### 1) Порядок работы по каждому файлу

1. Анализ текущего поведения и источника архитектурного drift.
2. Добавление/расширение targeted safety-net тестов.
3. Refactor только выбранного файла/flow.
4. Targeted verification.
5. Только потом переход к следующему файлу.

### 2) Compatibility rules

- Не менять доменные инварианты.
- Не менять текущие `error.code`, если refactor касается API boundary.
- Не менять response payload shape без отдельного решения.
- Не ухудшать UX/error semantics на teacher/student сценариях.

### 3) Performance rules

- Не делать “оптимизацию” ценой роста скрытой сложности.
- Query/cache/invalidation использовать только там, где это реально уменьшает orchestration.
- Для upload/preview flow избегать лишних full refetch, если можно обновить cache локально.

### 4) Stop conditions

- поведение становится неоднозначным и не подтверждается кодом/тестами;
- нужен отдельный продуктовый выбор;
- refactor тянет за собой несвязанный доменный redesign.

При stop-condition:
- фиксируем остаток в этом плане;
- оставляем систему в рабочем состоянии;
- уменьшаем инкремент.

## План тестирования и проверки

### Repo-level

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:check` если меняются docs/contracts

### Backend-in-Docker

- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec tsc -p tsconfig.json --noEmit"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm build"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"` для boundary-sensitive API changes
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"` для auth-sensitive batches

### Frontend targeted

- `pnpm --filter web test -- <suite>`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`

## Initial file triage

### API: manual boundary parsing

- `teacher-tasks.controller.ts`
  - statement image endpoints ещё держат `@Body() body: unknown`, `asRecord()` и ручной parse.
- `teacher-latex.controller.ts`
  - compile/job payload/result parsing вручную и локально.
- `internal-latex.controller.ts`
  - дублирует parse-layer `teacher-latex.controller.ts`.

### Web: manual server-state

- `TeacherEventsScreen.tsx`
  - локальные `events/loading/error/authRequired`, ручной `useEffect`.
- `use-teacher-identity.ts`
  - ручной `teacherApi.getTeacherMe()` вне query cache.
- `use-teacher-task-statement-image.ts`
  - ручной preview fetch, upload/apply/delete orchestration и full refresh через `fetchUnit()`.

### Large modules

- `students.service.ts`
  - teacher management + student lifecycle всё ещё сидят в одном сервисе.
- `content-write.service.ts`
  - course/section/unit/task/task-revision/image write-paths собраны в одном крупном модуле.
- `TeacherDashboardScreen.tsx`
  - физически всё ещё очень большой shell, несмотря на локальную декомпозицию.
- `TeacherStudentProfilePanel.tsx`
  - всё ещё тяжёлый drilldown/orchestration экран.

## Decision log

- Новый план выделен отдельно, потому что foundation-refactor закрыт и не должен дальше разрастаться активным backlog.
- Порядок `API boundary -> frontend server-state -> physical decomposition` выбран, потому что:
  - сначала выгоднее добить contract-first хвост;
  - затем убрать ручной state-management drift;
  - и только потом резать самые большие модули, когда входные/выходные контуры уже чище.

## Финальный этап — Performance profiling и targeted optimization

Этот этап выполняется только после завершения архитектурного cleanup выше.

### Цель

Ускорить отклик и работу проекта не “по ощущению”, а через измерение реальных bottleneck-ов и последующую точечную оптимизацию.

### Measurement-first принципы

1. Сначала обнаруживаем узкое место, потом оптимизируем.
2. Любая optimization wave начинается с baseline-замера и заканчивается повторным замером.
3. Нельзя лечить архитектурный smell как performance issue, пока не подтверждён bottleneck.
4. Нельзя добавлять memoization/cache/query hacks без доказанной пользы.
5. Если проблема не измерена, она не считается доказанным performance-target.

### Как будем определять узкие места

#### 1. Network profile

Целевые сценарии:
- student dashboard
- teacher dashboard
- teacher section graph
- teacher unit editor
- student unit detail при необходимости, если profiling покажет его как hot-path

Смотрим:
- самые долгие запросы;
- дублирующиеся запросы;
- waterfall вместо параллельной загрузки;
- лишние refetch после mutation/navigation;
- размер payload.

Классификация bottleneck:
- `network-bound` — экран ждёт сеть или каскад запросов;
- `mixed` — сеть + client render одновременно дают заметную задержку.

#### 2. React render profile

Целевые сценарии:
- student dashboard / student unit flows;
- большие teacher screens;
- graph/edit flows;
- unit editor/write flows.

Смотрим:
- expensive commits;
- частоту ререндеров;
- каскадные обновления subtree;
- expensive derived state;
- interaction stalls после ввода, drag, save.

Классификация bottleneck:
- `render-bound` — главный тормоз в render/commit cost;
- `mixed` — API уже ответил, но UI всё ещё “тяжёлый”.

#### 3. API slow queries / hot endpoints

Смотрим:
- latency hot endpoints;
- количество и форму SQL queries;
- тяжёлые `include/select`;
- N+1;
- синхронные recompute/joins на read-path.

Целевые endpoint-контуры:
- student dashboard / student unit read-paths
- teacher dashboard / course / section / graph
- teacher unit editor
- teacher students/profile/review связки, если profiling покажет их hot-path

Классификация bottleneck:
- `backend-bound` — основной тормоз в handler/service/DB;
- `mixed` — backend latency сочетается с тяжёлым frontend render.

### Порядок выполнения optimization wave

1. Выбрать user flow.
2. Снять baseline:
   - network profile;
   - React render profile;
   - API/DB slow-path метрики.
3. Зафиксировать bottleneck class:
   - `network-bound`
   - `render-bound`
   - `backend-bound`
   - `mixed`
4. Выполнить targeted optimization только под подтверждённую причину.
5. Повторить те же замеры.
6. Зафиксировать результат и только потом переходить к следующему flow.

### Возможные типы оптимизаций

- query/cache/invalidation tuning;
- устранение лишних refetch;
- распараллеливание read-path;
- payload reduction;
- render split / memoization / derived-state cleanup;
- SQL/select/include optimization;
- устранение N+1 и тяжёлых recompute на hot-path.

### Что запрещено

- оптимизация “на глаз” без baseline;
- массовая micro-optimization всего подряд;
- смешивание profiling и крупного архитектурного refactor в одном шаге;
- принятие одного случайного запуска за репрезентативную метрику.

## Критерии завершения

- Остаточный manual boundary parsing в target API ветках убран.
- Остаточный manual server-state в target frontend ветках переведён на query/mutation model или явно обоснован как exception.
- `students.service.ts` и `content-write.service.ts` декомпозированы до более узких responsibility units.
- При необходимости второй приоритет больших web-модулей либо закрыт, либо явно вынесен в отдельный следующий plan.
- Проверки проходят без регрессий.
- Performance wave, если до неё дошли, завершена только после цикла `baseline -> fix -> re-measurement`.
