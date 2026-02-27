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

- Статус фазы: `Planned`.

- План работ:
  - Wave 1 — Test coverage expansion:
    - web: добавить unit/component/hook тесты для Phase 4 migration-среза;
    - api: расширить `supertest` integration coverage на non-learning read/write сценарии;
    - shared: покрыть тестами unified error catalog/contracts helpers.
  - Wave 2 — Documentation checks in CI:
    - добавить автоматические проверки:
      - валидность markdown links;
      - anti-orphans относительно `documents/DOCS-INDEX.md`;
      - наличие `Implemented/Planned` в ключевых SoR-доках;
    - зафиксировать troubleshooting для новых checks в `documents/DEVELOPMENT.md`.
  - Wave 3 — Architectural guardrails (optional):
    - при необходимости подключить `dependency-cruiser` и добавить `deps:check` в CI/локальные проверки.

- Exit criteria:
  - coverage для migration-среза заметно расширен и включён в обязательный прогон;
  - docs checks автоматически исполняются в CI;
  - архитектурные границы подтверждаются автоматическими проверками (eslint boundaries + при необходимости dependency graph check).

### Phase 6 — Final lint hardening (последним шагом)

- Статус фазы: `Planned`.

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
