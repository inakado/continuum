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
- [ ] Выполнить end-to-end deploy на реальном VPS и зафиксировать фактический smoke из production.

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
- подготовить `/srv/continuum` и deploy user;
- добавить GitHub Deploy Key (read-only), клонировать репозиторий;
- заполнить `deploy/env/*.env` реальными значениями (`CHANGE_ME_*` заменить);
- запустить manual migration: `DATABASE_URL=... pnpm --filter @continuum/api exec prisma migrate deploy`.

3) Первый production запуск:
- `docker compose -f docker-compose.prod.yml up -d --build`;
- `NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build`;
- `systemctl restart continuum-web`;
- настроить `nginx` + `certbot`.

4) Верификация и фиксация:
- `GET /api/health` = 200;
- `GET /api/ready` = 200;
- `POST /api/debug/enqueue-ping` = 201;
- `GET /login` = 200;
- задокументировать фактический smoke и перенести план в `documents/exec-plans/completed/`.
