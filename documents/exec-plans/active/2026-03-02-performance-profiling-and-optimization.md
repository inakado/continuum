# 2026-03-02 — Performance profiling and targeted optimization

Статус: `Active`

## Цель

Ускорить отклик и работу проекта не по ощущению, а через измерение реальных bottleneck-ов и последующую точечную оптимизацию.

## Контекст

Архитектурный cleanup завершён отдельной инициативой:
- `documents/exec-plans/completed/2026-03-01-architecture-alignment-tail-refactor.md`

На текущем состоянии:
- lint/typecheck/tests/docs-check зелёные;
- manual boundary parsing и manual server-state хвосты убраны;
- основные крупные structural hotspots уже декомпозированы.

Следующий шаг теперь не в чтении кода ради smell cleanup, а в измерении реальных runtime bottleneck-ов.

## Scope

### In scope

- profiling и optimization для hot user flows:
  - `student dashboard`
  - `student unit detail` при подтверждённом hot-path
  - `teacher dashboard`
  - `teacher section graph`
  - `teacher unit editor`
  - `teacher students/profile/review` при подтверждённом hot-path
- выявление bottleneck по трём уровням:
  - network
  - React render
  - backend/API/DB
- точечные оптимизации только после baseline-замеров.

### Out of scope

- новый архитектурный refactor без подтверждённого performance bottleneck;
- массовая micro-optimization “на всякий случай”;
- произвольное добавление memoization/cache hacks без baseline и re-measurement.

## Measurement-first принципы

1. Сначала обнаруживаем узкое место, потом оптимизируем.
2. Любая optimization wave начинается с baseline-замера и заканчивается повторным замером.
3. Архитектурный smell не считается performance issue без подтверждённого bottleneck.
4. Если проблема не измерена, она не считается доказанным optimization target.
5. Один случайный прогон не считается репрезентативной метрикой.

## Как определяем узкие места

### 1. Network profile

Целевые сценарии:
- student dashboard
- teacher dashboard
- teacher section graph
- teacher unit editor
- student unit detail, если profiling покажет его hot-path

Смотрим:
- самые долгие запросы;
- дублирующиеся запросы;
- waterfall вместо параллельной загрузки;
- лишние refetch после mutation/navigation;
- размер payload.

Классификация bottleneck:
- `network-bound`
- `mixed`

### 2. React render profile

Целевые сценарии:
- student dashboard / student unit flows;
- большие teacher screens;
- graph/edit flows;
- unit editor/write flows.

Смотрим:
- expensive commits;
- частоту ререндеров;
- каскадные обновления subtree;
- expensive derived state;
- interaction stalls после ввода, drag, save.

Классификация bottleneck:
- `render-bound`
- `mixed`

### 3. API slow queries / hot endpoints

Целевые endpoint-контуры:
- student dashboard / student unit read-paths;
- teacher dashboard / course / section / graph;
- teacher unit editor;
- teacher students/profile/review связки, если profiling покажет их hot-path.

Смотрим:
- latency hot endpoints;
- количество и форму SQL queries;
- тяжёлые `include/select`;
- N+1;
- синхронные recompute/joins на read-path.

Классификация bottleneck:
- `backend-bound`
- `mixed`

## Порядок выполнения

1. Выбрать user flow.
2. Снять baseline:
   - network profile;
   - React render profile;
   - API/DB slow-path метрики.
3. Зафиксировать bottleneck class:
   - `network-bound`
   - `render-bound`
   - `backend-bound`
   - `mixed`
4. Выполнить targeted optimization только под подтверждённую причину.
5. Повторить те же замеры.
6. Зафиксировать результат и только потом переходить к следующему flow.

## Возможные типы оптимизаций

- query/cache/invalidation tuning;
- устранение лишних refetch;
- распараллеливание read-path;
- payload reduction;
- render split / memoization / derived-state cleanup;
- SQL/select/include optimization;
- устранение N+1 и тяжёлых recompute на hot-path.

## Что запрещено

- оптимизация на глаз без baseline;
- массовая micro-optimization всего подряд;
- смешивание profiling и крупного архитектурного refactor в одном шаге;
- принятие одного случайного запуска за репрезентативную метрику.

## Проверки

### Repo-level

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:check`

### Backend-in-Docker

- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm test:integration"`
- `docker compose exec -T api sh -lc "cd /app/apps/api && pnpm smoke:auth"`

## Критерии завершения

- для каждого взятого hot flow есть baseline и post-change measurement;
- bottleneck class зафиксирован явно;
- оптимизации выполнены только для подтверждённых узких мест;
- результат измеримо подтверждён повторным profiling;
- findings, которые не вошли в активную работу, вынесены в `documents/exec-plans/deferred-roadmap.md` или `documents/exec-plans/tech-debt-tracker.md`.
