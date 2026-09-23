# Production deploy

Production deploy выполняется только по явной команде владельца проекта. Source of truth — `docker-compose.prod.yml` и `deploy/scripts/deploy-on-vps.sh`.

## Runtime

- Next.js web запускается systemd unit `continuum-web`.
- NestJS API и PostgreSQL запускаются через Docker Compose.
- Object storage — внешний S3-compatible provider.
- Worker, Redis и TeX Live в новой версии отсутствуют.

## Требования VPS

- пользователь `deploy`, не `root`;
- репозиторий в `/srv/continuum` или `APP_DIR`;
- чистый Git working tree;
- Node.js 24;
- pnpm 10.11.1;
- Docker Compose;
- `deploy/env/api.env` и `deploy/env/postgres.env`;
- permission на `sudo -n systemctl restart continuum-web`.

## Обязательные env

В `deploy/env/api.env`:

- `BETTER_AUTH_SECRET` не короче 32 символов;
- `BETTER_AUTH_URL`;
- `WEB_ORIGIN`;
- `CORS_ORIGIN`;
- `DATABASE_URL` или `POSTGRES_*`;
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, credentials и public base URL.

## Ручной deploy

До cutover новой схемы команда не запускается. После явного подтверждения:

```bash
ssh continuum-vps
sudo -iu deploy
cd /srv/continuum
git fetch --all --prune
git checkout main
git merge --ff-only origin/main
MIGRATIONS_APPROVED=yes APP_DOMAIN=vl-physics.ru ./deploy/scripts/deploy-on-vps.sh
```

Скрипт:

1. проверяет пользователя, Git, Node, pnpm и env;
2. устанавливает frozen dependencies;
3. поднимает PostgreSQL;
4. собирает API и web;
5. применяет Prisma migrations только при `MIGRATIONS_APPROVED=yes`;
6. перезапускает API и `continuum-web`;
7. проверяет локальные и публичные health/login endpoints;
8. при заданных auth-smoke credentials проверяет Better Auth и защищённый `GET /me`.

## Cutover новой версии

Старые production-данные не мигрируются. Очистка БД и object storage выполняется отдельно перед первым deploy новой схемы. До явного cutover работающий production не изменяется.

Минимальный rollback:

1. вернуть предыдущий Git revision;
2. вернуть соответствующий `docker-compose.prod.yml`;
3. поднять прежний API runtime;
4. перезапустить `continuum-web`;
5. проверить `/api/health` и `/login`.

После destructive reset откат данных невозможен; rollback сохраняет только предыдущий код/runtime.

## Проверка после deploy

```bash
curl -fsS https://vl-physics.ru/api/health
curl -fsS https://vl-physics.ru/api/ready
curl -fsS https://vl-physics.ru/login >/dev/null
docker compose -f docker-compose.prod.yml ps
```

После появления Library API smoke расширяется проверкой доступа к опубликованному занятию и запрета direct-link для ученика без доступа.
