# PLANS

Статус: `Scaffold`.

## Назначение

Правила для execution plans как first-class артефактов.

## Implemented

## Структура

- Активные: `documents/exec-plans/active/`
- Завершенные: `documents/exec-plans/completed/`
- Техдолг: `documents/exec-plans/tech-debt-tracker.md`

## Migrated plans (legacy → exec-plans)

- Исторические “vertical slice” планы перенесены в `documents/exec-plans/completed/`.
- Старые файлы в `documents/` не должны содержать execution plans (иначе карта расползается).

## Когда план обязателен

- Изменение нескольких доменов/модулей.
- Миграции БД и backfill.
- Изменение доменных инвариантов.
- Существенные изменения API контрактов.

## Минимум для плана

- Цель и контекст.
- Объем (in/out of scope).
- Шаги реализации.
- Decision log.
- Риски и откат.
- Критерии завершения.

## Planned

- CI-валидация: активные/завершенные планы индексированы и не содержат ссылок на удалённые legacy файлы.
