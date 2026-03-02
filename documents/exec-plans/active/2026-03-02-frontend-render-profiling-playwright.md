# 2026-03-02 — Frontend render profiling via Playwright

Статус: `Active`

## Цель

Снять подтверждённые browser-side замеры по frontend/render bottleneck через Playwright MCP/CLI и отделить реальные render-bound проблемы от уже закрытых backend/network bottleneck.

Эта инициатива не про новый архитектурный refactor. Она про повторяемые замеры в браузере:
- открыть целевой flow в реальном UI;
- снять interaction/render evidence;
- подтвердить или опровергнуть render-bound hypothesis;
- только после этого решать, нужен ли новый optimization slice.

## Контекст

Предыдущий performance plan завершён:
- `documents/exec-plans/completed/2026-03-02-performance-profiling-and-optimization.md`

Уже закрытые bottleneck:
1. `teacher unit editor initial load`
2. `student dashboard graph read-path`

Неподтверждённый остаток:
- `teacher section graph render`

Именно этот хвост и становится первым кандидатом на browser-side profiling.

## Scope

### In scope

- Playwright MCP/CLI profiling для frontend/render flows;
- фиксация browser-visible latency и interaction stalls;
- подтверждение или снятие render-bound hypothesis для:
  - `teacher section graph`
  - при необходимости `teacher dashboard`
  - при необходимости `student dashboard`/`student graph`
- сбор артефактов:
  - snapshots
  - screenshots
  - traces
  - performance timings, если их можно получить повторяемо
- подготовка shortlist только по подтверждённым render findings.

### Out of scope

- backend/network optimization без нового evidence;
- массовый frontend refactor до получения замеров;
- написание Playwright test specs вместо ad-hoc profiling;
- оптимизация “на ощущениях”.

## Инструментирование

### Основной инструмент
- Playwright MCP/CLI через skill `$playwright`

### Вспомогательные инструменты
- локальный `web` dev server
- `api` в Docker
- при необходимости browser trace/screenshot artifacts

### Рабочий принцип
1. поднять рабочий frontend контур;
2. открыть реальный flow в браузере через Playwright;
3. снять baseline interaction timings и artefacts;
4. зафиксировать hypothesis;
5. только потом решать, есть ли новый optimization target.

## Приоритетные flows

### Волна 1
1. `teacher section graph`
   - initial graph open
   - node select
   - create unit
   - save graph

### Волна 2
1. `teacher dashboard`
2. `student dashboard -> graph`

Использовать волну 2 только если wave 1 не даёт достаточного evidence или если во время profiling всплывает вторичный hotspot.

## Measurement checklist

Для каждого flow фиксировать:
1. route/screen
2. action
3. expected UX
4. observed lag/symptom
5. browser evidence
6. suspected cause
7. next action

Шаблон:

```md
### Flow: <name>
- Start: <route>
- Action: <interaction>
- Expected: <what should happen>
- Observed: <lag / no lag>
- Evidence:
  - snapshot
  - trace
  - screenshot
  - timing
- Hypothesis: <render-bound | mixed | none>
- Next step: <implement / defer / measure more>
```

## Порядок выполнения

### Шаг 1. Подготовка контура
1. проверить `npx`
2. поднять `web` dev server на стабильном порту
3. проверить доступность `/login`
4. подготовить Playwright wrapper (`$PWCLI`)

### Шаг 2. Teacher section graph baseline
1. открыть login flow
2. войти teacher user
3. дойти до `teacher section graph`
4. снять:
   - snapshot до interaction
   - screenshot
   - trace/perf artefact, если доступно
5. повторить actions:
   - select node
   - create unit
   - save graph
6. зафиксировать, есть ли user-visible lag и где именно

### Шаг 3. Triage
1. если `teacher section graph` подтверждён как render-bound — подготовить отдельный optimization slice
2. если не подтверждён — не оптимизировать его
3. при необходимости перейти к wave 2 (`teacher dashboard`, `student dashboard graph`)

### Шаг 4. Документация результата
1. зафиксировать findings в этом active plan
2. подтверждённый optimization target оставить в active plan
3. неподтверждённый residual finding вынести в `deferred-roadmap.md`

## Acceptance criteria

1. Есть воспроизводимый browser-side baseline для `teacher section graph`
2. Есть evidence, подтверждающее или снимающее render-bound hypothesis
3. Если найден новый bottleneck, он локализован до конкретного interaction
4. Если bottleneck не подтверждён, optimization work не начинается

## Проверки

1. `pnpm docs:check`
2. после возможных кодовых правок:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
3. если profiling затрагивает backend use-case verification:
   - `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`

## Decision log

1. Playwright/CLI используется как primary tooling для browser-side measurements.
2. До нового подтверждённого evidence код не меняется.
3. `teacher section graph` — первый и главный render-profiling candidate.

## Baseline findings (`Implemented`)

### Flow: `teacher section graph`

- Start: `/teacher` -> course -> section graph
- Action: initial graph open
- Expected: graph открывается без ошибок, graph-shell готов к interaction
- Observed:
  - flow воспроизводим;
  - login и route до graph стабильны только на `web` origin `http://localhost:3001`;
  - запуск `web` на `3002` дал CORS-failure на `/auth/login`, потому что dev API allowlist завязан на `WEB_PORT=3001`
- Evidence:
  - snapshot: `output/playwright/teacher-section-graph-page.yml`
  - screenshot: `output/playwright/teacher-section-graph-baseline.png`
  - console: `output/playwright/teacher-section-graph-console.log`
- Hypothesis: baseline собран; network/backend bottleneck на этапе открытия не подтверждён
- Next step: проверить отдельные interactions

### Flow: `teacher section graph`

- Start: открытый section graph
- Action: `select node`
- Expected: node selectable обычным pointer click
- Observed:
  - Playwright не может кликнуть по node;
  - click стабильно падает с `pointer events intercepted` от wrapper:
    - `teacher-section-graph-panel-module__iZLU_q__wrapper intercepts pointer events`
- Evidence:
  - Playwright click failure на ref `e167`
  - wall-time команды: `~7.33s` до timeout
  - это не latency, а interaction failure/overlay interception
- Hypothesis: не confirmed render-bound slowdown; есть подтверждённая interaction bug / layering issue в graph shell
- Next step: подготовить отдельный optimization/bugfix slice именно под `node select` interaction

### Flow: `teacher section graph`

- Start: открытый section graph
- Action: `create unit`
- Expected: modal открывается быстро и стабильно
- Observed:
  - modal `Создание юнита` открывается корректно;
  - явного browser-side stall не видно
- Evidence:
  - snapshot после открытия modal
  - wall-time команды: `~4.91s` с учётом Playwright CLI overhead
- Hypothesis: create-unit path не подтверждён как hotspot
- Next step: не оптимизировать без дополнительного evidence

### Flow: `teacher section graph`

- Start: открытый section graph
- Action: `save graph`
- Expected: save проходит без видимого подвисания
- Observed:
  - save проходит;
  - явного browser-side stall не подтверждено
- Evidence:
  - snapshot после save
  - wall-time команды: `~4.01s` с учётом Playwright CLI overhead
- Hypothesis: save-path не подтверждён как render hotspot
- Next step: не оптимизировать без дополнительного evidence

## Secondary findings (`Implemented`)

1. В console стабильно воспроизводятся предупреждения React Flow:
   - `you've created a new nodeTypes or edgeTypes object`
2. В modal `Создание юнита` есть accessibility warning:
   - missing `Description` / `aria-describedby`
3. Playwright CLI trace для этой сессии оказался ненадёжным:
   - `tracing-stop` упал с `Cannot read properties of undefined (reading 'tracesDir')`
   - для текущей инициативы это не blocker, потому что snapshot/screenshot/console и interaction failure уже достаточны

## Re-triage result (`Implemented`)

1. `teacher section graph` не подтверждён как общий render-bound hotspot.
2. Подтверждён более узкий и важный finding:
   - `teacher section graph node select` ломается/деградирует на уровне pointer interaction.
3. `create unit` и `save graph` не дают достаточного evidence для performance slice.
4. Следующий правильный шаг:
   - не продолжать широкий profiling wave,
   - а открыть отдельный небольшой optimization/bugfix slice под graph node interaction + React Flow warning cleanup.

## Fix slice: `teacher section graph node interaction` (`Planned`)

### Root cause summary

Подтверждённый root cause сейчас не в общем render-cost, а в graph-shell layout:
1. `ReactFlow` использует `fitView` без явного safe padding под overlay chrome.
2. Поверх graph viewport лежат абсолютные UI-слои:
   - toolbar;
   - selection hint;
   - loading/empty overlays.
3. Верхняя часть graph оказывается в зоне перекрытия, и pointer interaction по node становится нестабильным.
4. Дополнительный, но вторичный хвост:
   - `React Flow` warning про новый `nodeTypes/edgeTypes object` на render.

### Цель фикса

Сделать `node select` стабильным и убрать очевидный graph-shell drift без изменения UX-семантики:
- node должен открываться обычным click;
- graph должен fit-иться в безопасную видимую область;
- `nodeTypes/edgeTypes` не должны создаваться заново по ходу render-path;
- create/save flows должны остаться совместимыми.

### Scope

#### In scope

1. `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.tsx`
2. `apps/web/features/teacher-dashboard/teacher-section-graph-panel.module.css`
3. `apps/web/features/teacher-dashboard/TeacherSectionGraphPanel.test.tsx`

#### Out of scope

1. Новый большой refactor dashboard.
2. Изменение backend graph API.
3. Общая performance wave по graph, если interaction fix уже снимает проблему.
4. Массовая переделка accessibility поверх всего dashboard; допускается только точечный fix dialog warning, если он рядом и безопасен.

### Что меняем

#### 1. Safe viewport for graph

Сделать `fitView` осознанным:
- добавить `fitViewOptions` с padding;
- при необходимости использовать asymmetric padding / initial viewport strategy, чтобы верхние node не попадали под toolbar.

Если одним `fitViewOptions` проблема не уходит, второй шаг:
- уменьшить фактическое перекрытие toolbar поверх canvas;
- зарезервировать верхнюю интерактивную область через layout/CSS.

#### 2. Overlay hygiene

Проверить pointer behavior у overlay-элементов:
- toolbar должен быть интерактивным только в своей зоне;
- non-interactive shell не должен перехватывать pointer events над graph;
- `selectionHint`, `loading`, `empty` должны явно вести себя как intended.

Цель:
- graph viewport остаётся clickable везде, где нет реально активного control.

#### 3. React Flow warning cleanup

Устранить предупреждение:
- `you've created a new nodeTypes or edgeTypes object`

Текущие константы уже вынесены, но warning остаётся. Значит надо проверить:
- не создаётся ли новый object по пути adapter/render;
- не нужен ли ещё более жёсткий stable reference вне текущего модуля/рендера;
- не даёт ли ложный warning dev path из-за конкретной конфигурации `ReactFlow`.

Это вторичный шаг:
- не должен подменять root cause работы с pointer interaction.

### Safety-net before fix

Перед правкой расширить тестовый контур так, чтобы он ловил именно текущую проблему слоя/interaction:

1. test на стабильный `node click -> router.push('/teacher/units/:id')`
2. test на отсутствие поломки create-unit dialog
3. test на отсутствие поломки save graph flow
4. если понадобится — отдельно test на props `fitViewOptions` / graph shell contract через mock `reactflow`

Важно:
- не делать декоративные тесты;
- тесты должны защищать именно interaction contract и отсутствие регрессии.

### Порядок реализации

1. Уточнить minimal failing interaction contract в test contour.
2. Внести минимальный graph-shell fix:
   - viewport padding / fit behavior;
   - pointer-events hygiene.
3. Повторно прогнать web tests/lint/typecheck.
4. Повторить Playwright baseline минимум для:
   - open section graph
   - click node
5. Только если `node click` стабилен, считать slice завершённым.

### Acceptance criteria

1. `node select`/`node click` в `teacher section graph` стабилен в браузере.
2. `create unit` и `save graph` не ломаются.
3. Playwright больше не воспроизводит pointer-interception failure на node click.
4. Если `React Flow` warning можно убрать безопасно — он убран; если нет, причина явно зафиксирована.
5. Нет изменений backend/API contracts.
