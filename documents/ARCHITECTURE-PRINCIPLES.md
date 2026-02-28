# ARCHITECTURE-PRINCIPLES.md

Назначение: инженерные принципы, quality budgets, enforced practices и стабильные архитектурные ограничения для эволюции кода.

## Границы документа (`Implemented`)

- Здесь фиксируется только то, как код должен быть устроен и какие инженерные практики уже приняты или являются целевыми.
- Доменная карта, bounded contexts и module map живут в [ARCHITECTURE.md](./ARCHITECTURE.md).
- Dev/build/test/deploy runbook и troubleshooting живут в [DEVELOPMENT.md](./DEVELOPMENT.md).
- Пошаговое внедрение, журнал выполнения и decision log живут только в execution plans.

## Статус-модель (`Implemented`)

- `Implemented`:
  - практика или ограничение уже подтверждены текущим кодом и toolchain.
- `Planned`:
  - это целевая архитектурная практика уровня policy, но она ещё не покрыта кодом полностью.
- В этом документе `Planned` используется только для стабильных target-state правил.
- Здесь не хранятся поэтапные планы внедрения, backlog и история выполнения.

## Архитектурные принципы (`Implemented/Planned`)

### Core (`Planned`)

- **P1. SRP + complexity budget**: модуль и файл должны иметь одну главную ответственность; большие orchestration-блоки декомпозируются до читабельных units.
- **P2. Contract-first**: transport/runtime-контракты описываются один раз и переиспользуются между API и web.
- **P3. Fail-fast boundary validation**: все внешние входы валидируются на boundary до попадания в доменные сервисы.
- **P4. Read/write separation**: read-path и write-path не смешиваются в одном orchestration без явной причины.
- **P5. Typed mapping**: преобразования DB/API/UI выполняются явными mapper-функциями без протекания `any` и неконтролируемого `unknown`.
- **P6. Unified error semantics**: пользовательские и интеграционные ошибки должны проходить через единый `code/message/details` contract.
- **P7. Policy-as-code**: TTL, asset rules, queue limits и аналогичные правила выносятся в централизованные policy/helper слои.
- **P8. Convention over duplication**: повторяющиеся cross-cutting patterns оформляются как общие примитивы, а не копируются по контроллерам и экранам.

### Frontend (`Planned`)

- **P9. Server-state discipline**: сетевые данные не хранятся в произвольных `useState/useEffect`, а живут в выделенном server-state слое.
- **P10. Effect isolation**: async orchestration и побочные эффекты выносятся в hooks и helper-слои; UI остаётся декларативным.
- **P11. Server-first rendering by default**: client boundaries вводятся только там, где действительно нужна интерактивность.
- **P12. Dependency rule enforcement**: архитектурные границы слоёв и features проверяются автоматически, а не только договорённостью.

## Current Guardrails (`Implemented`)

### Quality contour

- В monorepo подключены `eslint`, `@typescript-eslint/*` и `eslint-plugin-boundaries`.
- Workspace lint запускается через `pnpm lint`.
- Архитектурные импорт-границы проверяются отдельной командой `pnpm lint:boundaries`.
- CI использует эти проверки как обязательный quality gate.

### Contracts and boundary validation

- В репозитории используется `zod` как основной runtime/schema слой для shared contracts и parsing.
- В `apps/api` boundary validation для выбранных срезов реализована через custom `ZodValidationPipe`.
- В `apps/web` runtime parsing ответов выполняется через shared contracts и fail-fast API client helpers.

### Server-state discipline

- В `apps/web` принят `@tanstack/react-query` как основной server-state слой.
- Query keys и invalidation строятся через централизованный query helper слой.
- Для уже переведённых read/write flows ручные anti-race паттерны должны заменяться query/mutation orchestration.

### Testing safety-net

- `vitest` является базовым test runner для `apps/api`, `apps/web`, `apps/worker` и `packages/shared`.
- `@testing-library/*` используется для component/unit coverage во frontend.
- `supertest` используется для controller-level HTTP boundary tests в API.
- Backend refactoring выполняется под unit + integration safety-net, а frontend migration под component/runtime-parsing safety-net.

### Build and environment guardrails

- `apps/api` и `apps/worker` не должны собираться на хосте напрямую; backend build/typecheck выполняется только в Docker-контуре.
- Production deploy runbook и эксплуатационные детали не дублируются здесь и хранятся в `DEVELOPMENT.md` и `deploy/README.md`.

## Recommended Stack (`Implemented/Planned`)

### Runtime contracts and validation

- `zod` (`Implemented/Planned`):
  - `Implemented`: shared contracts, runtime parsing и boundary validation уже используются в части API/web срезов.
  - `Planned`: дальнейшее расширение contract coverage на остальные transport boundaries.
- `nestjs-zod` (`Planned`):
  - допустим как bridge-слой для NestJS, если он упростит локальный custom pipe слой без потери контроля над legacy compatibility.

### Frontend server-state and UI safety-net

- `@tanstack/react-query` (`Implemented/Planned`):
  - `Implemented`: это основной server-state слой для переведённых frontend-срезов.
  - `Planned`: расширение покрытия на remaining read-heavy/client-interactive экраны.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` (`Implemented/Planned`):
  - `Implemented`: baseline component/runtime coverage уже используется в `apps/web`.
  - `Planned`: дальнейшее уплотнение coverage для критичных hooks/helpers и новых migration slices.

### Backend safety-net

- `supertest` (`Implemented/Planned`):
  - `Implemented`: controller-level HTTP boundary tests уже используются для ключевых backend-срезов.
  - `Planned`: дальнейшее расширение integration coverage на remaining backend boundaries.

### Optional guardrails

- `dependency-cruiser` (`Planned`):
  - может быть добавлен только если текущего `eslint-plugin-boundaries` недостаточно для контроля drift по dependency graph.

## Приоритеты качества (`Implemented`)

- `Correctness` и доменные инварианты важнее скорости поставки.
- `Security` и предсказуемость boundary behavior важнее локальной удобности.
- Простая читаемость и объяснимый flow важнее искусственной декомпозиции ради метрик.
- Линтеры и budgets являются ограничителями риска, а не KPI.

## Anti-Gaming Rules (`Implemented`)

- Запрещено ухудшать код ради формального прохождения линтера или лимитов размера.
- Legacy-код улучшается ratchet-подходом: не ухудшать и инкрементально выпрямлять при каждом касании.
- Exception-допуски должны быть редкими, локальными и обоснованными.
- Если информация относится к runbook или журналу выполнения, она не должна попадать в этот документ.

## Связанные документы (`Implemented`)

- Архитектурная карта: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Frontend SoR: [FRONTEND.md](./FRONTEND.md)
- Development runbook: [DEVELOPMENT.md](./DEVELOPMENT.md)
- Активные и завершённые execution plans: `documents/exec-plans/`
