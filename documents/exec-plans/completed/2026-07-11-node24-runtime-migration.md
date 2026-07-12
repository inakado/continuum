# Миграция runtime на Node.js 24 LTS

Статус: `Completed` (2026-07-12)

## Цель и контекст

- убрать EOL Node.js 20 из исполняемого API/worker/CI/VPS-контура;
- зафиксировать Node.js 24 LTS как единый поддерживаемый runtime;
- обновлять Node в worker без повторной установки тяжёлого TeX Live слоя.

## In Scope

- API и worker Docker runtime;
- dev/prod Compose build args;
- CI и VPS bootstrap;
- root runtime policy и operational runbooks;
- локальная сборка, health, queue и LaTeX runtime smoke.

## Out of Scope

- обновление pnpm и application dependencies;
- изменение LaTeX toolchain или TeX Live пакетов;
- production deploy в рамках локальной работы.

## Порядок выполнения

1. Зафиксировать Node.js 24 в package policy, CI и VPS bootstrap.
2. Перевести API image на Node.js 24.
3. Наложить Node.js 24 отдельным worker-слоем поверх сохранённого TeX Live base.
4. Обновить dev/deploy/rollback документацию.
5. Собрать runtime-контуры и проверить API, worker queue и LaTeX binaries.
6. Зафиксировать миграцию отдельным коммитом.

## Decision Log

- Целевая линия: Node.js 24 LTS; Node.js 22 не используется, так как уже завершил поддержку.
- `pnpm@10.11.1` остаётся зафиксированным через `packageManager` и Corepack.
- Legacy tag `continuum-texlive-base:texlive-2022-node20-bookworm` временно сохраняется ради повторного использования существующего тяжёлого TeX image.
- Worker удаляет legacy Node из TeX base и копирует `/usr/local` из pinned Node.js 24 image; TeX Live при миграции не переустанавливается.

## Риски и Rollback

- Native dependencies могут потребовать переустановки после смены major Node.
- Rollback: checkout предыдущего commit и rebuild `api`/`worker` с сохранённым TeX base image; data volumes не затрагиваются.

## Критерии завершения

- API и worker сообщают Node.js 24.x.
- API `/health` и `/ready` возвращают `200`.
- Worker обрабатывает `system.ping` и видит `pdflatex`/`dvisvgm`.
- Web/shared checks проходят на Node.js 24.
- Runbooks отражают Node.js 24 и отсутствие обязательного TeX rebuild.

## Progress Log

- 2026-07-11: подтверждено, что host уже использует Node.js 24, а API/worker/CI/VPS остаются на EOL Node.js 20.
- 2026-07-11: выбран overlay-подход для worker, сохраняющий существующий TeX Live base.
- 2026-07-12: после полной iCloud hydration web/shared typecheck сократился с зависания на минуты до 8.6 секунды; web build, lint и tests прошли.
- 2026-07-12: runtime smoke подтверждает Node.js 24.18.0 в API/worker, API health/ready, TeX binaries и обработку `system.ping`.
- 2026-07-12: cleanup выявил неверные root `node_modules` checks в dev Compose; startup guards переведены на фактические package-specific pnpm paths.
- 2026-07-12: повторный recreate API/worker завершился за 13.9 секунды без `pnpm install`; health и worker readiness подтверждены.
- 2026-07-12: удалены старый dangling API image и legacy Tectonic cache volume; TeX-base, data volumes и свежий build cache сохранены.

## Итог

- API, worker, CI и VPS bootstrap переведены на Node.js 24 LTS.
- Worker использует отдельный pinned Node layer поверх сохранённого TeX Live base; миграция не переустанавливала TeX Live.
- Dev startup больше не запускает `pnpm install --force` при каждом recreate.
- `DEP0169` остаётся неблокирующим предупреждением build/install tooling `pnpm@10.11.1`; application runtime его не генерирует.
- Rollback и operational runbooks синхронизированы.

## Проверки

- `pnpm typecheck`
- `pnpm lint` и `pnpm lint:boundaries`
- `pnpm docs:check`
- `pnpm build:web`
- `pnpm --filter web test` (`120` tests)
- API tests в Docker (`61` tests)
- worker tests в Docker (`46` tests)
- API `/health`, `/ready`, `system.ping`, Node/TeX runtime smoke
