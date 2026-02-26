# ARCHITECTURE-PRINCIPLES.md

Назначение: инженерные принципы, quality-бюджеты и рекомендуемый стек для улучшения читаемости и поддерживаемости кода.

Границы документа:
- Здесь фиксируется **как мы пишем и эволюционируем код**.
- Доменная карта BC/инварианты/зависимости остаются в `documents/ARCHITECTURE.md`.
- Пошаговый план внедрения и сроки живут в execution plan, а не в этом SoR.

## Статус

- `Implemented`: baseline-метрики и факты по текущему коду.
- `Planned`: целевые принципы и инструменты, которые нужно внедрить.

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
  - в feature-экранах повторяется ручной anti-race паттерн `requestIdRef`.

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

## 3) Рекомендуемые библиотеки (`Planned`)

### 3.1 Приоритетный стек

- `zod`:
  - единый runtime/schema слой для API boundary + frontend parsing + shared contracts;
  - ответ на вопрос “нужен ли Zod”: **да, нужен**.
- `nestjs-zod` (или эквивалентный bridge-слой):
  - интеграция Zod-схем в NestJS pipe/DTO-поток без ручного парсинга в каждом сервисе.
- `@tanstack/react-query`:
  - единый server-state cache/dedup/retry/invalidation слой на frontend.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`:
  - безопасный рефакторинг React-модулей.
- `supertest`:
  - интеграционные тесты API boundary (валидация, коды ошибок, auth инварианты).

### 3.2 Минимальный обязательный quality-контур

- `eslint` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`:
  - базовая типобезопасность/читаемость (`no-explicit-any`, правила сложности и размерности для изменённого кода).
- `eslint-plugin-boundaries`:
  - контроль архитектурных границ импортов между слоями/feature-модулями.

### 3.3 Опционально (не блокирует внедрение принципов на старте)

- `dependency-cruiser`:
  - полезен для глубокого анализа графа зависимостей, но внедряется после стабилизации минимального контура.
- Дополнительные плагины (например, расширенные import-правила) подключаются только при явной пользе и без перегруза CI.

### 3.4 Где именно подключаются библиотеки

- `zod`:
  - `packages/shared` — общие schema/contracts;
  - `apps/api` — boundary validation входов/выходов;
  - `apps/web` — runtime-парсинг API-ответов и форм.
- `nestjs-zod`:
  - только `apps/api` (интеграция схем в NestJS pipeline).
- `@tanstack/react-query`:
  - только `apps/web` (server-state слой).
- `vitest` + Testing Library:
  - в первую очередь `apps/web` (unit/component/hooks), по необходимости `packages/shared`.
- `supertest`:
  - только `apps/api` (интеграционные HTTP-тесты).
- `eslint` + `@typescript-eslint` + `eslint-plugin-boundaries`:
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
