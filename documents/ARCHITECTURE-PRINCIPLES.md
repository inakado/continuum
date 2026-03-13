# ARCHITECTURE-PRINCIPLES.md

Назначение: стабильные инженерные принципы, quality guardrails и архитектурные ограничения для эволюции кода.

## Архитектурные принципы

### Core

- **P1. SRP + complexity budget**: модуль и файл должны иметь одну главную ответственность; большие orchestration-блоки декомпозируются до читабельных units.
- **P2. Contract-first**: transport/runtime-контракты описываются один раз и переиспользуются между API и web.
- **P3. Fail-fast boundary validation**: все внешние входы валидируются на boundary до попадания в доменные сервисы.
- **P4. Read/write separation**: read-path и write-path не смешиваются в одном orchestration без явной причины.
- **P5. Typed mapping**: преобразования DB/API/UI выполняются явными mapper-функциями без протекания `any` и неконтролируемого `unknown`.
- **P6. Unified error semantics**: пользовательские и интеграционные ошибки проходят через единый `code/message/details` contract.
- **P7. Policy-as-code**: TTL, asset rules, queue limits и аналогичные правила выносятся в централизованные policy/helper слои.
- **P8. Convention over duplication**: повторяющиеся cross-cutting patterns оформляются как общие примитивы, а не копируются по контроллерам и экранам.

### Frontend

- **P9. Server-state discipline**: сетевые данные живут в выделенном server-state слое, а не в произвольных `useState/useEffect`.
- **P10. Effect isolation**: async orchestration и побочные эффекты выносятся в hooks и helper-слои; UI остаётся декларативным.
- **P11. Server-first rendering by default**: client boundaries вводятся только там, где действительно нужна интерактивность.
- **P12. Dependency rule enforcement**: архитектурные границы слоёв и features проверяются автоматически, а не только договорённостью.

## Current Guardrails

### Quality contour

- В monorepo используются `eslint`, `@typescript-eslint/*` и `eslint-plugin-boundaries`.
- Workspace lint запускается через `pnpm lint`.
- Архитектурные импорт-границы проверяются отдельной командой `pnpm lint:boundaries`.
- CI использует эти проверки как обязательный quality gate.
- Для frontend feature-layer дополнительно enforced:
  - запрет cross-import между `apps/web/features/student-*` и `apps/web/features/teacher-*`;
  - запрет прямого импорта `@/components/DashboardShell` из role-specific feature-кода (используются role-specific shell wrappers).

### Contracts and boundary validation

- В репозитории `zod` является базовым runtime/schema слоем для shared contracts и parsing.
- В `apps/api` boundary validation на выбранных срезах реализована через custom `ZodValidationPipe`.
- В `apps/web` runtime parsing ответов выполняется через shared contracts и fail-fast API client helpers.

### Server-state discipline

- В `apps/web` принят `@tanstack/react-query` как основной server-state слой.
- Query keys и invalidation строятся через централизованный query helper слой.
- Query-driven flows заменяют ручные anti-race паттерны там, где их может закрыть query lifecycle.

### Testing safety-net

- `vitest` является базовым test runner для `apps/api`, `apps/web`, `apps/worker` и `packages/shared`.
- `@testing-library/*` используется для component/unit coverage во frontend.
- `supertest` используется для controller-level HTTP boundary tests в API.
- Refactor выполняется под unit/component/integration safety-net, а не “вслепую”.

### Build and environment guardrails

- `apps/api` и `apps/worker` не должны собираться на хосте напрямую; backend build/typecheck выполняется только в Docker-контуре.
- Production deploy runbook и эксплуатационные детали хранятся в `documents/DEVELOPMENT.md` и `deploy/README.md`, а не здесь.

## Approved Stack

### Runtime contracts and validation

- `zod` — approved для shared contracts, boundary validation и runtime parsing.
- В Nest boundary layer текущий approved bridge — custom `ZodValidationPipe`.

### Frontend server-state and UI safety-net

- `@tanstack/react-query` — approved server-state слой для web.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` — approved frontend test stack.

### Backend safety-net

- `supertest` — approved для controller-level HTTP boundary tests.

## Quality Priorities

- `Correctness` и доменные инварианты важнее скорости поставки.
- `Security` и предсказуемость boundary behavior важнее локальной удобности.
- Простая читаемость и объяснимый flow важнее искусственной декомпозиции ради метрик.
- Линтеры и budgets являются ограничителями риска, а не KPI.

## Anti-Gaming Rules

- Запрещено ухудшать код ради формального прохождения линтера или лимитов размера.
- Legacy-код улучшается ratchet-подходом: не ухудшать и инкрементально выпрямлять при каждом касании.
- Exception-допуски должны быть редкими, локальными и обоснованными.
- Информация о runbook, истории выполнения и rollout не должна попадать в этот документ.

## Related Docs

- Архитектурная карта: `documents/ARCHITECTURE.md`
- Frontend SoR: `documents/FRONTEND.md`
- Development runbook: `documents/DEVELOPMENT.md`
- Active/completed execution plans: `documents/exec-plans/`
