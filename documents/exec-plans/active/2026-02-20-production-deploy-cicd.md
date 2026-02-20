# Execution Plan: Production Deploy Foundation (GitHub ↔ Beget VPS)

Статус плана: `Active`

## 1. Цель

Подготовить репозиторий к production выкладке на VPS (Beget):
- production docker контур для backend,
- systemd+nginx контур для frontend,
- CI/CD workflow в GitHub Actions,
- runbooks для миграций и rollback.

## 2. Scope

### In scope
- `apps/api`, `apps/worker`, `apps/web`, `packages/shared` build/typecheck/test scripts.
- Production Dockerfiles и `docker-compose.prod.yml`.
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- Deploy артефакты (`deploy/env`, `deploy/nginx`, `deploy/systemd`, `deploy/scripts`).
- Обновление SoR-доков (`documents/DEVELOPMENT.md`, `documents/RELIABILITY.md`, `documents/DOCS-INDEX.md`).

### Out of scope
- Выполнение deploy на конкретном VPS (нужны SSH доступ и домен).
- Настройка branch protection в GitHub UI.

## 3. Принятые решения (Decision log)

1) Backend deploy: build на VPS из исходников (не GHCR).
2) Frontend runtime: `systemd + nginx`, без Docker.
3) Data services: Postgres/Redis на VPS, object storage — внешний S3 (Beget S3) в production.
4) Release trigger: manual (`workflow_dispatch` + production environment).
5) DB migrations: manual до deploy.
6) GitHub↔VPS auth: SSH Deploy Key read-only.
7) TLS: Let's Encrypt через certbot.
8) Domain routing: единый домен для web + `/api` для backend.
9) Backend build policy: `apps/api` и `apps/worker` собираются только в Docker; host build запрещён guard-скриптом.

## 4. Шаги реализации

- [x] Убрать web build зависимость от Google Fonts (`next/font/google` → локальные CSS font vars).
- [x] Добавить `build/typecheck/test` scripts во все пакеты, включая worker build.
- [x] Переделать Dockerfile API/Worker на multi-stage и добавить production runner stage.
- [x] Добавить `docker-compose.prod.yml` + service-specific env files.
- [x] Добавить `.github/workflows/ci.yml`.
- [x] Добавить `.github/workflows/deploy.yml` с manual migration gate.
- [x] Добавить `deploy/README.md`, `deploy/nginx/continuum.conf`, `deploy/systemd/continuum-web.service`, helper scripts.
- [x] Обновить SoR документы и индекс документации.
- [x] Перевести web-шрифты на локальные пакеты (`@fontsource/inter`, `@fontsource/unbounded`) для независимости от Google Fonts.
- [x] Привязать `origin` к GitHub репозиторию и выполнить первый push в `main`.
- [x] Выполнить end-to-end deploy на реальном VPS и зафиксировать фактический smoke из production.

## 4.1) Progress update (2026-02-20)

- GitHub repository linked: `https://github.com/inakado/continuum`.
- Branch `main` pushed to `origin`.
- Release commit: `0fef536` (`chore: production deploy foundation (docker-only backend build, CI/CD, VPS runbook)`).
- Локальные проверки успешны:
  - `pnpm build:backend`
  - `pnpm build:web`
  - `pnpm typecheck`
  - dev runtime: `pnpm dev:infra`, `pnpm dev:backend`, `pnpm dev:web`, `/login` = 200
- VPS progress:
  - создан VPS (Ubuntu 24.04), подтверждён SSH-доступ с локальной машины;
  - установлены базовые зависимости (`docker`, `node`, `pnpm`, `nginx`, `certbot`);
  - создан пользователь `deploy`, подготовлен каталог `/srv/continuum`;
  - сгенерирован и добавлен GitHub Deploy Key (read-only);
  - настроен SSH-доступ к GitHub под `deploy`, репозиторий склонирован в `/srv/continuum`.
  - DNS домена `vl-physics.ru` обновлён: `A` указывает на VPS IP `82.202.128.50` (подтверждено через `@8.8.8.8` и `@1.1.1.1`).
- CI progress:
  - GitHub Actions `quality` и `security` проходят полностью после фикса `fast-xml-parser` до `5.3.6` (commit `be3e2c6`).
- Production smoke (manual):
  - backend поднят в `docker-compose.prod.yml` (`api`/`worker`/`postgres`/`redis`);
  - migrations применены через `docker compose ... run --rm api ... prisma migrate deploy`;
  - frontend собран и запущен через `continuum-web.service`;
  - nginx + TLS настроены для `vl-physics.ru`;
  - проверки: `https://vl-physics.ru/login` = 200, `https://vl-physics.ru/api/health` = 200, `POST /debug/enqueue-ping` = 201.

## 5. Риски и контроль

- Риск: production compose попадёт в deploy без корректных секретов.
  - Контроль: placeholder `CHANGE_ME` в env и явный runbook для обязательной замены.

- Риск: CI test этап формально зелёный без реальных тестов.
  - Контроль: в документации зафиксировано как Planned tech gap.

- Риск: deploy workflow не сможет выполнить `systemctl`/`docker` под текущим пользователем.
  - Контроль: требование `deploy` user с правами docker и sudo для systemctl в runbook.

## 6. Troubleshooting, зафиксированный в ходе работ

1) **Падение smoke в sandbox**
- Где упало: `pnpm smoke`
- Что увидели: `TypeError: fetch failed`
- Почему: ограничения sandbox на доступ к локальным портам.
- Как чинить: выполнять smoke/curl проверки в escalated shell.
- Как проверить: `curl -fsS http://localhost:3000/health` и `/ready`.

2) **Падение install без внешней сети**
- Где упало: `CI=true pnpm install`
- Что увидели: `ENOTFOUND registry.npmjs.org`
- Почему: нет DNS/egress в текущем окружении.
- Как чинить: выполнять install в окружении с доступом к npm registry (CI/VPS).
- Как проверить: `pnpm install --frozen-lockfile` без fetch retry/ENOTFOUND.

3) **Частичный/root-only install ломает бинарники для build**
- Где упало: `pnpm build`
- Что увидели: `tsc: command not found` (worker) / `next: command not found` (web)
- Почему: запуск `pnpm install --filter ...` (или `pnpm -w install` при root-only установке) пересоздаёт общий `node_modules`, часть workspace-бинарников пропадает.
- Как чинить: очистить локальные `node_modules` и выполнить полный install (`CI=true DATABASE_URL=... pnpm -r install --force`) в рабочей сети.
- Как проверить: наличие `apps/worker/node_modules/.bin/tsc` и `apps/web/node_modules/.bin/next`, затем успешный `pnpm build`.

4) **Docker build не стартует в sandbox**
- Где упало: `pnpm build:backend` / `docker compose -f docker-compose.prod.yml build api worker`
- Что увидели: `permission denied while trying to connect to the Docker daemon socket ... docker.sock`
- Почему: у sandbox-процесса нет доступа к Docker daemon socket.
- Как чинить: запускать backend docker build вне sandbox (обычный терминал/VPS/CI) или с повышенными правами.
- Как проверить: build проходит без socket permission errors.

5) **Production migration с хоста падает по `postgres:5432`**
- Где упало: `DATABASE_URL=... pnpm --filter @continuum/api exec prisma migrate deploy` на VPS.
- Что увидели: `P1001: Can't reach database server at postgres:5432`.
- Почему: `postgres` — имя docker-сервиса и доступно только внутри docker network; на хосте не резолвится.
- Как чинить: запускать миграцию внутри docker network:
  - `docker compose -f docker-compose.prod.yml run --rm api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`
- Как проверить: migrate deploy завершается успешно, затем `api` поднимается и проходит healthcheck.

6) **Production api не стартует: `Cannot find module 'reflect-metadata'`**
- Где упало: `docker compose -f docker-compose.prod.yml up -d --build api`.
- Что увидели: в логах `api` — `Error: Cannot find module 'reflect-metadata'`; при `docker compose ... run api ... prisma` — `Command "prisma" not found`.
- Почему: в runner stage Dockerfile не копировались package-level `node_modules` (`apps/api/node_modules`, `apps/worker/node_modules`), а pnpm использует их для резолва зависимостей/бинарников.
- Как чинить: в runner stage копировать package-level `node_modules` и пересобрать образы (`api`, `worker`).
- Как проверить: `api` в статусе healthy, migrations внутри docker выполняются, `prisma` доступен в `docker compose run --rm api`.

7) **`prisma migrate deploy` в `api` контейнере падает: `Could not find Prisma Schema`**
- Где упало: `docker compose -f docker-compose.prod.yml run --rm api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`.
- Что увидели: Prisma ищет `schema.prisma`/`prisma/schema.prisma` и не находит.
- Почему: в runner stage `apps/api/Dockerfile` не были скопированы `apps/api/prisma` и `apps/api/prisma.config.ts`.
- Как чинить: копировать `prisma` каталог и `prisma.config.ts` в runner image и пересобрать `api`.
- Как проверить: migrate deploy проходит внутри контейнера без ошибки schema location.

8) **Production api падает из-за отсутствия `JWT_SECRET`**
- Где упало: `docker compose -f docker-compose.prod.yml up -d --build api worker`.
- Что увидели: `Error: JWT_SECRET must be set in production`.
- Почему: в `deploy/env/api.env` не было валидного `JWT_SECRET`.
- Как чинить: задать `JWT_SECRET` в `deploy/env/api.env` и перезапустить `api`.
- Как проверить: `api` в статусе `healthy`, `/health` и `/ready` отвечают 200.

9) **`continuum-web.service` отсутствует в systemd**
- Где упало: `sudo -n /usr/bin/systemctl restart continuum-web`.
- Что увидели: `Unit continuum-web.service not found`.
- Почему: unit-файл не установлен в `/etc/systemd/system`.
- Как чинить: под `root` установить unit, сделать `systemctl daemon-reload` и `systemctl enable continuum-web`.
- Как проверить: `systemctl is-active continuum-web` = `active`.

10) **`nginx -t` падает до выпуска сертификата**
- Где упало: `nginx -t`.
- Что увидели: `cannot load certificate "/etc/letsencrypt/live/<domain>/fullchain.pem"`.
- Почему: SSL-конфиг применён до `certbot`.
- Как чинить: сначала HTTP-only bootstrap конфиг, затем `certbot --nginx -d <domain> --redirect`.
- Как проверить: `curl -I https://<domain>/login` и `curl -I https://<domain>/api/health` дают 200.

## 7. Критерии завершения

- CI workflow стабильно проходит на PR в `main`.
- Deploy workflow запускается вручную и имеет production approval gate.
- На реальном VPS подтверждены:
  - `/api/health` = 200,
  - `/api/ready` = 200,
  - enqueue ping = 201,
  - `/login` = 200,
  - rollback сценарий выполняется по runbook.

## 8. Следующий этап (операционный чеклист)

1) На GitHub:
- создать Environment `production`;
- добавить secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `APP_DIR`, `APP_DOMAIN`;
- включить manual approval для `production`.

2) На VPS:
- сохранить и бэкапнуть финальные production env (`deploy/env/*.env`) и nginx/systemd конфиг.

3) Операционные донастройки:
- завершить GitHub `production` environment secrets;
- проверить deploy workflow по manual approval на одном тестовом релизе.

4) Верификация и фиксация:
- `GET https://vl-physics.ru/api/health` = 200;
- `GET https://vl-physics.ru/login` = 200;
- smoke worker (`enqueue-ping`) = 201;
- перенести план в `documents/exec-plans/completed/` после проверки deploy workflow.
