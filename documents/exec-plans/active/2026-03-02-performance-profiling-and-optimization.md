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
- `lint/typecheck/tests/docs-check` зелёные;
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
4. медленное восстановление состояния из `navigation/history/query`.

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

### Шаг 1. Зафиксировать сценарий и user-perceived latency

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

### Шаг 2. Network profiling

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

### Шаг 3. React render profiling

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

### Шаг 4. Backend/API profiling

Контур:
- Docker `api`.

Что делаем:
1. выделяем 1-3 самых дорогих endpoint из network profile;
2. измеряем их отдельно в повторяемом виде;
3. если нужно, идём на уровень Prisma/SQL path;
4. смотрим `handler/service/read-path` только для уже подтверждённых hot endpoints.

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

### Шаг 5. Классификация и ранжирование bottleneck

После трёх видов профилинга каждый flow получает итоговую карточку:

1. `flow`
2. `user pain`
3. `bottleneck class`
4. `primary cause`
5. `secondary cause`
6. `estimated optimization leverage`
7. `risk of change`

#### Правило ранжирования

Сначала берём те точки, где одновременно:
1. high-frequency сценарий;
2. явная пользовательская задержка;
3. bottleneck подтверждён;
4. изменение локально и не требует нового архитектурного redesign.

#### Формула приоритета

Используем простую шкалу `1..5`:
1. `frequency`
2. `user pain`
3. `measured cost`
4. `fix leverage`
5. `change risk` со знаком минус

Приоритет = `(frequency + user pain + measured cost + fix leverage) - change risk`

## Baseline findings (`Implemented`)

### Flow: student dashboard
- Start: `/student`
- User action: открыть список курсов, затем курс и graph для published section
- Expected result: быстрый переход `courses -> sections -> graph`
- Slow if: graph открывается с заметной задержкой по сравнению с `courses`/`course`
- Observed wait points:
  - `graph initial load`

#### Network baseline
- Requests:
  - `GET /courses`
  - `GET /courses/:id`
  - `GET /sections/:id/graph`
- Waterfall: умеренный, но основной lag сидит в `graph`
- Duplicate fetch: не подтверждён как primary issue
- Largest payload: `GET /sections/:id/graph` не тяжёлый, около `1.9 KB`
- Slowest request:
  - `GET /sections/:id/graph` ≈ `145–216 ms` на тёплых прогонах
  - cold run доходил до `~462 ms`
- Hypothesis: `backend-bound`

#### Backend/API baseline
- Hot endpoint: `GET /sections/:id/graph`
- Repeated duration: `~145–216 ms`, cold `~462 ms`
- Heavy relations/selects: payload маленький, значит проблема не в transport size
- N+1 suspicion: не доказан напрямую
- Read-path notes:
  - `LearningService.getPublishedSectionGraphForStudent()`
  - вызывает `contentService.getPublishedSectionGraph(sectionId)`
  - затем `learningAvailabilityService.recomputeSectionAvailability(studentId, sectionId)`
- Hypothesis: `backend-bound`

### Flow: teacher dashboard
- Start: `/teacher`
- User action: открыть курс, раздел, graph и unit editor
- Expected result: быстрый initial load и предсказуемая навигация
- Slow if: unit editor открывается заметно медленнее остальных teacher flows
- Observed wait points:
  - `unit editor initial load`

#### Network baseline
- Requests:
  - `GET /teacher/courses`
  - `GET /teacher/courses/:id`
  - `GET /teacher/sections/:id/graph`
  - `GET /teacher/units/:id`
  - `GET /teacher/sections/:id`
  - `GET /teacher/courses/:id`
- Waterfall: подтверждён на unit editor path: `unit -> section -> course`
- Duplicate fetch: не primary issue
- Largest payload:
  - `GET /teacher/units/:id` ≈ `53 KB`
  - `GET /teacher/sections/:id` ≈ `50 KB`
- Slowest requests:
  - `GET /teacher/units/:id` cold `~437 ms`, тёплые `~53–129 ms`
  - `GET /teacher/sections/:id` cold `~187–240 ms`, тёплые `~32–77 ms`
- Hypothesis: `mixed`, primary cause ближе к `backend-bound + waterfall`

#### Backend/API baseline
- Hot endpoints:
  - `GET /teacher/units/:id`
  - `GET /teacher/sections/:id`
- Repeated duration:
  - `teacher_unit`: `~53–129 ms`, cold `~437 ms`
  - `teacher_section`: `~32–77 ms`, cold `~187–240 ms`
- Heavy relations/selects: подтверждены
- N+1 suspicion: не primary issue
- Read-path notes:
  - `ContentService.getSection(id)` делает `include: { units: { orderBy: { sortOrder: 'asc' } } }`
  - `useTeacherUnitFetchSave` использует `sectionQuery` только ради `section.title` и `section.courseId`
  - значит current `teacher section` payload для unit editor — явный overfetch
- Hypothesis: `mixed` с primary cause `overfetch + waterfall`

#### Payload inspection
- `teacher unit` payload: `53286 bytes`
- `teacher section` payload: `50229 bytes`
- `teacher graph` payload: `1965 bytes`
- `student graph` payload: `1939 bytes`

Ключевые наблюдения:
- `teacher section` response несёт `units[]` с тяжёлым `theoryRichLatex`
- в конкретном baseline `sectionUnitFieldMass.theoryRichLatexChars ≈ 34951`
- для unit editor этот payload не нужен: экран использует только `section.title` и `courseId`
- `teacher unit` payload сам по себе тяжёлый, но в нём есть реально нужные editor data: `tasks`, `revisions`, `theoryRichLatex`, `solutionLatex`

### Flow: teacher section graph
- Start: teacher graph screen
- User action: открыть graph, выбирать nodes, сохранять layout
- Expected result: отзывчивый UI без заметной задержки при interaction
- Slow if: есть lag на selection/save
- Observed wait points:
  - пока не подтверждены backend-метриками

#### Network baseline
- `GET /teacher/sections/:id/graph` ≈ `26–72 ms` на повторных прогонах
- payload маленький, около `2 KB`
- Hypothesis: backend не является primary hotspot

#### Working hypothesis
- если здесь есть реальная задержка, она вероятнее `render-bound`, а не `backend-bound`
- browser-side render profiling отложен на следующий подэтап

## Shortlist bottleneck (`Implemented`)

### 1. Teacher unit editor initial load
- User pain: `4/5`
- Bottleneck class: `mixed`
- Primary cause: `teacher section` overfetch + waterfall `unit -> section -> course`
- Secondary cause: тяжёлый `teacher unit` payload
- Estimated optimization leverage: `5/5`
- Risk of change: `2/5`
- Priority score: `(5 + 4 + 5 + 5) - 2 = 17`

### 2. Student dashboard graph load
- User pain: `4/5`
- Bottleneck class: `backend-bound`
- Primary cause: дорогой student graph read-path при маленьком payload
- Secondary cause: вероятный computation cost в `recomputeSectionAvailability(...)`
- Estimated optimization leverage: `4/5`
- Risk of change: `3/5`
- Priority score: `(5 + 4 + 4 + 4) - 3 = 14`

### 3. Teacher section graph render
- User pain: `3/5`
- Bottleneck class: `unconfirmed`, likely `render-bound`
- Primary cause: pending render baseline
- Estimated optimization leverage: `3/5`
- Risk of change: `3/5`
- Статус: `Deferred until first two hotspots are re-measured`

## Точный план optimization wave
### Slice 1 — Teacher unit editor initial load (`Implemented`)

#### Почему этот slice первый
- это самый дорогой подтверждённый hot-path;
- bottleneck уже локализован;
- можно улучшить локально без изменения текущего UX;
- можно доказать эффект повторным baseline-замером.

#### Что меняем

##### A. Убираем overfetch в `GET /teacher/sections/:id` для unit editor use-case

Текущая проблема:
- `ContentService.getSection(id)` возвращает `units[]` целиком;
- unit editor использует `sectionQuery` только ради `section.title` и `section.courseId`.

Зафиксированное решение:
- **не менять** shape существующего `GET /teacher/sections/:id`;
- добавить новый лёгкий read-model endpoint:
  - `GET /teacher/sections/:id/meta`
- новый read-model должен возвращать только:
  - `id`
  - `title`
  - `courseId`
  - `status` только если реально нужен
- без `units[]` и тяжёлых unit-полей.

##### B. Сокращаем waterfall `unit -> section -> course`

Текущая проблема:
- `useTeacherUnitFetchSave` делает последовательную цепочку:
  1. `getUnit(unitId)`
  2. `getSection(unit.sectionId)`
  3. `getCourse(section.courseId)`

Зафиксированное решение:
- в `getUnit(id)` добавить только breadcrumb-метаданные section:
  - `sectionId`
  - `section.title`
  - `section.courseId`
- **не** добавлять полный `course` и не делать новый жирный aggregate endpoint
- в web:
  - заменить full `sectionQuery` на `getSectionMeta` или metadata из `unitQuery`
  - убрать зависимость от тяжёлого `teacher section detail`
  - сократить цепочку до `unit -> course` либо использовать section metadata напрямую

##### C. Не режем `GET /teacher/units/:id` вслепую в этом slice

Решение:
- payload `teacher unit` пока оставляем совместимым;
- сначала убираем гарантированный overfetch и waterfall;
- потом снимаем повторный baseline и только после этого решаем, нужно ли дальше уменьшать `teacher unit` payload.

#### Изменения по файлам

API:
1. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/api/src/content/content.service.ts`
   - добавить `getSectionMeta(id: string)`
2. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/api/src/content/teacher-sections.controller.ts`
   - добавить `GET /teacher/sections/:id/meta`

Web:
3. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/web/lib/api/teacher.ts`
   - добавить `getSectionMeta(id)`
4. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/web/lib/query/keys.ts`
   - добавить `contentQueryKeys.teacherSectionMeta(id)`
5. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/web/features/teacher-content/units/hooks/use-teacher-unit-fetch-save.ts`
   - перевести `sectionQuery` на meta read-model
   - убрать зависимость от full section detail
   - использовать `unit.section.courseId` или `sectionMeta.courseId` для `courseQuery`

#### Тесты для Slice 1

API:
1. coverage на `GET /teacher/sections/:id/meta`
   - `200`
   - правильная форма
   - нет `units`
   - `404` для missing section

Web:
2. расширить:
   - `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/web/features/teacher-content/units/TeacherUnitDetailScreen.test.tsx`
   - и/или добавить hook test для `use-teacher-unit-fetch-save.ts`

Сценарии:
- initial load не ломается;
- breadcrumbs корректны;
- autosave не ломается;
- section/course titles не теряются;
- unit editor больше не требует full `teacher section` payload.

#### Post-change measurement (`Implemented`)
- Новый unit editor read-path:
  - `GET /teacher/units/:id`
  - `GET /teacher/sections/:id/meta`
  - `GET /teacher/courses/:id`
- Post-change baseline:
  - `GET /teacher/units/:id` ≈ `38 ms`, `53419 B`
  - `GET /teacher/sections/:id/meta` ≈ `6 ms`, `143 B`
  - `GET /teacher/courses/:id` ≈ `5 ms`, `525 B`
- Подтверждённый эффект:
  - unit editor больше не зависит от полного `GET /teacher/sections/:id` с payload около `50 KB`;
  - overfetch устранён через отдельный `section meta` read-model;
  - waterfall сокращён с `unit -> section -> course` до `unit -> course`, а `section meta` остаётся только fallback-path для совместимости.

#### Acceptance criteria для Slice 1 (`Implemented`)
1. unit editor не зависит от full `GET /teacher/sections/:id` payload;
2. новый lightweight `section meta` read-model доступен как safe fallback и отдельный cheap endpoint;
3. UX, breadcrumbs и autosave остались прежними;
4. повторный baseline подтвердил устранение `teacher section` overfetch на hot-path.

### Slice 2 — Student dashboard graph read-path (`Implemented`)

#### Почему этот slice второй
- hotspot подтверждён измерениями;
- payload маленький, значит проблема действительно в backend computation path;
- можно улучшить без изменения student UI.

#### Что меняем

Текущая проблема:
- `LearningService.getPublishedSectionGraphForStudent(studentId, sectionId)` вызывает общий и более дорогой `recomputeSectionAvailability(...)`, хотя graph response использует ограниченный набор unit-метрик.

Зафиксированное решение:
- не менять response shape `GET /sections/:id/graph`;
- не менять доменную семантику `status/completionPercent/solvedPercent`;
- добавить в `LearningAvailabilityService` узкий graph-oriented path, например:
  - `getSectionGraphAvailabilitySnapshot(studentId, sectionId)`
- он должен вычислять только то, что реально нужно graph use-case;
- `LearningService.getPublishedSectionGraphForStudent()` переводим на этот узкий path.

#### Что не делаем
- не внедряем кэш на read-path в этой итерации;
- не меняем student graph response;
- не меняем unlock/progress semantics.

#### Изменения по файлам
1. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/api/src/learning/learning-availability.service.ts`
   - добавить узкий graph snapshot method
2. `/Users/Alex/Documents/VSCodeProjects/сontinuum/apps/api/src/learning/learning.service.ts`
   - использовать его в `getPublishedSectionGraphForStudent()`
3. при необходимости:
   - выделить shared helper внутри `learning-availability.service.ts`, чтобы не дублировать доменную формулу статусов

#### Тесты для Slice 2
1. расширить service tests на `LearningAvailabilityService`
   - graph snapshot path даёт те же `status/completionPercent/solvedPercent`, что и текущая логика
2. расширить coverage для `LearningService.getPublishedSectionGraphForStudent()`
   - shape и semantics без изменений
3. integration на student graph endpoint:
   - `GET /sections/:id/graph`
   - форма ответа и статусы сохраняются

#### Post-change measurement (`Implemented`)
- Post-change repeated baseline:
  - `GET /sections/:id/graph` ≈ `18–33 ms`
  - первый прогон после login ≈ `71 ms`
  - payload без изменений: `1939 B`
- Подтверждённый эффект:
  - student graph больше не вызывает общий `recomputeSectionAvailability(...)` на hot read-path;
  - graph endpoint использует узкий snapshot path без persist-side-effect на каждое чтение;
  - latency заметно снизилась без изменения response shape.

#### Acceptance criteria для Slice 2 (`Implemented`)
1. `GET /sections/:id/graph` сохраняет текущий response shape;
2. `status/completionPercent/solvedPercent` не меняются по смыслу;
3. повторные замеры подтверждают заметное снижение latency graph read-path.

## Что не делаем в этой wave (`Implemented`)

1. Не идём сейчас в `teacher section graph` render optimization.
2. Не делаем большой refactor `TeacherUnitDetailScreen` ради optimization.
3. Не меняем payload shape существующих endpoints, кроме добавления нового `GET /teacher/sections/:id/meta`.
4. Не добавляем кэш/мемоизацию без повторного измерения.
5. Не возвращаемся к `playwright`/browser-side automation до тех пор, пока не закроем два уже подтверждённых hotspot.

## Порядок реализации

### Этап 1. Slice 1 (`Implemented`)
1. Добавлен `teacher section meta` read-model.
2. `teacher unit editor` переведён с full `section detail` на metadata/fallback модель.
3. Safety-net и общий verification contour пройдены.
4. Post-change baseline снят и зафиксирован.

### Этап 2. Slice 2 (`Implemented`)
1. Добавлен узкий graph snapshot path.
2. Student graph endpoint переведён на него.
3. Safety-net и Docker verification пройдены.
4. Post-change baseline по student graph снят и зафиксирован.

### Этап 3. Re-triage (`Planned`)
1. Сравнить baseline и post-change по двум slices.
2. Обновить shortlist.
3. Решить, нужен ли отдельный `teacher section graph` render profiling batch.

## Проверки и валидация

### После каждой optimization-правки
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm docs:check`, если менялись docs

### Для backend-sensitive optimization
1. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"`
2. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`
3. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm exec tsc -p tsconfig.json --noEmit"`
4. `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm build"`

### Для frontend-sensitive optimization
1. targeted `web` suite на затронутый flow
2. `pnpm --filter web typecheck`
3. `pnpm --filter web lint`

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

Если finding не подтверждён измерениями или не стоит локальной правки:
- переносим его в `/Users/Alex/Documents/VSCodeProjects/сontinuum/documents/exec-plans/deferred-roadmap.md`
- или в `/Users/Alex/Documents/VSCodeProjects/сontinuum/documents/exec-plans/tech-debt-tracker.md`

## Критерии завершения текущей active initiative

1. Для `teacher unit editor initial load` есть baseline, optimization change и post-change measurement.
2. Для `student dashboard graph` есть baseline, optimization change и post-change measurement.
3. Есть обновлённый shortlist bottleneck после этих двух slices.
4. Нет optimization work “на глаз” без измерений.
5. Если дальнейшие finding не подтверждены, они уходят в deferred roadmap / tech debt tracker, а не зависают в active plan.

## Явные допущения и выбранные defaults

1. Первый optimization target: `teacher unit editor initial load`.
2. Второй optimization target: `student dashboard graph read-path`.
3. `playwright` и browser-side render profiling отложены до завершения двух уже подтверждённых hotspot.
4. `teacher section graph` пока не считается подтверждённым optimization target.
5. Любая optimization-правка идёт только с safety-net тестами и повторным замером после фикса.
