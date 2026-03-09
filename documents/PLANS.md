# PLANS

Назначение: правила lifecycle для execution plans и связанных backlog-хранилищ.

## Что считается execution plan

Execution plan — это first-class артефакт для сложной инициативы, который описывает:
- цель и контекст;
- scope;
- шаги реализации;
- decision log;
- риски и rollback;
- критерии завершения;
- task-specific troubleshooting.

## Когда нужен active plan

Active execution plan обязателен, если изменение затрагивает хотя бы одно из условий:
- несколько доменов или модулей;
- миграции БД и backfill;
- изменение доменных инвариантов;
- существенные изменения API/transport контрактов;
- крупный refactor, который выполняется волнами.

## Lifecycle

### Active

- Хранилище: `documents/exec-plans/active/`
- Содержит:
  - текущую цель;
  - progress logs;
  - decision log;
  - rollout notes;
  - task-specific troubleshooting.

### Completed

- Хранилище: `documents/exec-plans/completed/`
- Содержит:
  - завершённые инициативы;
  - исторический контекст;
  - финальные решения и итоги.

### Superseded

- Хранилище: `documents/exec-plans/completed/`
- Используется для бывших active plans, которые сняты из исполнения из-за reprioritization или замены новой инициативой.
- Содержит:
  - исходный контекст и scope снятой инициативы;
  - причину замены/переноса;
  - ссылку на инициативу, которая стала новой активной работой.

### Deferred roadmap

- Файл: `documents/exec-plans/deferred-roadmap.md`
- Содержит:
  - неактивные future items;
  - направления, к которым хотим вернуться позже;
  - backlog, который не является техдолгом.

### Tech debt tracker

- Файл: `documents/exec-plans/tech-debt-tracker.md`
- Содержит:
  - баги;
  - техдолг;
  - deferred engineering work;
  - архитектурные хвосты, которые уже признаны долгом.

## Что куда писать

- Активная инициатива, progress и decisions:
  - `documents/exec-plans/active/*`
- Завершённая инициатива:
  - `documents/exec-plans/completed/*`
- Active plan, снятый как заменённый новой инициативой:
  - `documents/exec-plans/completed/*` со статусом `Superseded`
- Неактивная future idea, которая не является долгом:
  - `documents/exec-plans/deferred-roadmap.md`
- Техдолг, баг, спорное engineering-решение или известная structural проблема:
  - `documents/exec-plans/tech-debt-tracker.md`
- Stable rule и текущая модель системы:
  - профильный SoR-документ, а не execution plan.

## Минимальная структура плана

Каждый execution plan должен содержать минимум:
- цель и контекст;
- in/out of scope;
- порядок выполнения;
- decision log;
- риски;
- критерии завершения;
- проверки;
- при необходимости — task-specific troubleshooting.
