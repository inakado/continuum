# Execution Plan: Documentation Realignment (DEVELOPMENT/CONTENT/SECURITY/DESIGN-SYSTEM)

Статус плана: `Completed`

## 1. Цель

Убрать из `documents/DEVELOPMENT.md` блоки, не относящиеся к dev/prod runbook, и разнести их по профильным SoR-докам без потери фактов.

## 2. Scope

### In scope
- `documents/DEVELOPMENT.md`
- `documents/CONTENT.md`
- `documents/SECURITY.md`
- `documents/DESIGN-SYSTEM.md`
- `documents/ARCHITECTURE.md`
- `documents/exec-plans/completed/index.md`

### Out of scope
- Изменения runtime-кода (`apps/*`)
- Переписывание legacy vertical-slice планов

## 3. Decision log

1) Troubleshooting в `DEVELOPMENT.md` оставляем только для run/deploy проблем окружения.
2) Доменный кейс `publish unit -> 409` переносим в `CONTENT.md`.
3) Auth/storage operational edge-cases переносим в `SECURITY.md`.
4) `DESIGN-SYSTEM.md` синхронизируем с кодом: локальные `@fontsource/*`, без Google Fonts runtime.

## 4. Шаги реализации

- [x] Удалить из `DEVELOPMENT.md` доменные/продуктовые troubleshooting-блоки и добавить границы раздела.
- [x] Добавить publishing troubleshooting в `CONTENT.md`.
- [x] Добавить auth/storage operational pitfalls в `SECURITY.md`.
- [x] Исправить типографические источники в `DESIGN-SYSTEM.md` (Google Fonts -> local fontsource).
- [x] Исправить структурную ошибку нумерации разделов в `ARCHITECTURE.md`.
- [x] Зафиксировать завершение плана в `exec-plans/completed/`.

## 5. Риски

- Риск: потерять операционные детали при переносе.
  - Контроль: переносить блоки дословно по смыслу (симптом/причина/фикс/проверка).

- Риск: рассинхрон SoR по шрифтам.
  - Контроль: сверка с `apps/web/app/layout.tsx`.

## 6. Критерии завершения

- `DEVELOPMENT.md` больше не содержит доменных troubleshooting-кейсов публикации/refresh/CORS.
- Перенесённые кейсы присутствуют в профильных SoR-доках.
- `DESIGN-SYSTEM.md` не содержит утверждений про Google Fonts runtime.
