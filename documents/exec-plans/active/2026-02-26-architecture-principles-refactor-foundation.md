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

### Phase 4 (Stabilization core: non-learning migration + error consistency)

- Новых библиотек не требуется:
  - используем уже внедрённые `@tanstack/react-query` и `zod` для расширения migration вне Learning/Photo.
- Опционально:
  - `dependency-cruiser` для более глубокого контроля графа зависимостей после стабилизации migration.

### Phase 5 (Coverage + CI docs checks + DX guardrails)

- Опционально:
  - `dependency-cruiser` (если не подключался в Phase 4) для усиления архитектурного контроля;
  - дополнительные devtools для docs-checks (только если встроенных скриптов недостаточно).
- Основной фокус:
  - расширение test coverage и автоматизация проверок документации в CI.

### Phase 6 (Final lint hardening)

- Новых библиотек не требуется.
- Фаза запускается только после обнуления текущих предупреждений `pnpm lint`.
- В этой фазе ужесточаются правила lint и включается fail-on-warnings в CI.

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

### Phase 4 (Stabilization core)

- `apps/*` и `packages/*`:
  - без обязательных dependency-изменений;
  - допускаются точечные scripts для migration/smoke по non-learning срезам.
- Корневой `package.json`:
  - без обязательных изменений (до решения по docs checks/dependency graph).

### Phase 5 (Coverage + CI docs checks)

- Корневой `package.json`:
  - опционально добавить devDependency: `dependency-cruiser`;
  - опционально добавить scripts:
    - `deps:check`,
    - `docs:check` (валидность ссылок, anti-orphans, маркеры `Implemented/Planned`).
- `apps/*` и `packages/*`:
  - опционально добавить узконаправленные test scripts для новых test suites.

### Phase 6 (Final lint hardening)

- Корневой `package.json`:
  - добавить строгий lint script (`lint:strict`) с `--max-warnings=0` (или эквивалент).
- `apps/*` и `packages/*`:
  - без новых dependency;
  - при необходимости локальные strict scripts для проблемных пакетов.

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

- Статус фазы: `Completed` (Waves 1-6 выполнены).

- `Implemented` (Phase 3 baseline, 2026-02-27):
  - до старта wave1 `@tanstack/react-query` не был подключён в `apps/web/package.json`;
  - в `apps/web` всего 2 теста (`UnifiedLoginScreen.test.tsx`, `wave1-runtime-parsing.test.ts`);
  - ключевые точки связности/размера:
    - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx` — `2140` строк, `35` API-вызовов;
    - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` — `1327` строк;
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx` — `929` строк;
    - `apps/web/lib/api/teacher.ts` — `914` строк;
  - повторяющийся anti-race паттерн во frontend — ручные `cancelled/disposed` флаги и cleanup в `useEffect` (например `TeacherUnitDetailScreen`, `StudentUnitDetailScreen`, `StudentDashboardScreen`, review panels).

- Зафиксированные решения для Phase 3 (без вариантов):
  - migration path: сначала инфраструктура server-state, потом перенос Learning/Photo экранов, затем декомпозиция больших экранов;
  - Phase 1 compatibility сохраняется: текущие `error.code` и UI-семантика ошибок не меняются;
  - приоритет первой волны migration: Learning/Photo e2e-срез (Student Unit + Teacher Review), чтобы идти поверх уже schema-first boundary;
  - `apps/web/lib/api/client.ts` (cookie refresh и `ApiError`) остаётся единым transport-слоем; `react-query` работает поверх существующих API-методов.

- План реализации Phase 3 (waves):
  - Wave 1 — Server-state foundation:
    - добавить `@tanstack/react-query` в `apps/web`;
    - создать `apps/web/lib/query/query-client.ts` и `apps/web/lib/query/query-provider.tsx`;
    - подключить provider в `apps/web/app/layout.tsx` через client-wrapper;
    - добавить query key factory для Learning/Photo (`apps/web/lib/query/keys.ts`).
  - Wave 2 — Learning/Photo read migration:
    - мигрировать read-path в `TeacherReviewInboxPanel` и `TeacherReviewSubmissionDetailPanel` на `useQuery`;
    - мигрировать `StudentUnitDetailScreen` read-path (`getUnit`, presigned preview read-ветки) на `useQuery`;
    - убрать локальные `cancelled/disposed` ветки там, где их заменяет query lifecycle.
  - Wave 3 — Learning/Photo write migration:
    - `submitAttempt`, `submitPhoto`, `accept/reject` перевести на `useMutation`;
    - добавить целевые invalidation/update правила query cache (unit/review inbox/submission detail);
    - сохранить текущие optimistic/non-optimistic UX и тексты ошибок.
  - Wave 4 — Student Unit screen decomposition:
    - выделить hooks: attempt orchestration, photo upload/submit, pdf/image preview;
    - выделить subcomponents: task card/task answer forms/media preview blocks;
    - оставить `StudentUnitDetailScreen` как composition shell.
  - Wave 5 — Teacher Unit screen decomposition:
    - выделить hooks: unit fetch/save, latex compile/apply polling, task statement image workflow;
    - выделить subcomponents: task list/editor panels, compile panels, media/upload blocks;
    - минимизировать прямые API-вызовы в screen-root.
  - Wave 6 — API client surface cleanup (within web scope):
    - для migration-среза убрать дубли типов в `student.ts`/`teacher.ts`, оставить aliases/shared contracts там, где уже есть схемы;
    - подготовить безопасный шаблон для дальнейшей миграции non-learning экранов в Phase 4.

- Проверки для каждой wave (минимум):
  - `pnpm --filter web test`;
  - `pnpm --filter web typecheck`;
  - `pnpm lint`;
  - `pnpm lint:boundaries`.

### Phase 3 Wave 1 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - установлен `@tanstack/react-query` в `apps/web`;
  - добавлены файлы:
    - `apps/web/lib/query/query-client.ts`,
    - `apps/web/lib/query/query-provider.tsx`,
    - `apps/web/lib/query/keys.ts`;
  - `QueryProvider` подключён в `apps/web/app/layout.tsx` (обёртка над всем app tree);
  - создан дефолтный `QueryClient` policy:
    - `staleTime=30s`, `gcTime=5m`, `refetchOnWindowFocus=false`,
    - retry для queries отключён на `ApiError` 4xx, ограничен для остальных ошибок,
    - retry для mutations отключён.

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Next:
  - Wave 2 — миграция Learning/Photo read-path (`TeacherReviewInboxPanel`, `TeacherReviewSubmissionDetailPanel`, `StudentUnitDetailScreen`) на `useQuery`.

### Phase 3 Wave 2 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `TeacherReviewInboxPanel` переведён с ручного `useEffect`/локального `items|total|loading|error` стейта на `useQuery`;
  - `TeacherReviewSubmissionDetailPanel` переведён на `useQuery` для detail-загрузки и `useQueries` для asset preview presign read-path;
  - `StudentUnitDetailScreen` переведён на `useQuery` для `getUnit` и unit PDF preview (`theory/method`);
  - ручные `cancelled` ветки для review inbox/detail initial read-flow удалены.

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Next:
  - Wave 3 — миграция Learning/Photo write-path (`submitAttempt`, `submitPhoto`, `accept/reject`) на `useMutation` + query invalidation.

### Phase 3 Wave 3 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `StudentUnitDetailScreen`:
    - `submitAttempt` переведён на `useMutation`;
    - `submitPhoto` (presign-upload + PUT + submit) переведён на `useMutation`;
    - после успешных write-операций добавлен `queryClient.invalidateQueries` для `learningPhotoQueryKeys.studentUnit(unitId)`.
  - `TeacherReviewSubmissionDetailPanel`:
    - `accept/reject` переведены на `useMutation`;
    - после review action добавлен `queryClient.invalidateQueries` по префиксу `["learning-photo","teacher","review"]` (inbox/detail/preview cache ветка).
  - legacy UI semantics сохранены:
    - текущие user-facing тексты ошибок и статусные сообщения не менялись;
    - flow переходов `next submission / back to inbox` сохранён.

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Next:
  - Wave 4 — декомпозиция `StudentUnitDetailScreen` на hooks/subcomponents (`Completed`).

### Phase 3 Wave 4 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `StudentUnitDetailScreen` декомпозирован до composition-shell (`1327 -> 508` строк);
  - выделены hooks:
    - `apps/web/features/student-content/units/hooks/use-student-task-attempt.ts`,
    - `apps/web/features/student-content/units/hooks/use-student-photo-submit.ts`,
    - `apps/web/features/student-content/units/hooks/use-student-unit-pdf-preview.ts`,
    - `apps/web/features/student-content/units/hooks/use-student-task-media-preview.ts`,
    - `apps/web/features/student-content/units/hooks/use-student-task-navigation.ts`;
  - выделены subcomponents:
    - `apps/web/features/student-content/units/components/StudentTaskCardShell.tsx`,
    - `apps/web/features/student-content/units/components/StudentTaskAnswerForm.tsx`,
    - `apps/web/features/student-content/units/components/StudentTaskMediaPreview.tsx`,
    - `apps/web/features/student-content/units/components/StudentTaskTabs.tsx`,
    - `apps/web/features/student-content/units/components/StudentUnitPdfPanel.tsx`;
  - API-поведение и user-facing семантика для Learning/Photo среза сохранены (submitAttempt/submitPhoto, блокировки, solution/media preview, тексты ошибок).

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Next:
  - Wave 5 — декомпозиция `TeacherUnitDetailScreen` на hooks/subcomponents (`Completed`).

### Phase 3 Wave 5 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - `TeacherUnitDetailScreen` декомпозирован в composition-shell (`2140 -> 815` строк);
  - выделены hooks:
    - `apps/web/features/teacher-content/units/hooks/use-teacher-unit-fetch-save.ts`,
    - `apps/web/features/teacher-content/units/hooks/use-teacher-unit-latex-compile.ts`,
    - `apps/web/features/teacher-content/units/hooks/use-teacher-task-statement-image.ts`;
  - выделены subcomponents:
    - `apps/web/features/teacher-content/units/components/TeacherUnitLatexPanel.tsx`,
    - `apps/web/features/teacher-content/units/components/TeacherUnitTasksPanel.tsx`,
    - `apps/web/features/teacher-content/units/components/TeacherTaskStatementImageSection.tsx`,
    - `apps/web/features/teacher-content/units/components/TeacherTaskSolutionSection.tsx`,
    - `apps/web/features/teacher-content/units/components/TeacherCompileErrorDialog.tsx`;
  - в screen-root существенно сокращены прямые orchestration-цепочки: unit fetch/save, latex compile/apply polling, task statement image workflow обслуживаются через выделенные hooks.

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`.

- Next:
  - Wave 6 — API client surface cleanup (within web scope).

### Phase 3 Wave 6 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - выполнен API client surface cleanup в `apps/web/lib/api/student.ts` и `apps/web/lib/api/teacher.ts` для migration-среза Learning/Photo;
  - локальные дубли типов request/query для wave1 endpoint-ов заменены на shared aliases из `@continuum/shared`;
  - в `teacher.ts` убраны дублирующие query-param сборки для review endpoints (вынесен общий helper), и сокращены дубли endpoint wrappers (`credit`, `latex job`, `task solution presign`) без изменения URL/payload shape;
  - в `student.ts` сигнатуры photo-wave1 методов синхронизированы с shared request contracts (`presign upload`, `submit`, `presign view`).

- `Implemented` (проверка):
  - `pnpm --filter @continuum/shared test` — `pass`;
  - `pnpm --filter @continuum/api test` — `pass`;
  - `pnpm --filter @continuum/worker test` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass`;
  - `pnpm smoke` (вне sandbox) — `pass`;
  - расширенный teacher/student cookie-auth smoke для wave1 endpoint-ов — `pass` (ожидаемые error-codes + 200 на inbox/queue/list).

- Next:
  - Phase 4 — stabilization core (non-learning migration + error consistency);
  - далее Phase 5 (coverage + CI docs checks) и финальная Phase 6 (lint hardening после `0 warnings`).

- Definition of Done для Phase 3:
  - серверное состояние Learning/Photo read/write сценариев обслуживается через `react-query`;
  - ручные anti-race флаги (`cancelled/disposed`) в migrated-экранах удалены или сведены к edge-cases, которые не покрываются query lifecycle;
  - `TeacherUnitDetailScreen` и `StudentUnitDetailScreen` декомпозированы на hooks/subcomponents, root-компоненты перестают быть “комбайнами”;
  - обновлены `documents/FRONTEND.md`, `documents/ARCHITECTURE-PRINCIPLES.md` и execution plan по факту внедрения.

### Phase 4 — Stabilization core (non-learning migration + error consistency)

- Статус фазы: `Completed` (Wave 1-3 выполнены).

- Цель:
  - расширить принципы Phase 1-3 на non-learning/non-photo зоны без изменения API семантики.

- План работ:
  - Wave 1 — Non-learning server-state migration:
    - перевести на `react-query` ключевые non-learning экраны:
      - `TeacherDashboardScreen`,
      - `TeacherSectionGraphPanel`,
      - `StudentDashboardScreen`,
      - `TeacherStudentsPanel`,
      - `TeacherStudentProfilePanel`;
    - убрать ручные `cancelled/disposed` anti-race ветки там, где lifecycle покрывается query hooks.
  - Wave 2 — Error catalog consistency:
    - унифицировать mapping `error.code -> user-facing message` для student/teacher UI через единый shared слой;
    - синхронизировать коды API/Web для мигрированного среза, не меняя HTTP shape и совместимость.
  - Wave 3 — Contracts/runtime parsing expansion:
    - расширить runtime parsing response/request на non-learning endpoints, затронутые в Wave 1;
    - обеспечить typed aliases из shared-contracts в web API-клиентах по аналогии с Learning/Photo.

- Exit criteria:
  - перечисленные non-learning экраны переведены на query hooks и не используют legacy race-pattern как основной механизм;
  - Error Catalog для migration-среза централизован и переиспользуется между student/teacher ветками;
  - в затронутых non-learning клиентах нет дублирования локальных transport-типов при наличии shared contracts.

### Phase 4 Wave 1 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - non-learning query key factory добавлен в `apps/web/lib/query/keys.ts` (`contentQueryKeys`);
  - migration на `react-query` выполнен для целевых экранов:
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`,
    - `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`,
    - `apps/web/features/student-dashboard/StudentDashboardScreen.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentsPanel.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`;
  - ручные `requestIdRef`/`cancelled` anti-race ветки удалены из перечисленных экранов;
  - write-actions в teacher students/profile flow оставлены без изменения пользовательской семантики, но refresh переведён на query invalidation (`queryClient.invalidateQueries`).

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass`.

- Next:
  - Wave 2 — Error catalog consistency (унификация mapping `error.code -> user-facing message` в едином shared слое).

### Phase 4 Wave 2 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - добавлен единый web error-catalog helper:
    - `apps/web/lib/api/error-catalog.ts`;
  - student/teacher error helpers переведены на общий слой:
    - `apps/web/features/student-content/shared/student-errors.ts`,
    - `apps/web/features/teacher-content/shared/api-errors.ts`;
  - сохранена текущая UI-совместимость:
    - teacher-flow сохраняет текущий fallback по HTTP status (`401/403`, `409`);
    - student-flow сохраняет текущие доменные user-facing тексты (`INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `TASK_NOT_PHOTO` и т.д.);
  - payload formatter (`code/message`) для teacher ветки теперь также использует единый catalog-resolver.

- `Implemented` (проверка):
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass`.

- Next:
  - Phase 5 — Coverage + CI docs checks + DX guardrails.

### Phase 4 Wave 3 — Прогресс выполнения (2026-02-27)

- Статус волны: `Completed`.

- `Implemented`:
  - в `packages/shared` добавлен и подключён в публичный export non-learning contract slice:
    - `packages/shared/src/contracts/content-non-learning.ts`,
    - `packages/shared/src/index.ts`,
    - `packages/shared/package.json` (`exports` для `./contracts/content-non-learning`);
  - в `apps/web/lib/api/student.ts` non-learning методы migration-среза переведены на runtime parsing через `apiRequestParsed` + shared schemas:
    - `listCourses`, `getCourse`, `getSection`, `getSectionGraph`;
  - в `apps/web/lib/api/teacher.ts` non-learning read/write методы migration-среза переведены на runtime parsing + shared contracts:
    - `list/get/create/update/publish/unpublish/delete` для course/section в edit-flow,
    - `getSectionGraph`/`updateSectionGraph`, `createUnit`,
    - `listStudents`, `listTeachers`, `createStudent`, `resetStudentPassword`, `transferStudent`, `updateStudentProfile`, `deleteStudent`, `getStudentProfile`,
    - `creditTask` helper и `overrideOpenUnit`;
  - для wave3 endpoints в web API client включены shared type aliases (`Course/Section/Graph/StudentSummary/TeacherSummary/...`) вместо локальных transport-дублей.
  - добавлены тесты:
    - `packages/shared/test/content-non-learning-contracts.test.ts`,
    - `apps/web/lib/api/wave3-runtime-parsing.test.ts`.

- `Implemented` (проверка):
  - `pnpm --filter @continuum/shared test` — `pass`;
  - `pnpm --filter @continuum/shared typecheck` — `pass`;
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web test` — `pass`;
  - `pnpm --filter web lint` — `pass` (`0 errors`, warnings допустимы);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass`.

### Phase 5 — Coverage + CI docs checks + DX guardrails

- Статус фазы: `Implemented/Planned` (Wave 1A/1B выполнены, Wave 1C/1D + Wave 2-3 запланированы).

- `Implemented` (анализ baseline, 2026-03-01):
  - `apps/web`:
    - есть runtime parsing tests для wave1/wave3 API-клиентов:
      - `apps/web/lib/api/wave1-runtime-parsing.test.ts`,
      - `apps/web/lib/api/wave3-runtime-parsing.test.ts`;
    - есть только baseline auth UI test:
      - `apps/web/features/auth/UnifiedLoginScreen.test.tsx`;
    - отсутствует coverage для Phase 4 migration-среза:
      - `TeacherDashboardScreen`,
      - `TeacherSectionGraphPanel`,
      - `StudentDashboardScreen`,
      - `TeacherStudentsPanel`,
      - `TeacherStudentProfilePanel`;
    - отсутствуют прямые тесты unified error catalog:
      - `apps/web/lib/api/error-catalog.ts`.
  - `apps/api`:
    - есть integration harness и smoke coverage для:
      - learning/photo boundary,
      - student attempts,
      - content publish/graph;
    - отсутствует integration coverage для non-learning Phase 4 read/write сценариев:
      - teacher courses/sections create-update-publish/delete,
      - teacher students/profile flows,
      - student dashboard read-path (`/courses`, `/courses/:id`, `/sections/:id`, `/sections/:id/graph`) как HTTP boundary slice.
  - `packages/shared`:
    - есть contract tests для `learning-photo` и `content-non-learning`;
    - отсутствуют тесты для `apps/web/lib/api/error-catalog.ts`-уровня и для будущих docs-check helpers.
  - `CI/docs`:
    - `.github/workflows/ci.yml` пока исполняет только `lint`, `lint:boundaries`, build, typecheck, test;
    - автоматических docs-check шагов нет;
    - в репозитории пока нет `docs:check`/`docs:check:links`/`docs:check:index` scripts.

- План работ:
  - Wave 1 — Test coverage expansion:
    - Wave 1A — web migration-slice coverage:
      - добавить unit/component tests для `apps/web/features/student-dashboard/StudentDashboardScreen.tsx`:
        - успешная загрузка курсов;
        - ошибка загрузки курсов;
        - переход `courses -> sections`;
      - добавить unit/component tests для `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`:
        - загрузка teacher courses;
        - создание course/section с invalidation;
        - publish/unpublish/delete happy-path без регрессии UI state;
      - добавить component tests для `apps/web/features/teacher-students/TeacherStudentsPanel.tsx`:
        - загрузка students/teachers;
        - create/reset/transfer/update/delete flows через mocked `teacherApi`;
        - проверка invalidation `contentQueryKeys.teacherStudentsList()`;
      - добавить component tests для `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`:
        - загрузка профиля;
        - `creditTask` и `overrideOpenUnit` с invalidation нужных query keys;
        - переход в review flow через `buildReviewSearch`;
      - не покрывать Phase 5 wave1 real browser/e2e: достаточно vitest + testing-library, без playwright.
    - Wave 1B — web low-level helpers:
      - покрыть тестами `apps/web/lib/api/error-catalog.ts`:
        - `student` audience overrides;
        - `teacher` status-based fallback;
        - payload formatting (`code/message`) для `ApiError` и unknown errors;
      - при необходимости добавить tests для `apps/web/lib/query/keys.ts`, если component tests неявно не фиксируют shape query keys.
    - Wave 1C — api integration expansion:
      - расширить `apps/api/test/integration/` на non-learning boundary сценарии:
        - teacher courses/sections CRUD+publish/unpublish;
        - teacher students list/profile/update/transfer/reset-password/delete;
        - teacher task credit / unit override-open;
        - student courses/course/section/graph read-path;
      - использовать существующий `test-app.factory.ts`, не вводить второй harness;
      - целевой стиль: controller-level HTTP tests через `supertest` + mocked services/events/recompute, без реальной БД.
    - Wave 1D — shared/test harness:
      - при необходимости вынести общие factory helpers для mock payloads migration-среза;
      - не расширять `packages/shared` beyond contracts/helpers scope.
  - Wave 2 — Documentation checks in CI:
    - Wave 2A — local docs-check scripts:
      - добавить scripts:
        - `docs:check`,
        - `docs:check:links`,
        - `docs:check:index`,
        - `docs:check:status` (названия можно скорректировать при реализации, но split обязан сохраниться);
      - реализовать проверки на Node.js scripts в `scripts/` без внешнего network dependency;
      - в scope:
        - валидность относительных markdown links;
        - отсутствие orphan-docs вне `documents/DOCS-INDEX.md` (исключения только для явно разрешённых generated/completed индексов);
        - наличие маркеров `Implemented`/`Planned` в ключевых SoR-доках:
          - `ARCHITECTURE.md`,
          - `ARCHITECTURE-PRINCIPLES.md`,
          - `FRONTEND.md`,
          - `CONTENT.md`,
          - `LEARNING.md`,
          - `SECURITY.md`,
          - `RELIABILITY.md`,
          - `DEVELOPMENT.md`,
          - `DOCS-INDEX.md`.
      - вместе с docs-check выполнить doc-hygiene cleanup:
        - `documents/DEVELOPMENT.md` сократить до runbook/troubleshooting scope;
        - `documents/ARCHITECTURE-PRINCIPLES.md` очистить от phase/wave planning, progress history и migration backlog;
        - синхронизировать назначение документов между `AGENTS.md`, `documents/DOCS-INDEX.md` и самими SoR-доками.
    - Wave 2B — CI integration:
      - добавить docs-check step в `.github/workflows/ci.yml` после install и до build/typecheck;
      - docs-check должен быть обязательным merge-gate наравне с `lint`/`lint:boundaries`.
    - Wave 2C — docs/runbook updates:
      - обновить `documents/DEVELOPMENT.md`:
        - локальные команды запуска docs-checks;
        - troubleshooting для типовых падений (`broken link`, `orphan doc`, `missing status marker`);
      - обновить `documents/DOCS-INDEX.md`, если в процессе появятся новые docs/scripts references;
      - зафиксировать doc-governance:
        - чем отличается SoR от execution plan;
        - куда писать progress/history, а куда нельзя.
  - Wave 3 — Architectural guardrails (optional):
    - decision gate:
      - запускать wave только если после Wave 1-2 остаётся риск drift по импортам/слоям, который не покрывается `eslint-plugin-boundaries`;
      - если текущего boundary-lint достаточно, wave можно закрыть как `Skipped` без внедрения новой зависимости.
    - если wave активируется:
      - подключить `dependency-cruiser`;
      - добавить `deps:check` script;
      - встроить check в CI как non-optional quality gate;
      - зафиксировать ограничения/исключения в docs.

- Exit criteria:
  - web migration-срез имеет целевой safety-net:
    - component/unit coverage для dashboard/students/profile flows;
    - direct tests для `error-catalog.ts`;
  - api non-learning boundary сценарии покрыты `supertest` integration tests без реальной БД;
  - docs checks запускаются локально и в CI как отдельный обязательный шаг;
  - `documents/DEVELOPMENT.md` содержит runbook/troubleshooting для docs-checks;
  - architectural guardrails либо усилены через `dependency-cruiser`, либо явно зафиксировано решение `Skipped` с обоснованием.

### Phase 5 Wave 1 — Прогресс выполнения (2026-03-01)

- Статус волны: `Implemented/Planned` (Wave 1A/1B/1C выполнены, Wave 1D запланирована).

- `Implemented`:
  - в `apps/web/test` добавлен helper:
    - `apps/web/test/render-with-query-client.tsx`;
  - добавлены direct tests для unified error catalog:
    - `apps/web/lib/api/error-catalog.test.ts`;
  - добавлены component/unit tests для Phase 4 migration-среза:
    - `apps/web/features/student-dashboard/StudentDashboardScreen.test.tsx`,
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.test.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentsPanel.test.tsx`,
    - `apps/web/features/teacher-students/TeacherStudentProfilePanel.test.tsx`;
  - покрытые сценарии:
    - student dashboard: успешная загрузка курсов, ошибка loading, переход `courses -> sections`;
    - teacher dashboard edit-flow: загрузка courses, create course + invalidate;
    - teacher students: create student + password reveal, transfer student + invalidate;
    - teacher student profile: review inbox routing, `creditTask` + invalidate + notice;
    - error catalog: student overrides, teacher status fallbacks, payload formatting.

- `Implemented` (проверка):
  - `pnpm --filter web test` — `pass` (`8` files / `23` tests);
  - `pnpm --filter web typecheck` — `pass`;
  - `pnpm --filter web lint` — `pass` (`0 errors`, только существующие warnings baseline).

- `Implemented`:
  - добавлены API integration suites для non-learning boundary:
    - `apps/api/test/integration/content-non-learning-boundary.integration.test.ts`,
    - `apps/api/test/integration/teacher-students-boundary.integration.test.ts`;
  - покрытые HTTP-сценарии:
    - `teacher/courses`: list/create/update/publish/unpublish/delete;
    - `teacher/sections`: get/create/update/publish/unpublish/delete;
    - `teacher/students`: list/detail/create/update/transfer/reset-password/delete;
    - `teacher/students/:studentId/tasks/:taskId/credit`;
    - `teacher/students/:studentId/units/:unitId/override-open`;
    - `courses`, `courses/:id`, `sections/:id`, `sections/:id/graph` для student read-path;
  - coverage строится на существующем `test-app.factory.ts` и mocked services/events без реальной БД.

- `Implemented` (проверка):
  - `pnpm --filter @continuum/api test` — `pass`;
  - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec vitest run --config vitest.integration.config.ts"` — `pass` (`5` files / `14` tests);
  - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec tsc -p tsconfig.json --noEmit"` — `pass`.

- `Implemented` (грабли/фиксация):
  - прямой запуск `pnpm exec vitest run --config vitest.integration.config.ts test/integration/<suite>.integration.test.ts` на хосте может падать с `Cannot find module '.prisma/client/default'`;
  - root cause: integration-контур `apps/api` требует Prisma runtime внутри Docker `api` контейнера;
  - фиксация в runbook: точечные integration-suite запускать через `docker compose exec -T api ...`.

- Next:
  - Wave 1D — при необходимости вынести общие test factories/helpers для migration-среза;
  - затем Wave 2 — docs-check scripts + CI integration.

### Phase 5 Wave 2 — Прогресс выполнения (2026-03-01)

- Статус волны: `Implemented`.

- `Implemented`:
  - выполнен doc-hygiene cleanup для SoR-доков:
    - `documents/ARCHITECTURE-PRINCIPLES.md` очищен от phase/wave history, progress narrative, dated snapshots и rollout chronology;
    - `documents/DEVELOPMENT.md` сокращён до operational runbook/troubleshooting scope;
    - `documents/DOCS-INDEX.md` усилен как source of truth по назначению документов;
    - `AGENTS.md` и `DOCS-INDEX.md` синхронизированы по правилам doc-governance;
  - добавлен docs governance toolchain:
    - `scripts/docs/_shared.mjs`,
    - `scripts/docs/check-links.mjs`,
    - `scripts/docs/check-index.mjs`,
    - `scripts/docs/check-status.mjs`;
  - в root `package.json` добавлены scripts:
    - `docs:check`,
    - `docs:check:links`,
    - `docs:check:index`,
    - `docs:check:status`;
  - в `.github/workflows/ci.yml` добавлен обязательный шаг `Docs check` до `lint/build/typecheck/test`.

- `Implemented` (semantics):
  - `ARCHITECTURE-PRINCIPLES.md` теперь хранит только stable principles, quality guardrails и approved stack;
  - `DEVELOPMENT.md` теперь хранит только команды, operational invariants и troubleshooting;
  - phase/wave history и журнал выполнения остаются только в execution plan;
  - `docs:check:status` запрещает повторный drift для ключевых документов через required/forbidden patterns.

- `Implemented` (проверка):
  - `pnpm docs:check` — `pass`;
  - `pnpm lint` — `pass` (`0 errors`, baseline warnings остаются вне scope волны);
  - `pnpm lint:boundaries` — `pass`;
  - `pnpm typecheck` — `pass`;
  - `pnpm test` — `pass`.

- `Implemented` (дополнительный фикс):
  - во время verification найден TS regression в новых web tests (`vi.importActual` возвращал `unknown` и ломал spread в `StudentDashboardScreen.test.tsx`, `TeacherDashboardScreen.test.tsx`, `TeacherStudentProfilePanel.test.tsx`, `TeacherStudentsPanel.test.tsx`);
  - regression устранён через явный generic `vi.importActual<typeof import(...)>()`, после чего `pnpm typecheck` и `pnpm test` снова проходят.

- Next:
  - Wave 1D не требуется на текущем объёме: общий test-harness не выделялся отдельно, так как дублирование недостаточно велико;
  - Wave 3 (`dependency-cruiser`) закрыта как `Skipped`: текущего `eslint-plugin-boundaries` + `pnpm lint:boundaries` достаточно для актуального риска drift;
  - после завершения Phase 5 следующим обязательным этапом остаётся Phase 6 — final lint hardening.

### Phase 6 — Final lint hardening (последним шагом)

- Статус фазы: `Implemented/Planned` (Wave 1 analysis + mechanical cleanup начаты, complexity refactor остаётся основным хвостом).

- Предусловие запуска:
  - `pnpm lint` возвращает `0 warnings` на актуальной `main`-ветке.

- План работ:
  - Wave 1 — Warning burn-down:
    - устранить все текущие предупреждения по `@typescript-eslint`/`complexity`/`max-lines` в `api`, `web`, `shared`, `worker`.
  - Wave 2 — Rules hardening:
    - перевести agreed subset правил из `warn` в `error` (минимум: `no-explicit-any`, `consistent-type-imports`, `no-unused-vars`);
    - для complexity/size правил выбрать финальную стратегию (error или explicit exception-list).
  - Wave 3 — CI strict mode + closeout:
    - включить fail-on-warnings (`lint:strict` с `--max-warnings=0` или эквивалент);
    - обновить SoR/DEVELOPMENT под финальные quality budgets;
    - перевести execution plan из `active` в `completed`.

- Exit criteria:
  - lint-контур strict: `0 warnings`, `0 errors` как обязательный merge-gate;
  - quality budgets enforced автоматически в CI;
  - execution plan закрыт и перенесён в `documents/exec-plans/completed/`.

### Phase 6 Wave 1 — Прогресс выполнения (2026-03-01)

- Статус волны: `Implemented/Planned`.

- `Implemented`:
  - выполнен lint-triage по workspace;
  - механический хвост warnings снят:
    - `@typescript-eslint/consistent-type-imports` очищен через repo-wide cleanup;
    - `@typescript-eslint/no-unused-vars` очищен локальными правками;
    - `@typescript-eslint/no-explicit-any` практически полностью убран, кроме мест, которые временно перерастали в complexity/refactor scope и затем были тоже устранены;
  - проведена типовая cleanup-подготовка для дальнейшего strict lint:
    - исправлены type-only imports в `api/web/worker`,
    - выпрямлены тестовые `vi.importActual<typeof import(...)>()`,
    - локальные helper typings добавлены для `pdfjs-dist`, `reactflow`, `@uiw/react-codemirror`.
  - в ходе cleanup выявлена и устранена runtime-regression в `apps/api`:
    - mass-fix `consistent-type-imports` перевёл часть Nest DI зависимостей в type-only imports;
    - symptom: `api` контейнер оставался `Up`, но bootstrap падал с `UnknownDependenciesException`, поэтому `/auth/login` и внешний `/health` были недоступны;
    - исправление: возвращены обычные imports для runtime-классов (`PrismaService`, `AuthService`, `UsersService`, `LearningService`, `Reflector`, `ContentGraphService`, `TaskRevisionPayloadService` и смежных DI providers);
    - проверка: внутри контейнера `api` снова проходят `GET /health` и `POST /auth/login`.
  - в dev-contour выявлена и устранена operational regression для PDF compile:
    - symptom: compile job enqueue происходил, но UI долго не получал результат и не показывал явную ошибку;
    - root cause: `worker` использовал stale `node_modules` volume и после появления `zod` в `packages/shared` не мог загрузить новый compiled bundle;
    - исправление: в `docker-compose.yml` startup guards для `api/worker` расширены проверкой наличия `zod`, после чего контейнеры пересозданы через `docker compose up -d --build --force-recreate api worker`;
    - проверка: `worker` снова логирует `[worker] latex ready concurrency=1`, а latex jobs переходят в `completed/success`.

- `Implemented` (проверка после cleanup):
  - `pnpm typecheck` — `pass`;
  - lint warnings сокращены примерно с `236` до `16`.

- `Implemented` (анализ причин остатка):
  - после mechanical cleanup все оставшиеся warnings относятся только к `complexity`;
  - это значит, что текущий хвост больше не является косметическим и требует структурного refactor, а не очередного auto-fix pass.
  - завершён первый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-review/TeacherReviewInboxPanel.tsx`;
    - результат:
      - добавлен targeted safety-net `TeacherReviewInboxPanel.test.tsx`,
      - компонент декомпозирован на toolbar/filters/empty/table helpers,
      - `TanStack Query` дополнительно не внедрялся, так как проблема файла была не в server-state, а в routing/filter/UI shell complexity,
      - targeted `web` tests и `web` typecheck после refactor проходят.
  - завершён второй цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-settings/TeacherSettingsScreen.tsx`;
    - результат:
      - добавлен targeted safety-net `TeacherSettingsScreen.test.tsx` для initial load, create teacher и delete teacher flows;
      - экран переведён на `TanStack Query` для `teacher/me` и `teacher/teachers`, а ручной initial load orchestration удалён;
      - write-side оставлен локальным, но теперь синхронизирует query cache через `setQueryData` и `invalidateQueries`, чтобы не было повторного tech debt по server-state;
      - complexity warning снят через перевод read-side на query/cache модель и вынос teacher list section из корневого shell-компонента;
      - targeted `eslint`, `TeacherSettingsScreen.test.tsx` и `pnpm --filter web typecheck` после refactor проходят.
  - завершён третий цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/student-dashboard/StudentDashboardScreen.tsx`;
    - результат:
      - расширен safety-net `StudentDashboardScreen.test.tsx`: restore graph из `localStorage`, `queryOverride`, ошибка открытия курса и возврат `graph -> sections`;
      - `TanStack Query` уже присутствовал в файле, поэтому refactor сфокусирован на устранении ручного orchestration поверх query-слоя, а не на повторном внедрении библиотеки;
      - `queryClient.fetchQuery` заменён на `ensureQueryData`, чтобы navigation flow опирался на query cache как на primary source of truth;
      - эффекты `boot/restore`, hydration section context и `popstate` вынесены в отдельные hooks/helpers, а render-branching — в `StudentDashboardPanel`;
      - complexity warning снят без изменения UI-поведения и без возврата к manual server-state;
      - проверка: direct `vitest` suite для `StudentDashboardScreen`, `pnpm --filter web test`, `pnpm --filter web typecheck` и `pnpm --filter web lint` проходят; в `web lint` остаются только warnings по следующим файлам из очереди.
  - завершён четвёртый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-review/TeacherReviewSubmissionDetailPanel.tsx`;
    - результат:
      - добавлен targeted safety-net `TeacherReviewSubmissionDetailPanel.test.tsx` для detail render, `accept -> next submission`, `reject -> inbox` и перехода в профиль ученика;
      - `TanStack Query` уже был внедрён, поэтому refactor сфокусирован на устранении смешения preview/action/navigation orchestration внутри одного shell-компонента;
      - preview queries вынесены в `usePhotoPreviewState`, accept/reject flow — в `useReviewSubmissionAction`, а bulky viewer/sidebar render — в `SubmissionViewer` и `SubmissionSidebar`;
      - complexity warning снят без изменения payload semantics, query invalidation и route behavior;
      - проверка: direct `vitest` suite, targeted `eslint` и `web typecheck` проходят; в `pnpm --filter web lint` warning по этому файлу больше не присутствует.
  - завершён пятый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-students/TeacherStudentsPanel.tsx`;
    - результат:
      - safety-net `TeacherStudentsPanel.test.tsx` расширен для edit profile, reset password reveal и routing в review inbox / profile, поверх уже существующих create + transfer сценариев;
      - file classified как `mixed read/write orchestration`, поэтому read-side оставлен на existing `TanStack Query`, а write-side переведён на `useMutation` (`create`, `reset password`, `transfer`, `update profile`, `delete`);
      - bulky UI ветви вынесены в `CreateStudentForm`, `PasswordRevealPanel`, `StudentCard`, а confirm dialog branching — в `getConfirmDialogState`;
      - complexity warning снят без потери текущих UI flows и invalidate semantics;
      - проверка: direct `TeacherStudentsPanel` suite, `pnpm --filter web test`, `pnpm --filter web typecheck` и `pnpm --filter web lint` проходят; остаток `web` warnings сократился до `8`.
  - завершён шестой цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx`;
    - результат:
      - safety-net `TeacherStudentProfilePanel.test.tsx` расширен для `override open unit`, route drilldown sync и toggle task statement, поверх уже существующих review-inbox и `creditTask` сценариев;
      - file classified как `mixed read/write orchestration`, поэтому read-side оставлен на existing `TanStack Query`, а write-side (`creditTask`, `overrideOpenUnit`) переведён на `useMutation`;
      - drilldown/render ветки вынесены в отдельные stage-компоненты (`CoursesStage`, `SectionsStage`, `UnitsStage`, `TasksStage`), а action-orchestration — в `useStudentProfileActions`;
      - complexity warning снят без изменения route semantics, profile invalidation и notice behavior;
      - проверка: direct `TeacherStudentProfilePanel` suite, targeted `eslint`, `web typecheck` и затем полный `pnpm --filter web lint` проходят; остаток `web` warnings сократился до `7`.
  - завершён седьмой цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx`;
    - результат:
      - safety-net `TeacherDashboardScreen.test.tsx` расширен для `create section`, navigation `course -> section -> graph -> sections -> courses` и publish section flow, поверх уже существующих course list + create course сценариев;
      - file classified как `mixed read/write orchestration`, поэтому read-side сохранён на `TanStack Query`, `handleOpenCourse` переведён на `ensureQueryData`, а write-side (`create`, `publish/unpublish`, `update`, `delete`) переведён на `useMutation`;
      - bulky render branches вынесены в локальные explicit components (`TeacherCourseCreateForm`, `TeacherSectionCreateForm`, `TeacherCourseListPanel`, `TeacherSectionListPanel`, `TeacherEditDialogPanel`, карточки курса/раздела);
      - complexity warning снят без изменения history-state semantics, graph navigation и invalidate behavior;
      - проверка: targeted `vitest` suite для `TeacherDashboardScreen`, targeted `eslint`, `web typecheck` проходят.
  - завершён восьмой цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/student-content/units/hooks/use-student-task-attempt.ts`;
    - результат:
      - добавлен targeted safety-net `use-student-task-attempt.test.tsx` для numeric payload/per-part map, incorrect single/multi reset, credited prefill и blocked timer;
      - `TanStack Query` уже использовался через mutation/invalidation, поэтому refactor сфокусирован на декомпозиции hook, а не на смене server-state модели;
      - hook разделён по ответственностям: `useAttemptAnswerState`, `useAttemptFeedbackState`, `useAttemptSubmission`, а credited-prefill, block-state, payload construction и incorrect-choice feedback вынесены в отдельные helpers;
      - complexity warning снят без изменения payload shape, invalidation semantics и UI contract с `StudentUnitDetailScreen`;
      - проверка: targeted `vitest` suite, targeted `eslint` и `web typecheck` проходят; остаток `web` warnings сократился до `5`.
  - завершён девятый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/student-content/units/hooks/use-student-unit-pdf-preview.ts`;
    - результат:
      - добавлен targeted safety-net `use-student-unit-pdf-preview.test.tsx` для theory/method query load, disabled state без asset key, refresh через query cache и zoom clamping;
      - file classified как `manual duplicated server-state helper`, поэтому refactor выполнен через общий `usePdfPreviewTargetQuery`, а не через косметический split;
      - theory/method preview логика сведена в единый target-based helper, а `refreshPreviewUrl` теперь принудительно обновляет presigned URL через invalidate + fetch, вместо возврата stale cache;
      - complexity warning снят без изменения внешнего hook contract для `StudentUnitDetailScreen`;
      - проверка: targeted `vitest` suite, targeted `eslint` и `web typecheck` проходят; остаток `web` warnings сократился до `4`.
  - завершён десятый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/components/PdfCanvasPreview.tsx`;
    - результат:
      - добавлен targeted safety-net `PdfCanvasPreview.test.tsx` для успешной загрузки страниц, retry по expired presigned URL и отображения refresh-error без потери сообщения;
      - component classified как `effect-heavy UI helper`, поэтому refactor сфокусирован на декомпозиции `loadPdf`, а не на изменении публичных props;
      - подготовка pdfjs, retry-policy, refresh flow и error formatting вынесены в отдельные helpers (`ensurePdfWorkerSrc`, `startPdfLoadingTask`, `canRetryWithFreshUrl`, `getLoadErrorMessage`);
      - после refactor сохранено поведение retry по fresh URL и дополнительно подтверждено тестом, что refresh-error больше не перетирается общим fallback message;
      - complexity warning снят без изменения contract для student/teacher PDF preview consumers;
      - проверка: targeted `vitest` suite, targeted `eslint`, полный `pnpm --filter web test` и `pnpm --filter web lint` проходят; остаток `web` warnings сократился до `3`.
  - завершён одиннадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-content/units/hooks/use-teacher-unit-latex-compile.ts`;
    - результат:
      - добавлен targeted safety-net `use-teacher-unit-latex-compile.test.tsx` для `failed -> compile error modal` и `succeeded -> apply fallback -> preview refresh` сценариев task solution compile;
      - complexity была локализована в `runTaskSolutionCompile`, поэтому refactor сфокусирован на декомпозиции compile pipeline без изменения публичного hook contract;
      - polling job status, task-asset resolve with retries, preview resolve и compile-error formatting вынесены в отдельные helpers (`pollLatexCompileJob`, `resolveTaskSolutionAfterRefresh`, `resolveTaskSolutionPreview`, `getCompileErrorMessage`);
      - complexity warning снят без изменения fallback semantics (`applyLatexCompileJob`) и error-modal UX;
      - проверка: targeted `vitest` suite, `web typecheck`, полный `pnpm --filter web test` и `pnpm --filter web lint` проходят; остаток `web` warnings сократился до `2`.
  - завершён двенадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx`;
    - результат:
      - добавлен targeted safety-net `StudentUnitDetailScreen.test.tsx` для `404 -> StudentNotFound`, `409 UNIT_LOCKED -> locked gate`, `tasks -> theory`, `credited non-photo flow` и `photo task upload/submit` сценариев;
      - read-path уже был на `useQuery`, поэтому refactor сфокусирован на `P1/P10`: экран разрезан на локальные view-components (`StudentUnitProgressCard`, `StudentUnitTasksPanel`, `StudentUnitTabContent`, `StudentUnitLockedGate`) без изменения существующего data-flow;
      - derived state и orchestration вынесены в `useStudentUnitScreenState` с дополнительным разделением на query/tabs/task helpers, чтобы root screen остался composition shell;
      - task action branching вынесен в отдельные controls (`StudentTaskAttemptControls`, `StudentTaskProgressControls`) без изменения UI semantics для numeric/photo/credited flows;
      - complexity warning снят, внешний contract экрана и соседних hooks/components сохранён;
      - проверка: targeted `vitest` suite, полный `pnpm --filter web lint` и `pnpm --filter web typecheck` проходят; остаток `web` warnings сократился до `1`.
  - завершён тринадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx`;
    - результат:
      - добавлен targeted safety-net `TeacherUnitDetailScreen.test.tsx` для `load unit + breadcrumb context`, `publish unit`, `create+publish task` и `delete unit -> back to section` сценариев;
      - `useTeacherUnitFetchSave` переведён с manual `useEffect + fetch + cancelled flags` на `TanStack Query + mutations`, при этом сохранён внешний hook contract (`unit`, `setUnit`, `fetchUnit`, editable local state) для compile/image flows;
      - в `contentQueryKeys` добавлен `teacherUnit(unitId)` как source of truth для unit read-path и refresh cache;
      - write-side orchestration экрана вынесен в отдельный hook `useTeacherUnitScreenActions`, а root screen разрезан на composition pieces (`TeacherUnitHeader`, `TeacherUnitTabContent`, `TeacherUnitDeleteDialog`, layout hook);
      - complexity warning по `TeacherUnitDetailScreen.tsx` снят без изменения UI semantics, publish/delete/task CRUD flows и compile modal contract;
      - проверка: targeted `TeacherUnitDetailScreen.test.tsx`, полный `pnpm --filter web test`, `pnpm --filter web lint` и `pnpm --filter web typecheck` проходят; `web` warning tail обнулён.
  - завершён четырнадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/api/src/learning/learning-attempts-write.service.ts`;
    - результат:
      - safety-net `learning-attempts-write.service.test.ts` расширен сценарием reset state при смене `activeRevisionId`, поверх уже существующих correct/third wrong/sixth wrong сценариев;
      - unit-test сделан независимым от локального Prisma runtime через `vi.mock('@prisma/client')`, поэтому он воспроизводимо проходит на хосте и не требует Docker только ради enum/runtime imports;
      - `submitAttempt` декомпозирован по шагам `load task -> load/create/reset state -> guards -> transition -> persist -> notifications -> audit`, без изменения публичного response shape и существующих `error.code`;
      - DI-зависимости (`PrismaService`, `LearningAuditLogService`, `LearningAvailabilityService`) переведены на явный `@Inject(...)`, чтобы снять `consistent-type-imports` warning без повторения прошлой runtime-regression с type-only imports в Nest;
      - complexity warning по transaction callback снят без изменения attempt numbering, notification semantics, availability recompute и audit tail;
      - в Docker-контуре первый `tsc --noEmit` дополнительно поймал narrow-type regression в `resolveAttemptStateTransition` (`status = StudentTaskStatus.blocked`), после чего добавлена явная аннотация `let status: StudentTaskStatus`;
      - проверка: targeted `eslint`, direct `learning-attempts-write.service.test.ts`, полный `pnpm --filter @continuum/api test`, а также Docker `eslint`, `tsc --noEmit`, `build` и `test` проходят.
  - завершён пятнадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/api/src/learning/learning-availability.service.ts`;
    - результат:
      - добавлен targeted safety-net `learning-availability.service.test.ts` для prerequisite unlock chain, optional-only zero-gate completion rule и override-open persistence/timestamps;
      - `recomputeSectionAvailability()` сохранён как публичный contract для тестов, чтобы safety-net покрывал реальную доменную семантику, а не private helper internals;
      - `computeSnapshots` декомпозирован на чистые helper’ы (`groupTasksByUnitId`, `buildHasAttemptByUnitId`, `buildPrereqByUnitId`, `computeUnitTaskMetrics`, `resolveEffectiveMinOptionalCountedTasksToComplete`, `resolveUnitStatus`) без изменения unlock/progress правил;
      - `PrismaService` переведён на явный `@Inject(PrismaService)`, чтобы снять локальный `consistent-type-imports` warning без риска повторить прошлую Nest DI regression;
      - локальный complexity warning снят без изменения `studentUnitState.upsert` semantics, `becameAvailableAt/startedAt/completedAt` persistence и completion gate для optional-only units;
      - проверка: targeted host test, Docker targeted test, Docker полный `pnpm test`, Docker `eslint`, Docker `tsc --noEmit` и Docker `build` проходят.
  - завершён шестнадцатый цикл `targeted tests -> refactor -> targeted verification` для:
    - `apps/api/src/infra/latex/latex-compile.service.ts`;
    - результат:
      - добавлен targeted safety-net `latex-compile.service.test.ts` для Unicode fallback retry, xcolor fallback retry, timeout mapping, legacy T2A failure message и early reject по пустому input;
      - compile pipeline декомпозирован без изменения публичного contract `compileToPdf()`: выделены `createWorkingState`, `compileWithFallbacks`, `retryWithFallbackIfNeeded`, `assertSuccessfulAttempt`;
      - источник complexity локализован в fallback/error orchestration; `runTectonic` и filesystem cleanup semantics не менялись;
      - при подготовке tests зафиксирована и исправлена две harness-грабли:
        - `vi.mock('node:fs')` требовал `vi.hoisted(...)`, иначе падал до импорта сервиса;
        - fixture для “fallback does not change source” должен уже содержать `fontspec + defaultfontfeatures + setmainfont`, иначе сервис корректно считает, что preamble ещё можно патчить;
      - локальный complexity warning снят без изменения timeout code, fallback retry order, legacy T2A error message и cleanup через `fs.rm(..., { recursive: true, force: true })`;
      - проверка: targeted host test, Docker targeted test, Docker полный `pnpm test`, targeted host/Docker `eslint`, Docker `tsc --noEmit` и Docker `build` проходят.

- Complexity triage по `ARCHITECTURE-PRINCIPLES.md`:
  - критерии обязательного refactor:
    - нарушение `P1 (SRP + complexity budget)`: один экран/метод совмещает несколько orchestration responsibilities;
    - нарушение `P4 (read/write separation)`: read-path, write-path и invalidation смешаны в одном flow;
    - нарушение `P9 (server-state discipline)`: server-state orchestration и UI branching переплетены;
    - нарушение `P10 (effect isolation)`: async orchestration и side-effects не вынесены в hooks/helpers;
  - низкий приоритет / допустимый локальный helper refactor:
    - инфраструктурные или UI-helper функции, где complexity локальна и не размывает архитектурные границы.

- Tier A — обязательный architectural refactor:
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` (`Implemented`)
  - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx` (`Implemented`)
  - `apps/web/features/teacher-dashboard/TeacherDashboardScreen.tsx` (`Implemented`)
  - `apps/web/features/teacher-students/TeacherStudentProfilePanel.tsx` (`Implemented`)
  - `apps/web/features/teacher-students/TeacherStudentsPanel.tsx` (`Implemented`)
  - `apps/web/features/student-dashboard/StudentDashboardScreen.tsx` (`Implemented`)
  - `apps/web/features/teacher-review/TeacherReviewSubmissionDetailPanel.tsx` (`Implemented`)
  - `apps/web/features/teacher-review/TeacherReviewInboxPanel.tsx` (`Implemented`)
  - `apps/web/features/teacher-settings/TeacherSettingsScreen.tsx` (`Implemented`)
  - `apps/web/features/student-content/units/hooks/use-student-task-attempt.ts` (`Implemented`)
  - `apps/web/features/teacher-content/units/hooks/use-teacher-unit-latex-compile.ts` (`Implemented`)
  - `apps/api/src/learning/learning-attempts-write.service.ts` (`Implemented`)
  - `apps/api/src/learning/learning-availability.service.ts` (`Implemented`)
  - rationale:
    - это product-facing orchestration surfaces, где текущая complexity прямо конфликтует с `P1/P4/P9/P10`.

- Tier B — желательный, но вторичный refactor:
  - `apps/web/components/PdfCanvasPreview.tsx`
  - `apps/web/features/student-content/units/hooks/use-student-unit-pdf-preview.ts`
  - `apps/api/src/infra/latex/latex-compile.service.ts`
  - rationale:
    - complexity здесь реальна, но ответственность локальна и boundary leakage ниже; эти файлы не так сильно ломают архитектурную модель, как Tier A.

- Уточнение после локального/full-package lint анализа:
  - после закрытия `learning-attempts-write.service.ts`, `learning-availability.service.ts` и `latex-compile.service.ts` Phase 6 `complexity` tail по `api/web` закрыт;
  - при этом в `apps/api` всё ещё остаётся отдельный baseline хвост из `@typescript-eslint/consistent-type-imports` warnings по многим файлам;
  - этот baseline относится к общей финальной lint-hardening cleanup работе и не должен маскироваться под “последний complexity файл”.

- Порядок выполнения Wave 1 дальше:
  - рабочий цикл фиксируется по каждому файлу/flow:
    - сначала добавить или расширить минимальный safety-net тестов для текущего behavior этого файла;
    - перед refactor явно классифицировать источник complexity:
      - `manual server-state orchestration`,
      - `mixed read/write orchestration`,
      - `effect-heavy UI shell`,
      - `local branching/helper complexity`;
    - если complexity связана с `manual server-state orchestration` или `mixed read/write orchestration`, перевод на `TanStack Query` входит в scope refactor этого файла;
    - если complexity локальна и не связана с server-state, `TanStack Query` не внедряется насильно;
    - затем выполнить refactor только этого файла/flow;
    - затем прогнать targeted tests + relevant smoke/typecheck/lint checks;
    - только после стабилизации переходить к следующему файлу;
  - blanket-покрытие всего проекта до начала refactor не требуется;
  - blanket-refactor без предварительного targeted safety-net для конкретного файла не допускается;
  - сначала самые дешёвые Tier A точки:
    - `TeacherReviewInboxPanel.tsx` (`Implemented`)
    - `TeacherSettingsScreen.tsx` (`Implemented`)
    - `StudentDashboardScreen.tsx` (`Implemented`)
    - `use-student-unit-pdf-preview.ts` (если останется как Tier B helper, можно взять между Tier A экранами как quick win)
  - затем средние product orchestration:
    - `TeacherReviewSubmissionDetailPanel.tsx` (`Implemented`)
    - `TeacherStudentsPanel.tsx` (`Implemented`)
    - `learning-attempts-write.service.ts`
  - затем тяжёлые shells:
    - `use-teacher-unit-latex-compile.ts`
    - `learning-availability.service.ts`

- Decision:
  - `complexity` warnings не будут suppress/ignore-иться, пока файл попадает в Tier A;
  - `dependency-cruiser` в рамках этой фазы окончательно `Skipped`;
  - для Phase 6 порядок выполнения фиксированный: `targeted tests -> refactor -> targeted verification -> следующий файл`;
  - `TanStack Query` внедряется сразу в рамках рефакторинга каждого файла, где источник `complexity` — это `manual server-state orchestration` или `mixed read/write orchestration`; отдельная отложенная волна для таких файлов не допускается;
  - если файл требует `TanStack Query` по критериям `P4/P9/P10`, refactor считается незавершённым, пока manual server-state не заменён на query/cache/invalidation модель;
  - единственный допустимый fallback для Tier B — отложить refactor, но не переводить правило `complexity` в `error`, пока хвост не снят.

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
- Риск: преждевременное ужесточение lint-правил заблокирует поставку feature-задач.
  - Митигировать: выполнять lint hardening только в финальной Phase 6 после warning burn-down.

## Откат

- Для каждой фазы возможен локальный откат в пределах соответствующих модулей.
- Новые проверки включать поэтапно, чтобы откатить отдельный check без отката функциональных изменений.

## Критерии завершения

- Критичные модульные “узкие места” декомпозированы.
- Контракты и validation централизованы.
- Cross-cutting дубли существенно сокращены.
- Quality-бюджеты автоматизированы в CI и отражены в SoR.
- Lint-контур ужесточён после обнуления warning’ов (strict merge-gate).
