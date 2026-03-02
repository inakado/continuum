# 2026-03-02 — Performance profiling and targeted optimization

Статус: `Active`

## Цель

Найти самые дорогие hot-path проекта, доказать bottleneck измерениями и только после этого переходить к точечной оптимизации.

Эта инициатива не про “ускорить всё подряд”. Она про measurement-first подход:
- сначала обнаруживаем узкое место;
- потом снимаем baseline;
- потом делаем минимально достаточную правку;
- потом повторно измеряем эффект.

## Контекст

Архитектурный cleanup завершён отдельной инициативой:
- `documents/exec-plans/completed/2026-03-01-architecture-alignment-tail-refactor.md`

На текущем состоянии:
- lint/typecheck/tests/docs-check зелёные;
- manual boundary parsing и manual server-state хвосты убраны;
- основные крупные structural hotspots уже декомпозированы;
- отдельного встроенного performance-tooling контура в репозитории нет, значит profiling строим на существующей инфраструктуре.

Зафиксированный baseline-контур:
- основной profiling-контур: `local + Docker`;
- спорные findings при необходимости подтверждаем на staging-like окружении.

## Scope

### In scope

- analysis и profiling для hot user flows:
  - `student dashboard`
  - `teacher dashboard`
  - `teacher section graph`
  - `teacher unit editor`
  - `student unit detail` при подтверждённом hot-path
  - `teacher students/profile/review` при подтверждённом hot-path
- выявление bottleneck по трём уровням:
  - network
  - React render
  - backend/API/DB
- точечные оптимизации только после baseline-замеров;
- фиксация findings, triage и shortlist optimization targets.

### Out of scope

- новый архитектурный refactor без подтверждённого performance bottleneck;
- массовая micro-optimization “на всякий случай”;
- произвольное добавление memoization/cache hacks без baseline и re-measurement;
- переписывание экранов/сервисов только потому, что они “большие”, если profiling не показывает user-visible pain.

## Measurement-first принципы

1. Сначала обнаруживаем узкое место, потом оптимизируем.
2. Любая optimization wave начинается с baseline-замера и заканчивается повторным замером.
3. Архитектурный smell не считается performance issue без подтверждённого bottleneck.
4. Если проблема не измерена, она не считается доказанным optimization target.
5. Один случайный прогон не считается репрезентативной метрикой.
6. Если правка не даёт измеримого выигрыша, она не считается успешной optimization wave.

## Что считаем узким местом

Узкое место фиксируется только если есть измеримое подтверждение хотя бы одного класса:

### `network-bound`

- экран ждёт сеть;
- есть waterfall;
- есть дублирующиеся запросы;
- есть лишние refetch после navigation/mutation.

### `render-bound`

- React commit/render cost заметно большой;
- subtree ререндерится слишком часто;
- interaction тормозит после ввода, drag, save, tab switch.

### `backend-bound`

- hot endpoint сам по себе медленный;
- есть тяжёлые SQL/select/include;
- есть N+1;
- есть слишком жирный payload или тяжёлый read-path ради маленького UI-фрагмента.

### `mixed`

- и сеть, и frontend render, и/или backend дают ощутимую суммарную задержку.

## Приоритетные user flows для анализа

### Волна 1 — самые важные сценарии

1. `student dashboard`
2. `teacher dashboard`
3. `teacher section graph`
4. `teacher unit editor`

### Волна 2 — условные hot-path, если подтвердятся по данным

1. `student unit detail`
2. `teacher students list`
3. `teacher student profile`
4. `teacher review inbox/detail`

## Что именно ищем в каждом flow

### 1. Student dashboard

Ищем:
1. лишние `course/section` refetch;
2. повторные запросы при возврате между views;
3. избыточные rerender при переходах `courses -> sections -> graph`;
4. медленное восстановление состояния из navigation/history/query.

Потенциальные классы bottleneck:
- `network-bound`
- `render-bound`
- `mixed`

### 2. Teacher dashboard

Ищем:
1. waterfall при открытии `course/section/edit mode`;
2. лишние `invalidate/refetch` после `create/publish/delete`;
3. дорогие rerender корневого screen shell;
4. тяжёлые mutation aftermath flows.

Потенциальные классы bottleneck:
- `network-bound`
- `mixed`

### 3. Teacher section graph

Ищем:
1. дорогой initial graph hydrate;
2. `selection`-triggered rerender storm;
3. `save graph` overhead;
4. стоимость local editable graph state;
5. нагрузку на graph payload.

Потенциальные классы bottleneck:
- `render-bound`
- `mixed`

### 4. Teacher unit editor

Ищем:
1. долгую загрузку `unit/task/revision/editor state`;
2. дорогие `preview/statement/solution` flows;
3. лишние refetch после `save/publish`;
4. тяжёлые rerender editor subtree;
5. latency compile-related flows, если они попадают в hot-path.

Потенциальные классы bottleneck:
- `mixed`
- `backend-bound`

### 5. Student unit detail

Берём только если он реально всплывает как hot-path в первой волне.

Ищем:
1. initial load cost;
2. task navigation cost;
3. preview/render cost;
4. photo/attempt follow-up refetch patterns.

## Методика анализа по каждому flow

## Шаг 1. Зафиксировать сценарий и user-perceived latency

Для каждого flow формируем карточку анализа:

1. название сценария;
2. стартовая точка;
3. ожидаемое действие пользователя;
4. что считается “медленно”;
5. где пользователь ждёт:
   - `initial load`
   - `navigation`
   - `mutation/save`
   - `graph interaction`
   - `preview/render`

Шаблон карточки:

```md
### Flow: <name>
- Start: <route / screen / state>
- User action: <what the user does>
- Expected result: <what should happen>
- Slow if: <user-visible threshold or symptom>
- Observed wait points:
  - initial load
  - navigation
  - mutation/save
  - graph interaction
  - preview/render
```

## Шаг 2. Network profiling

Инструмент:
- Chrome DevTools Network в локальном браузере.

Что делаем:
1. открываем сценарий с чистого состояния;
2. снимаем waterfall запросов;
3. повторяем сценарий со “второго захода” для оценки кэша;
4. отдельно снимаем mutation-сценарий;
5. если flow связан с auth, используем уже рабочий cookie-first login path.

Что фиксируем:
1. список запросов по сценарию;
2. длительность каждого запроса;
3. последовательность/параллельность;
4. повторные одинаковые запросы;
5. refetch после mutation;
6. размер response payload;
7. `TTFB` и `total duration` для самых дорогих запросов.

Что считаем проблемой:
1. длинная последовательная цепочка запросов;
2. duplicate fetch одного и того же ресурса;
3. full-refetch после локального действия, где хватило бы `invalidate/update cache`;
4. тяжёлый payload без пользы для текущего экрана.

Результат шага:
- первичная гипотеза `network-bound` или `mixed`.

Шаблон фиксации:

```md
#### Network baseline
- Requests:
  - GET /...
  - GET /...
- Waterfall: <yes/no + explanation>
- Duplicate fetch: <yes/no>
- Refetch after mutation: <yes/no>
- Largest payload: <endpoint + size if known>
- Slowest request: <endpoint + TTFB + total>
- Hypothesis: <network-bound | mixed | none>
```

## Шаг 3. React render profiling

Инструмент:
- React DevTools Profiler.

Что делаем:
1. профилируем initial render сценария;
2. профилируем interaction:
   - `click`
   - `expand`
   - `drag`
   - `save`
   - `tab switch`
3. сравниваем, какие subtree реально commit-ятся.

Что фиксируем:
1. длительность commit;
2. какие компоненты ререндерятся;
3. какие компоненты ререндерятся без явной пользы;
4. где есть expensive derived state;
5. где взаимодействие блокируется тяжёлым render.

Что считаем проблемой:
1. одно локальное действие перерисовывает почти весь экран;
2. graph/editor subtree массово commit-ится на каждый небольшой input;
3. derived state пересчитывается слишком широко;
4. selection/navigation вызывает дорогой полный rerender.

Результат шага:
- гипотеза `render-bound` или `mixed`.

Шаблон фиксации:

```md
#### React render baseline
- Profiled action: <action>
- Expensive commits: <list / duration>
- Large rerender surface: <yes/no + components>
- Derived state hotspot: <yes/no + location>
- Interaction stall: <yes/no + symptom>
- Hypothesis: <render-bound | mixed | none>
```

## Шаг 4. Backend/API profiling

Контур:
- Docker `api`.

Что делаем:
1. выделяем 1-3 самых дорогих endpoint из network profile;
2. измеряем их отдельно в повторяемом виде;
3. если нужно, идём на уровень Prisma/SQL path;
4. смотрим handler/service/read-path только для уже подтверждённых hot endpoints.

Что фиксируем:
1. endpoint;
2. duration;
3. payload shape;
4. что он грузит из БД;
5. есть ли тяжёлые `include/select`;
6. есть ли повторные запросы и `N+1`;
7. есть ли ненужные `recompute/side effects` на read-path.

Инструменты и подход:
1. `curl` / browser request baseline;
2. точечный просмотр `handler/service/read-path`;
3. при необходимости точечные DB-замеры для конкретного hotspot;
4. при необходимости временный диагностический замер, но только как отдельная маленькая задача, не в слепую по всему API.

Что считаем проблемой:
1. слишком тяжёлый endpoint относительно сценария;
2. лишние relation loads;
3. `N+1`;
4. тяжёлый read-path ради маленького UI-фрагмента;
5. `recompute/side effects` на горячем read-path.

Результат шага:
- гипотеза `backend-bound` или `mixed`.

Шаблон фиксации:

```md
#### Backend/API baseline
- Hot endpoint: <method route>
- Repeated duration: <range>
- Heavy relations/selects: <yes/no>
- N+1 suspicion: <yes/no>
- Read-path notes: <handler/service summary>
- Hypothesis: <backend-bound | mixed | none>
```

## Шаг 5. Классификация и ранжирование bottleneck

После трёх видов профилинга каждый flow получает итоговую карточку:

1. `flow`
2. `user pain`
3. `bottleneck class`
4. `primary cause`
5. `secondary cause`
6. `estimated optimization leverage`
7. `risk of change`

### Правило ранжирования

Сначала берём те точки, где одновременно:
1. high-frequency сценарий;
2. явная пользовательская задержка;
3. bottleneck подтверждён;
4. изменение локально и не требует нового архитектурного redesign.

### Формула приоритета

Используем простую шкалу `1..5` по каждому параметру:
1. `frequency`
2. `user pain`
3. `measured cost`
4. `fix leverage`
5. `change risk` со знаком минус

Формула:

`priority = (frequency + user pain + measured cost + fix leverage) - change risk`

Это используется не как строгая математика, а как анти-шум фильтр, чтобы не оптимизировать красивую, но редкую проблему раньше частого горячего сценария.

Шаблон shortlist:

```md
## Bottleneck shortlist

| Flow | Class | Frequency | Pain | Cost | Leverage | Risk | Priority | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| teacher section graph | render-bound | 4 | 5 | 5 | 4 | 2 | 16 | node select rerender storm |
```

## Как оформляем findings

Для каждого подтверждённого bottleneck фиксируем:

1. `Flow`
2. `Symptom`
3. `Measured evidence`
4. `Bottleneck class`
5. `Likely root cause`
6. `Candidate fix`
7. `Expected effect`
8. `Risk`
9. `How to re-measure`

Шаблон:

```md
### Finding: <flow>
- Symptom: <what the user feels>
- Measured evidence: <numbers / profiling observation>
- Bottleneck class: <network-bound | render-bound | backend-bound | mixed>
- Likely root cause: <specific cause>
- Candidate fix: <minimal targeted change>
- Expected effect: <measurable expectation>
- Risk: <low/medium/high>
- How to re-measure: <same scenario / same tool / same dataset>
```

## Как принимаем решение “это точно стоит оптимизировать”

Оптимизация идёт в работу только если одновременно выполняется:
1. bottleneck подтверждён замером;
2. пользовательская боль заметна или сценарий частотный;
3. причина локализована;
4. есть правка с понятной областью влияния;
5. можно повторно измерить эффект.

Если этого нет:
- finding уходит в:
  - `documents/exec-plans/deferred-roadmap.md`
  - или `documents/exec-plans/tech-debt-tracker.md`

## Порядок выполнения всей инициативы

### Этап 1. Baseline audit

1. Подготовить profiling checklist для каждого flow.
2. Снять network baseline.
3. Снять React render baseline.
4. Снять API hot endpoint baseline.
5. Составить shortlist bottleneck.

### Этап 2. Triage

1. Отсортировать findings по приоритету.
2. Отделить реальные hot-path от второстепенных.
3. Выбрать 1-2 самые выгодные optimization targets.

### Этап 3. Targeted optimization

Для каждого выбранного target:
1. добавить/усилить safety-net тесты, если правка рискованная;
2. сделать минимально достаточную оптимизацию;
3. не смешивать её с большим архитектурным refactor;
4. повторно снять те же метрики.

### Этап 4. Validation

1. Сравнить baseline и post-change;
2. зафиксировать, есть ли реальный выигрыш;
3. если выигрыша нет, не считать изменение успешной optimization wave.

### Этап 5. Документация результата

1. В этом active plan фиксировать findings и результаты;
2. неактивные future findings выносить в `documents/exec-plans/deferred-roadmap.md`;
3. реальный performance debt выносить в `documents/exec-plans/tech-debt-tracker.md`;
4. после завершения перенести initiative в `completed`.

## Практический порядок стартового анализа

### Batch 1 — baseline без правок кода

1. `student dashboard`
2. `teacher dashboard`
3. `teacher section graph`
4. `teacher unit editor`

Для каждого из них:
1. network baseline;
2. render baseline;
3. shortlist hot endpoints;
4. backend baseline только для top-1/top-3 дорогих запросов.

### Batch 2 — triage

1. сравнить findings между flows;
2. выбрать top-2 optimization targets;
3. зафиксировать, что остаётся вне активной оптимизации.

### Batch 3 — optimization slices

Каждый optimization target идёт отдельным инкрементом:
1. tests;
2. minimal fix;
3. re-measurement;
4. verification.

## Проверки и валидация во время optimization wave

### Обязательные проверки после каждой optimization-правки

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm docs:check`, если менялись docs

### Для backend-sensitive optimization

1. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"`
2. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`

### Для frontend-sensitive optimization

1. targeted `web` suite на затронутый flow
2. `pnpm --filter web typecheck`
3. `pnpm --filter web lint`

## Публичные интерфейсы и контракты

На этапе анализа и поиска bottleneck:
- публичные API не меняются;
- runtime behavior не меняется;
- schema/contracts не меняются.

Если в optimization wave понадобится изменение интерфейсов:
- это должно быть отдельным решением внутри конкретного optimization slice;
- с явной причиной, совместимостью и повторным измерением результата.

## Минимальные тестовые сценарии для baseline-аудита

Нужно пройти и повторяемо снять baseline минимум для:

### `student dashboard`
- initial load
- navigation `courses -> sections -> graph`
- возврат назад

### `teacher dashboard`
- initial load
- open course
- open section
- create/publish action

### `teacher section graph`
- initial graph load
- select node
- create unit
- save graph

### `teacher unit editor`
- initial load
- task/revision navigation
- save/publish path
- preview-related path, если он попадает в основной сценарий

## Критерии завершения анализа

1. Для всех приоритетных flow есть baseline measurements.
2. Для каждого найденного bottleneck указан класс:
   - `network-bound`
   - `render-bound`
   - `backend-bound`
   - `mixed`
3. Есть ранжированный shortlist optimisation targets.
4. Для каждого target понятен expected win и способ re-measurement.
5. Нет optimization work “на глаз” без измерений.

## Явные допущения и выбранные defaults

1. Основной profiling-контур: `local + Docker`.
2. Browser profiling делаем локально через DevTools и React Profiler.
3. Backend bottleneck сначала локализуем по endpoint/service-path, а не начинаем сразу с широкого DB instrumentation.
4. Сначала ищем 1-2 самых выгодных optimization target, а не пытаемся профилировать весь проект одинаково глубоко.
5. Если finding не подтверждён измерениями, он не идёт в implementation.
6. Если hot-path окажется спорным, подтверждаем его отдельно на staging-like окружении.
