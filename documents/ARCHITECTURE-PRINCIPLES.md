# ARCHITECTURE-PRINCIPLES.md

Назначение: инженерные принципы, quality-бюджеты и рекомендуемый стек для улучшения читаемости и поддерживаемости кода.

Границы документа:
- Здесь фиксируется **как мы пишем и эволюционируем код**.
- Доменная карта BC/инварианты/зависимости остаются в `documents/ARCHITECTURE.md`.
- Пошаговый план внедрения и сроки живут в execution plan, а не в этом SoR.

## Статус

- `Implemented`: baseline-метрики и факты по текущему коду.
- `Planned`: целевые принципы и инструменты, которые нужно внедрить.
- `Implemented` (2026-02-27, Phase 0 foundation): в monorepo подключены `eslint` + `@typescript-eslint` + `eslint-plugin-boundaries`, добавлены workspace `lint`-scripts и CI-проверки `lint` + `lint:boundaries`.
- `Implemented` (2026-02-27, Phase 0 tests baseline): в `apps/api`, `apps/web`, `apps/worker`, `packages/shared` подключён `vitest`, добавлены минимальные автотесты для health/login/storage-config критичных путей.
- `Implemented` (2026-02-27, Phase 1 completed / scope: wave1 Learning/Photo): внедрён schema-first contract slice на `zod` (`@continuum/shared`), подключён custom `ZodValidationPipe` в API boundary для wave1 endpoint-ов, и включён runtime parsing ответов в web-клиенте (`apiRequestParsed`, `API_RESPONSE_INVALID`).
- `Implemented/Planned` (2026-02-27, Phase 2): для backend декомпозиции добавлен integration safety-net через `supertest` (`Implemented`, wave1); выполнена декомпозиция `learning.service.ts`, `photo-task.service.ts` и `content.service.ts` с выносом graph/payload/write-path сервисов (`Implemented`, wave2-wave4), плюс введён `learning-audit-log.service.ts` и перевод refactored learning/photo write сервисов на audit-helper (`Implemented`, wave5). Дальнейшее масштабирование helper-подхода на остальные модули API остаётся `Planned`.
- `Implemented/Planned` (2026-02-27, Phase 3 waves 1-6 + Phase 4 waves 1-3): в `apps/web` подключён `@tanstack/react-query`, добавлен `QueryProvider` в root layout и query key factory для Learning/Photo (`Implemented`, wave1); read-path migration выполнен для `TeacherReviewInboxPanel`, `TeacherReviewSubmissionDetailPanel`, `StudentUnitDetailScreen` (`Implemented`, wave2); write-path (`submitAttempt`, `submitPhoto`, `accept/reject`) переведён на `useMutation` с query invalidation для migration-среза (`Implemented`, wave3); `StudentUnitDetailScreen` и `TeacherUnitDetailScreen` декомпозированы на hooks/subcomponents и оставлены composition-shell (`Implemented`, wave4-wave5); API client surface cleanup для migration-среза завершён в `student.ts`/`teacher.ts` через shared aliases и устранение дублей (`Implemented`, wave6); non-learning migration wave1 выполнен для `TeacherDashboardScreen`, `TeacherSectionGraphPanel`, `StudentDashboardScreen`, `TeacherStudentsPanel`, `TeacherStudentProfilePanel` (`Implemented`, Phase 4 wave1); unified web Error Catalog layer внедрён через `apps/web/lib/api/error-catalog.ts` и подключён в student/teacher error helpers (`Implemented`, Phase 4 wave2); runtime parsing/contracts расширены на non-learning migration-срез через `packages/shared/src/contracts/content-non-learning.ts` и `apiRequestParsed` в `student.ts`/`teacher.ts` (`Implemented`, Phase 4 wave3). Дальнейшее расширение migration на remaining-экраны остаётся `Planned`.

## 1) Baseline читаемости и поддерживаемости (`Implemented`, снимок на 2026-02-26)

- Размер backend-кода: `apps/api/src` ≈ `11_748` строк TypeScript (`86` файлов).
- Размер frontend-кода: `apps/web` (без `.next`) ≈ `13_644` строк TS/TSX (`83` файлов).
- Крупные файлы (`> 500` строк): API — `6`, Web — `9`.
- Крупнейшие файлы:
  - `apps/api/src/content/content.service.ts` (`1594` строк),
  - `apps/api/src/learning/learning.service.ts` (`1378` строк),
  - `apps/api/src/learning/photo-task.service.ts` (`1287` строк),
  - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx` (`2140` строк),
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx` (`1327` строк),
  - `apps/web/lib/api/teacher.ts` (`1030` строк).
- Повторы auth/role шаблона: `@UseGuards(JwtAuthGuard, RolesGuard)` встречается `30` раз.
- Повторы ручного audit-логирования: `eventsLogService.append(...)` встречается `45` раз (`33` в контроллерах, `12` в сервисах).
- Runtime-валидация API-границ фрагментирована:
  - `ValidationPipe`/`class-validator` в API сейчас не используются,
  - в API-коде много входов типа `unknown`.
- Frontend в режиме client-first:
  - `41` из `64` TSX-файлов помечены `'use client'`,
  - в feature-экранах повторяются ручные anti-race паттерны (`cancelled/disposed` флаги и cleanup в `useEffect`).
- Дельта после backend-декомпозиции (2026-02-27, `Implemented`):
  - `apps/api/src/learning/learning.service.ts`: `1378 -> 470` строк;
  - `apps/api/src/learning/photo-task.service.ts`: `1287 -> 88` строк (фасад, read/write вынесены);
  - `apps/api/src/content/content.service.ts`: `1594 -> 384` строки (graph/payload/write слои вынесены).
- Дельта после frontend-декомпозиции (2026-02-27, `Implemented`):
  - `apps/web/features/student-content/units/StudentUnitDetailScreen.tsx`: `1327 -> 508` строк;
  - `apps/web/features/teacher-content/units/TeacherUnitDetailScreen.tsx`: `2140 -> 815` строк;
  - orchestration вынесен в hooks (`attempt`, `photo submit`, `pdf/image preview`, `task navigation`);
  - UI-блоки вынесены в subcomponents (`task card shell`, `task answers`, `task media preview`, `task tabs`, `unit pdf panel`, `teacher task/editor panels`, `compile panels`, `media/upload blocks`).

## 2) Целевые архитектурные принципы (`Planned`)

### 2.1 Core

- **P1. SRP + complexity budget**: один модуль/файл имеет одну главную ответственность; лимиты размера/сложности обязательны.
- **P2. DRY для контрактов (contract-first)**: доменные/транспортные схемы описываются один раз и переиспользуются API + Web.
- **P3. Fail-fast boundary validation**: все внешние входы (body/query/params/cookies) валидируются единообразно на границе.
- **P4. CQS/CQRS-lite**: read и write сценарии разделяются по сервисам/хэндлерам.
- **P5. Typed mapping без утечек `any/unknown` в домен**: преобразования DB/API/UI через явные mapper-функции.
- **P6. Единый Error Catalog**: стандартизированные `code/message/details` для всех BC и UI-обработчиков.
- **P7. Policy-as-code**: TTL/лимиты/типы файлов и аналогичные политики централизуются в policy-сервисах.
- **P8. Convention over duplication**: повторяющиеся cross-cutting паттерны (guards/audit/decorators) оформляются как примитивы.

### 2.2 Frontend

- **P9. Server State discipline**: сетевые данные живут в выделенном server-state слое, а не в разрозненных `useState/useEffect`.
- **P10. Effect isolation**: async orchestration и побочные эффекты выносятся в `use*` hooks; UI остаётся декларативным.
- **P11. Server-first rendering by default**: для read-heavy экранов предпочитать RSC/SSR; client-компоненты только для интерактивности.
- **P12. Dependency rule enforcement**: границы зависимостей feature/layer проверяются автоматически.

## 3) Рекомендуемые библиотеки и текущий статус

### 3.1 Приоритетный стек (`Implemented/Planned`)

- `zod`:
  - единый runtime/schema слой для API boundary + frontend parsing + shared contracts;
  - ответ на вопрос “нужен ли Zod”: **да, нужен** (`Implemented` для Phase 1 wave1 Learning/Photo).
- `nestjs-zod` (или эквивалентный bridge-слой):
  - интеграция Zod-схем в NestJS pipe/DTO-поток без ручного парсинга в каждом сервисе (`Planned`);
  - текущий bridge в коде: custom `ZodValidationPipe` (`Implemented`, wave1).
- `@tanstack/react-query` (`Implemented/Planned`):
  - единый server-state cache/dedup/retry/invalidation слой на frontend.
  - `Implemented`: foundation (`QueryProvider` + `QueryClient` + query keys) в `apps/web`, migration Learning/Photo read/write-path на `useQuery/useQueries/useMutation`, и non-learning migration wave1 для dashboard/students/profile экранов;
  - `Implemented`: унификация web error-handling через `apps/web/lib/api/error-catalog.ts` и переиспользование в student/teacher helpers (Phase 4 wave2);
  - `Implemented`: расширение runtime parsing/contracts на non-learning migration-срез (Phase 4 wave3);
  - `Planned`: дальнейшая migration оставшихся экранов.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` (`Implemented` для baseline в `apps/web`, дальнейшее расширение `Planned`):
  - безопасный рефакторинг React-модулей.
- `supertest`:
  - интеграционные тесты API boundary (валидация, коды ошибок, auth инварианты) (`Implemented` baseline для Phase 2 wave1, дальнейшее расширение `Planned`).
  - декомпозиция backend сервисов выполняется под этим safety-net (`Implemented` для wave2-wave5 в scope Phase 2).

### 3.2 Минимальный обязательный quality-контур (`Implemented`, 2026-02-27)

- `eslint` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`:
  - базовая типобезопасность/читаемость (`no-explicit-any`, правила сложности и размерности для изменённого кода).
- `eslint-plugin-boundaries`:
  - контроль архитектурных границ импортов между слоями/feature-модулями.
- Текущее enforcement:
  - корневой flat config `eslint.config.mjs` применяется к `apps/*` и `packages/*`;
  - `pnpm lint` запускает lint по всем workspace-пакетам через `turbo`;
  - `pnpm lint:boundaries` выполняет отдельный boundary-check;
  - в CI (`.github/workflows/ci.yml`) добавлены обязательные шаги `Lint` и `Dependency boundaries`.

### 3.3 Опционально (не блокирует внедрение принципов на старте, `Planned`)

- `dependency-cruiser`:
  - полезен для глубокого анализа графа зависимостей, но внедряется после стабилизации минимального контура.
- Дополнительные плагины (например, расширенные import-правила) подключаются только при явной пользе и без перегруза CI.

### 3.4 Где именно подключаются библиотеки (`Implemented/Planned`)

- `zod` (`Implemented/Planned`):
  - `packages/shared` — общие schema/contracts (`Implemented` для wave1 Learning/Photo + Phase 4 wave3 non-learning slice);
  - `apps/api` — boundary validation входов/выходов (`Implemented` для wave1 Learning/Photo через custom pipe);
  - `apps/web` — runtime-парсинг API-ответов и форм (`Implemented` для wave1 Learning/Photo + Phase 4 wave3 non-learning migration-среза, далее `Planned` для расширения).
- `nestjs-zod` (`Planned`):
  - только `apps/api` (интеграция схем в NestJS pipeline).
- `@tanstack/react-query` (`Implemented/Planned`):
  - только `apps/web` (server-state слой);
  - `Implemented`: `apps/web/lib/query/query-client.ts`, `apps/web/lib/query/query-provider.tsx`, `apps/web/lib/query/keys.ts`, подключение provider в `apps/web/app/layout.tsx`;
  - `Implemented`: перевод Learning/Photo wave-среза (`TeacherReviewInboxPanel`, `TeacherReviewSubmissionDetailPanel`, `StudentUnitDetailScreen`) на query hooks для read/write;
  - `Implemented`: перевод non-learning wave1 (`TeacherDashboardScreen`, `TeacherSectionGraphPanel`, `StudentDashboardScreen`, `TeacherStudentsPanel`, `TeacherStudentProfilePanel`) на query-driven загрузку и cache invalidation;
  - `Implemented`: cleanup API client surface для migration-среза в `apps/web/lib/api/student.ts` и `apps/web/lib/api/teacher.ts` (shared aliases + dedup helpers);
  - `Implemented`: Phase 4 wave3 runtime parsing/contracts expansion для non-learning migration-среза;
  - `Planned`: перевод remaining-экранов.
- `vitest` + Testing Library (`Implemented` baseline в `apps/web`, расширение `Planned`):
  - в `apps/web` покрыт минимальный login happy-path/error-path;
  - далее: расширение покрытия unit/component/hooks и, при необходимости, `packages/shared`.
- `supertest` (`Implemented/Planned`):
  - только `apps/api` (интеграционные HTTP-тесты);
  - `Implemented`: `apps/api/test/integration/*` + docker-only script `test:integration`;
  - `Planned`: расширить coverage при декомпозиции wave2+.
- `eslint` + `@typescript-eslint` + `eslint-plugin-boundaries` (`Implemented`, 2026-02-27):
  - на уровне monorepo (корневой конфиг), применяется к `apps/*` и `packages/*`.

## 4) Приоритеты качества и анти-гейминг (`Planned`)

### 4.1 Порядок приоритетов

- `Correctness` и доменные инварианты > `Security` > `Понятность изменений` > `Скорость поставки` > `Метрики линтеров`.

### 4.2 Правила интерпретации метрик

- Линтеры и лимиты — это **ограничители риска**, а не KPI.
- Запрещено ухудшать код ради прохождения метрики (искусственная декомпозиция без улучшения смысловой структуры, “шумовые” обёртки, бессодержательные переименования).
- Для legacy действует ratchet-подход: “не ухудшать” + инкрементальные улучшения при каждом касании.
- Допускаются exception-решения с явным owner, причиной и сроком погашения.

## 5) Связанные документы

- Архитектура системы: `documents/ARCHITECTURE.md`.
- Frontend SoR: `documents/FRONTEND.md`.
- План внедрения принципов: `documents/exec-plans/active/2026-02-26-architecture-principles-refactor-foundation.md`.
