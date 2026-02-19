# QUALITY_SCORE

Статус: `Draft` (источник истины — код).

## Шкала

- Используется шкала `0..5`.

## Фокус оценки

- Центральный продуктовый домен (core product domain).

## Срез (baseline, `Planned`)

- Зафиксировать baseline по слоям/доменам и обновлять по мере закрытия техдолга.

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
