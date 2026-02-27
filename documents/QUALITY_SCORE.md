# QUALITY_SCORE

Статус: `Draft` (источник истины — код).

## Шкала

- Используется шкала `0..5`.

## Фокус оценки

- Центральный продуктовый домен (core product domain).

## Срез (baseline, `Planned`)

- Зафиксировать baseline по слоям/доменам и обновлять по мере закрытия техдолга.

## Safety rails snapshot (`Implemented`, 2026-02-27)

- В CI quality job добавлены обязательные шаги `pnpm lint` и `pnpm lint:boundaries`.
- В monorepo действует единый ESLint flat config (`eslint.config.mjs`) для `apps/*` и `packages/*`.
- В каждом workspace-пакете подключён script `lint`, чтобы `turbo lint` реально выполнял проверки (а не пропускал пакет).
- `pnpm test` больше не placeholder: `apps/api`, `apps/web`, `apps/worker`, `packages/shared` запускают `vitest` с минимальным baseline-покрытием критичных сценариев.

## Методика (черновик)

- 0: неработоспособно/критический риск.
- 1: фрагментарно, высокая нестабильность.
- 2: базово работает, много ручных обходов.
- 3: рабочий production-minimum.
- 4: устойчиво и предсказуемо.
- 5: образцово, с автоматическими гарантиями.

## Объект оценки (минимум, `Planned`)

- `apps/api` (Auth, Content, Learning, Events, Storage, Internal endpoints)
- `apps/worker` (LaTeX compile/apply)
- `apps/web` (Teacher/Student UX)
- `packages/shared` (shared contracts/config)
- Документация (SoR актуален, индексы/ссылки/статусы валидируются)
