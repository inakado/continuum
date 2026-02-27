# 2026-02-26 — Architecture principles refactor foundation

Статус: `Active`

## Цель

Подготовить безопасную основу для постепенного рефакторинга API/Web, чтобы улучшить читаемость, поддерживаемость и предсказуемость изменений без изменения доменных инвариантов.

## Контекст

По текущему baseline:
- есть крупные сервисы и экраны (`content.service`, `learning.service`, `TeacherUnitDetailScreen`, `StudentUnitDetailScreen`);
- есть дубли cross-cutting паттернов (guards/audit/client request race handling);
- контрактная/validation логика частично размазана по контроллерам и сервисам.

Это повышает стоимость изменений и риск регрессий.

## Scope

### In scope

- Внедрение safety rails (тесты, lint, dependency-boundary checks).
- Переход к schema-first boundary validation.
- Декомпозиция крупнейших API/Web модулей.
- Унификация error-handling и контрактов.
- Фиксация quality-бюджетов и критериев завершения.

### Out of scope

- Изменение доменных инвариантов Learning/Content.
- Массовый редизайн UI.
- Перестройка backend в микросервисы.

## Правила безопасного выполнения (anti-regression)

### 1) Общая стратегия

- Двигаться малыми шагами: один PR/задача = одна ось изменений (контракты, декомпозиция, state management и т.д.).
- Не смешивать feature-разработку и крупный рефакторинг в одном изменении.
- Для legacy-модулей применять ratchet-подход: не ухудшать и улучшать инкрементально.
- После завершения каждой фазы синхронизировать документацию (SoR + execution plan + индекс при необходимости).

### 2) Инварианты и совместимость

- Не менять доменные инварианты без отдельного явного решения и обновления SoR.
- Сохранять backward compatibility API-контрактов на каждом шаге миграции.
- Для рискованных изменений использовать переходный слой (адаптер/фасад), затем удалять legacy-путь отдельным шагом.

### 3) Гейты перед merge

- Для каждого шага рефакторинга обязателен минимум проверок по затронутой зоне:
  - typecheck,
  - целевые unit/integration/smoke проверки,
  - ручной smoke ключевого пользовательского сценария (teacher/student flow по области изменений).
- Любая правка “горячих” модулей (`content`, `learning`, `teacher unit`, `student unit`) без проверок считается незавершённой.

### 4) Правила работы агента

- Перед началом шага зафиксировать ожидаемое поведение (что не должно измениться).
- После шага явно сверить фактическое поведение с ожиданием.
- Если в процессе найдена неоднозначность в текущем поведении, агент останавливает рефакторинг и выносит вопрос на решение, а не “додумывает” поведение.
- Если изменение нельзя безопасно завершить в текущем шаге, агент оставляет систему в рабочем состоянии (через feature flag/временный адаптер), а остаток фиксирует отдельной задачей.

### 5) Stop conditions

- Рост регрессий/ошибок после шага.
- Нарушение инвариантов домена или контрактов API.
- Отсутствие достаточного покрытия для проверки риска.

При stop-condition: откатить конкретный шаг, зафиксировать причину в плане, выполнить меньший безопасный инкремент.

## Матрица внедрения библиотек по фазам

### Phase 0 (Safety rails)

- `eslint` + `@typescript-eslint` + `eslint-plugin-boundaries`:
  - где добавляем: корень monorepo (общий конфиг), применение к `apps/api`, `apps/web`, `packages/shared`;
  - зачем в этой фазе: ранние guardrails до активного рефакторинга.

### Phase 1 (Контракты и boundary validation)

- `zod`:
  - где добавляем: `packages/shared` (базовые schema/contracts), затем использование в `apps/api` и `apps/web`;
  - зачем в этой фазе: единый источник контрактов и runtime-валидации.
- custom `ZodValidationPipe` bridge:
  - где добавляем: `apps/api`;
  - зачем в этой фазе: встроить schema validation в HTTP boundary NestJS без изменения legacy error-handling.

### Phase 2 (Backend декомпозиция)

- `supertest`:
  - где добавляем: `apps/api`;
  - зачем в этой фазе: страховать рефакторинг сервисов интеграционными API-проверками.

### Phase 3 (Frontend декомпозиция)

- `@tanstack/react-query`:
  - где добавляем: `apps/web`;
  - зачем в этой фазе: заменить разрозненный ручной server-state management.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`:
  - где добавляем: `apps/web` (при необходимости частично в `packages/shared`);
  - зачем в этой фазе: безопасно резать крупные экраны и hooks.

### Phase 4 (Stabilization и DX)

- `dependency-cruiser` (опционально, если нужен более глубокий контроль графа зависимостей):
  - где добавляем: уровень monorepo;
  - зачем в этой фазе: усилить контроль архитектурных границ после стабилизации базового контура.

## Чеклист изменений `package.json` по фазам

### Общие правила

- Менять только те `package.json`, которые нужны для текущей фазы.
- Не смешивать dependency-изменения разных фаз в одном PR.
- После каждого изменения фиксировать lockfile и прогонять минимальный набор проверок фазы.

### Phase 0 (Safety rails)

- Корневой `package.json`:
  - добавить devDependencies: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-boundaries`.
  - добавить scripts: `lint`, `lint:boundaries` (или эквивалентный набор, согласованный в задаче).
- `apps/api/package.json`: без новых библиотек (только если нужен локальный lint script).
- `apps/web/package.json`: без новых библиотек (только если нужен локальный lint script).
- `packages/shared/package.json`: без новых библиотек.

### Phase 1 (Контракты и boundary validation)

- `packages/shared/package.json`:
  - добавить dependency: `zod`.
- `apps/api/package.json`:
  - добавить dependency: `zod` (bridge-слой реализован custom `ZodValidationPipe`, без `nestjs-zod` в wave1).
- `apps/web/package.json`:
  - добавить dependency: `zod` (для runtime parsing/форм).
- Корневой `package.json`: без обязательных новых зависимостей на этом шаге.

### Phase 2 (Backend декомпозиция)

- `apps/api/package.json`:
  - добавить devDependency: `supertest` (и typings при необходимости).
- Остальные `package.json`: без изменений.

### Phase 3 (Frontend декомпозиция)

- `apps/web/package.json`:
  - добавить dependency: `@tanstack/react-query`.
  - добавить devDependencies: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- `packages/shared/package.json`:
  - опционально добавить `vitest`, если тесты shared запускаются локально в пакете.
- Корневой `package.json`:
  - опционально добавить агрегирующие scripts для test/typecheck web.

### Phase 4 (Stabilization и DX)

- Корневой `package.json` (опционально):
  - добавить devDependency: `dependency-cruiser`.
  - добавить script: `deps:check` (или эквивалент).
- `apps/*` и `packages/*`: без обязательных dependency-изменений.

## План выполнения

### Phase 0 — Safety rails

- Ввести минимальный тестовый контур для API и критичных UI-экранов.
- Подключить lint и dependency-boundary проверки в CI.
- Обновить документацию по принятым проверкам и правилам выполнения фазы.
- Exit criteria:
  - критичные happy-path покрыты smoke/integration тестами;
  - архитектурные нарушения ловятся автоматически.

### Phase 0 — Прогресс выполнения (2026-02-27)

- Статус фазы: `Completed` (exit criteria для safety rails закрыты).

- `Implemented`:
  - в root добавлены devDependencies: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-boundaries`;
  - добавлен корневой flat config `eslint.config.mjs` для `apps/*` и `packages/*`;
  - добавлены package-level `lint` scripts (`apps/api`, `apps/web`, `apps/worker`, `packages/shared`);
  - добавлен root script `lint:boundaries`;
  - в CI (`.github/workflows/ci.yml`) добавлены обязательные шаги `Lint` и `Dependency boundaries`;
  - добавлен минимальный test-baseline:
    - `apps/api` — `vitest` тесты для `HealthController`/`ReadyController` (`/health` и ветки `/ready`);
    - `apps/web` — `vitest` + Testing Library тесты login flow (`teacher/student redirect`, `401` error-path);
    - `apps/worker` — `vitest` тесты конфигурации object storage (`resolveWorkerObjectStorageConfig`);
    - `packages/shared` — `vitest` тесты storage-core утилит (`parseBool`, `parsePositiveInt`, URL normalization/rewrites, env resolve);
  - package `test` scripts в `apps/api`, `apps/web`, `apps/worker`, `packages/shared` переключены с placeholder на реальный test-runner;
  - обновлены SoR/операционные документы (`ARCHITECTURE-PRINCIPLES.md`, `DEVELOPMENT.md`) под фактический контур.
- `Planned`:
  - расширить baseline-покрытие на “горячие” модули (`content`, `learning`, `teacher unit`, `student unit`);
  - расширить baseline-покрытие на worker/shared edge-cases (ошибки env/infra).
- Проверка факта:
  - `pnpm lint` — `0 errors` (есть warnings);
  - `pnpm lint:boundaries` — успешно (`0 errors`), boundary-правила исполняются в общем lint-контуре.
  - `pnpm --filter @continuum/api test` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm --filter @continuum/worker test` — `pass`;
  - `pnpm --filter @continuum/shared test` — `pass`;
  - `pnpm test` — `pass`.

### Phase 0 — Грабли и решения (2026-02-27)

- Где упало:
  - `pnpm add -Dw eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-boundaries` (sandbox).
- Что увидели:
  - `ERR_PNPM_META_FETCH_FAIL ... ENOTFOUND registry.npmjs.org`;
  - `ERR_PNPM_UNEXPECTED_STORE`.
- Почему:
  - sandbox без стабильного egress до npm registry;
  - конфликт store-dir с существующим `node_modules` (`/Users/<user>/Library/pnpm/store/v10` vs локальный `.pnpm-store/v10`).
- Как чинить:
  - выполнить установку вне sandbox/через escalated shell;
  - запускать команды установки с согласованным store-dir:
    - `PNPM_STORE_DIR=/Users/<user>/Library/pnpm/store/v10 pnpm add -Dw <deps>`.
- Как проверить:
  - `pnpm lint`;
  - `pnpm lint:boundaries`.

- Где упало:
  - `pnpm --filter @continuum/api test` (первая версия HTTP-style теста).
- Что увидели:
  - `listen EPERM: operation not permitted 0.0.0.0`.
- Почему:
  - sandbox запрещает bind/listen для тестового HTTP server.
- Как чинить:
  - в sandbox использовать controller/service-level тесты без открытия socket;
  - socket-based integration выполнять вне sandbox.
- Как проверить:
  - `pnpm --filter @continuum/api test` проходит без `listen EPERM`.

### Phase 1 — Контракты и boundary validation

- Внедрить schema-first слой (`zod`) для ключевых DTO и API-ответов.
- Централизовать parse/validate внешних входов (убрать ручной parse `unknown` с критичных путей).
- Обновить документацию по контрактам и validation flow после внедрения.
- Exit criteria:
  - ключевые endpoint-ы проходят через единый validation boundary;
  - типы API/Web выводятся из одного источника.

### Phase 1 Wave 1 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.
- Статус фазы: `Completed` (в согласованном scope Phase 1 = wave1 Learning/Photo, без глобального ValidationPipe и без массовой миграции всех endpoint-ов).

- `Implemented`:
  - в `packages/shared` добавлен contract layer `src/contracts/learning-photo.ts` (request/response schemas + `z.infer` aliases) и unit-тесты `test/learning-photo-contracts.test.ts`;
  - в `apps/api` добавлен custom bridge:
    - `src/common/pipes/zod-validation.pipe.ts`,
    - `src/common/validation/zod-exception-factories.ts`;
  - boundary validation перенесён на wave1 endpoint-ы:
    - `POST /student/tasks/:taskId/attempts`,
    - `POST /student/tasks/:taskId/photo/presign-upload`,
    - `POST /student/tasks/:taskId/photo/submit`,
    - `GET /student/tasks/:taskId/photo/presign-view`,
    - `GET /teacher/photo-submissions`,
    - `GET /teacher/photo-submissions/:submissionId`,
    - `GET /teacher/students/:studentId/tasks/:taskId/photo-submissions/presign-view`,
    - `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/accept`,
    - `POST /teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/reject`,
    - `GET /teacher/students/:studentId/photo-submissions`;
  - в `apps/api/src/learning/learning.service.ts` attempt parsing переведён на shared schemas (через `attempt-validation.ts`) с сохранением кодов:
    - `INVALID_NUMERIC_ANSWERS`,
    - `INVALID_CHOICE_KEY`,
    - `INVALID_CHOICE_KEYS`;
  - в `apps/api/src/learning/photo-task.service.ts` убран ручной `asRecord`/`parse*` для wave1 request/query, сохранены legacy `error.code` и legacy `409` для review/photo query/body-веток;
  - в `apps/web/lib/api/client.ts` добавлен runtime parsing helper `apiRequestParsed` (ошибка `ApiError.code = API_RESPONSE_INVALID`);
  - в `apps/web/lib/api/student.ts` и `apps/web/lib/api/teacher.ts` wave1 методы переведены на shared response schemas и shared type aliases;
  - добавлены API/Web тесты wave1:
    - API: `zod-validation.pipe`, exception mapping, learning attempt parsing helpers;
    - Web: runtime parsing success/failure (`API_RESPONSE_INVALID`).

- `Implemented` (проверка):
  - `pnpm --filter @continuum/shared test` — `pass`;
  - `pnpm --filter @continuum/api test` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass` (по текущему корневому скрипту для `@continuum/shared` и `web`).

- `Deferred` (вынесено за рамки закрытой Phase 1):
  - расширение contract-first подхода за пределы Learning/Photo;
  - решение стратегии глобального validation pipeline в API;
  - возможный переход с custom bridge на `nestjs-zod`, если это даст выигрыш без регрессий совместимости.

### Phase 2 — Backend декомпозиция

- Разделить самые крупные сервисы на read/write + policy + mapper слои.
- Свернуть дублирующееся audit/guard поведение в композиционные примитивы.
- Обновить документацию по новым границам модулей и слоям.
- Exit criteria:
  - `content.service.ts` и `learning.service.ts` декомпозированы на smaller units;
  - число cross-cutting дублирований заметно снижено.

### Phase 2 — Анализ и план запуска (2026-02-27)

- Статус фазы: `Completed` (Wave 1-5 выполнены в целевом scope Phase 2).

- `Implemented` (анализ текущего baseline):
  - главные точки риска по размеру/связности:
    - `apps/api/src/content/content.service.ts` — `1594` строк;
    - `apps/api/src/learning/learning.service.ts` — `1333` строки;
    - `apps/api/src/learning/photo-task.service.ts` — `1178` строк;
  - в этих трёх сервисах зафиксировано `14` точек транзакций (`$transaction`);
  - в API-коде зафиксировано `45` вызовов `eventsLogService.append(...)` (cross-cutting дублирование);
  - guard/ownership проверки дублируются между модулями (`LearningService.assertTeacherOwnsStudent` и `StudentsService.assertTeacherOwnsStudent`).

- Зафиксированные решения для Phase 2 (без вариантов):
  - рефакторинг делаем инкрементально по волнам, с сохранением текущих HTTP контрактов и `error.code`;
  - перед декомпозицией write-path добавляем integration safety-net через `supertest` в `apps/api`;
  - `supertest`-тесты запускаются в Docker-контуре (в sandbox остаются controller/service тесты без открытия сокета);
  - на переходном этапе сохраняем фасады `ContentService`, `LearningService`, `PhotoTaskService` для обратной совместимости контроллеров.

- План реализации Phase 2 (waves):
  - Wave 1 — API integration safety-net (`supertest`):
    - добавить `supertest` (+ typings) в `apps/api`;
    - подготовить integration harness (`apps/api/test/integration/*`) для критичных сценариев:
      - attempts (`numeric/single/multi` + негативные `error.code`);
      - photo submit/review (`submit`, `accept`, `reject`, inbox/detail);
      - content publish/graph update (минимальный smoke read/write);
    - добавить scripts: `test:integration` (docker-only) и обновить `DEVELOPMENT.md`.
  - Wave 2 — Декомпозиция `learning.service.ts`:
    - выделить `learning-attempts-write.service.ts` (submit/evaluate/3+3/events);
    - выделить `learning-teacher-actions.service.ts` (override/credit/unblock/notifications);
    - оставить в `LearningService` только orchestration facade + thin delegation.
  - Wave 3 — Декомпозиция `photo-task.service.ts`:
    - выделить `photo-task-read.service.ts` (queue/inbox/detail/presign-view/list);
    - выделить `photo-task-review-write.service.ts` (submit/accept/reject + state transitions/events);
    - сохранить policy в `PhotoTaskPolicyService`, не дублировать validation из boundary.
  - Wave 4 — Декомпозиция `content.service.ts`:
    - выделить `content-graph.service.ts` (build/update/cycle checks/layout);
    - выделить `task-revision-payload.service.ts` (normalize/sanitize/validate task payload/revision);
    - выделить write-path сервисы для course/section/unit/task mutation, сохранив текущие контроллерные контракты.
  - Wave 5 — Cross-cutting cleanup:
    - унифицировать teacher-student ownership check через `StudentsService`;
    - вынести повторяющиеся audit append-паттерны в композиционный helper/facade;
    - обновить SoR-документацию по новым backend boundaries.

### Phase 2 Wave 1 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - в `apps/api` добавлены devDependencies:
    - `supertest`,
    - `@types/supertest`,
    - `@nestjs/testing` (test harness для Nest integration);
  - integration-test контур выделен в отдельный конфиг:
    - `apps/api/vitest.integration.config.ts`;
    - `apps/api/vitest.config.ts` исключает `test/integration/**/*.test.ts` из baseline unit-прогона;
  - добавлен docker-only script:
    - `apps/api/package.json` → `test:integration` (`ensure-docker-build` + `vitest.integration.config.ts`);
  - добавлен общий integration factory:
    - `apps/api/test/integration/test-app.factory.ts` (guard override + constructor metadata для Nest DI в vitest);
  - добавлены integration smoke tests:
    - `apps/api/test/integration/student-attempts.integration.test.ts`;
    - `apps/api/test/integration/learning-photo-boundary.integration.test.ts`;
    - `apps/api/test/integration/content-publish-graph.integration.test.ts`.

- `Implemented` (проверка):
  - `pnpm --filter @continuum/api test` — `pass`;
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"` — `pass`;
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api typecheck"` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Следующий шаг:
  - перейти к Phase 3 (frontend декомпозиция: server-state слой и резка крупных экранов на hooks/subcomponents).

### Phase 2 Wave 2 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - добавлен `apps/api/src/learning/learning-attempts-write.service.ts`:
    - write-path `submitAttempt`,
    - evaluate/3+3 transitions,
    - recompute + notifications + events;
  - добавлен `apps/api/src/learning/learning-teacher-actions.service.ts`:
    - `overrideOpenUnit`, `creditTask`, `unblockTask`, `listNotifications`;
  - `apps/api/src/learning/learning.service.ts` переведён в фасадный orchestration слой с thin delegation;
  - ownership-check в teacher-flow унифицирован через `StudentsService.assertTeacherOwnsStudent`.

### Phase 2 Wave 3 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `apps/api/src/learning/photo-task.service.ts` переведён в фасад (`1178 -> 88` строк);
  - выделены сервисы:
    - `apps/api/src/learning/photo-task-read.service.ts` (inbox/queue/detail/list/presign-view),
    - `apps/api/src/learning/photo-task-review-write.service.ts` (presign-upload/submit/accept/reject);
  - `PhotoTaskPolicyService` сохранён как policy-layer; boundary validation не дублируется внутри бизнес-сервисов.

### Phase 2 Wave 4 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `apps/api/src/content/content-graph.service.ts`:
    - build/read/update graph,
    - cycle/self-loop/duplicate-edge guards,
    - layout fallback;
  - `apps/api/src/content/task-revision-payload.service.ts`:
    - normalize/sanitize/validate task payload,
    - revision create + revision no management,
    - mapper `mapTaskWithRevision`;
  - `apps/api/src/content/content-write.service.ts`:
    - вынесены course/section/unit/task mutation write-path,
    - вынесены task-revision write operations (solution latex/pdf key, statement image key),
    - сохранены текущие коды ошибок и response-shape;
  - `apps/api/src/content/content.service.ts` переведён на delegation в graph/payload/write сервисы (`1594 -> 384` строки), публичный фасад сохранён для совместимости.

- Грабли/решение:
  - где упало: `docker compose exec -T api sh -lc "pnpm --filter @continuum/api typecheck"`;
  - что увидели: `Property 'mapTaskWithRevision' does not exist on type 'ContentService'`;
  - почему: после выноса mapper в `task-revision-payload.service.ts` была удалена публичная фасадная точка, на которую опирается `learning.service.ts`;
  - как чинить: вернуть в `ContentService` thin method `mapTaskWithRevision(...)`, делегирующий в payload-service;
  - как проверить: повторный docker typecheck + integration tests проходят.

### Phase 2 Wave 5 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed` (scope Phase 2).

- `Implemented`:
  - добавлен `apps/api/src/learning/learning-audit-log.service.ts` (62 строки) как композиционный helper для audit append patterns (student-learning, student-system, teacher-admin);
  - `LearningAttemptsWriteService`, `LearningTeacherActionsService`, `PhotoTaskReviewWriteService` переведены на helper вместо прямого дублирования `eventsLogService.append(...)`;
  - teacher-student ownership в learning/photo ветке централизован через `StudentsService`.

- `Deferred`:
  - расширить helper-подход на content/students контроллеры и остальные модули API (вне scope Phase 2).

- `Implemented` (проверка после waves 2-5):
  - `pnpm --filter @continuum/api test` — `pass`;
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api typecheck"` — `pass`;
  - `docker compose exec -T api sh -lc "pnpm --filter @continuum/api test:integration"` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass` (root scope: `@continuum/shared` + `web`).

- Definition of Done для старта реализации Phase 2:
  - утверждён wave-order и scope первого PR (Wave 1: safety-net);
  - зафиксированы target-файлы декомпозиции для Wave 2/3/4;
  - подтверждён минимальный обязательный прогон:
    - `pnpm --filter @continuum/api test`;
    - `pnpm --filter @continuum/api typecheck` (в Docker);
    - `pnpm --filter @continuum/api test:integration` (в Docker);
    - `pnpm lint`;
    - `pnpm lint:boundaries`.

### Phase 3 — Frontend декомпозиция

- Мигрировать сетевой слой на единый server-state подход (`@tanstack/react-query` или эквивалент, утверждённый в задаче).
- Вынести эффекты и orchestration из экранов-комбайнов в hooks.
- Обновить frontend-документацию по структуре, server-state и правилам экранов.
- Exit criteria:
  - ручной `requestIdRef` anti-race паттерн минимизирован/устранён;
  - `TeacherUnitDetailScreen` и `StudentUnitDetailScreen` разделены на feature-subcomponents + hooks.

### Phase 4 — Stabilization и DX

- Унифицировать Error Catalog и UI-обработку ошибок.
- Закрепить quality-бюджеты в CI-правилах.
- Обновить SoR-документы и закрыть/перевести execution plan по факту завершения.
- Exit criteria:
  - архитектурные принципы enforced линтами/тестами/границами зависимостей, а не только договорённостями.

## Decision log

- Порядок “сначала safety rails, потом рефакторинг” выбран для снижения регрессионного риска.
- Порядок “контракты → backend → frontend” выбран, потому что стабильные API-контракты упрощают UI-декомпозицию.
- План зафиксирован как execution plan, а не в SoR, чтобы не смешивать устойчивую архитектуру с временным roadmap.

## Риски

- Риск: параллельные feature-задачи будут конфликтовать с декомпозицией крупных файлов.
  - Митигировать: инкрементальные PR и feature flags/branch discipline по зонам.
- Риск: рост времени CI после добавления новых проверок.
  - Митигировать: staged rollout проверок и кэширование.
- Риск: неполное покрытие тестами перед началом активного рефакторинга.
  - Митигировать: фокус на критичных сценариях и границах API.

## Откат

- Для каждой фазы возможен локальный откат в пределах соответствующих модулей.
- Новые проверки включать поэтапно, чтобы откатить отдельный check без отката функциональных изменений.

## Критерии завершения

- Критичные модульные “узкие места” декомпозированы.
- Контракты и validation централизованы.
- Cross-cutting дубли существенно сокращены.
- Quality-бюджеты автоматизированы в CI и отражены в SoR.
