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
- `nestjs-zod`:
  - где добавляем: `apps/api`;
  - зачем в этой фазе: встроить schema validation в HTTP boundary NestJS.

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
  - добавить dependency: `zod`, `nestjs-zod` (или выбранный bridge-слой).
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

- Статус волны: `In Progress` (wave1 Learning/Photo реализован, дальнейшие волны Phase 1 остаются `Planned`).

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

- `Planned` (следующие волны Phase 1):
  - расширить contract-first подход за пределы Learning/Photo;
  - решить стратегию глобального validation pipeline в API (после wave1);
  - подготовить возможный переход с custom bridge на `nestjs-zod`, если это даст выигрыш без регрессий совместимости.

### Phase 2 — Backend декомпозиция

- Разделить самые крупные сервисы на read/write + policy + mapper слои.
- Свернуть дублирующееся audit/guard поведение в композиционные примитивы.
- Обновить документацию по новым границам модулей и слоям.
- Exit criteria:
  - `content.service.ts` и `learning.service.ts` декомпозированы на smaller units;
  - число cross-cutting дублирований заметно снижено.

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
