# Deploy Guide (Beget VPS, Ubuntu/Debian)

## Quick connect

Подключение к production VPS с локальной машины выполняется через SSH alias:

```bash
ssh continuum-vps
```

После входа рабочий каталог проекта:

```bash
sudo -iu deploy
cd /srv/continuum
```

SSH alias входит как `root`, но Git, pnpm и application build выполняются от владельца
репозитория `deploy`. Не добавляйте `/srv/continuum` в root `safe.directory`.

## 1) Link local repo to GitHub

```bash
git remote add origin git@github.com:<your-org-or-user>/<repo>.git
git push -u origin main
```

If `origin` already exists, update it:

```bash
git remote set-url origin git@github.com:<your-org-or-user>/<repo>.git
```

## 2) Prepare VPS user and workspace

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/continuum
sudo chown -R deploy:deploy /srv/continuum
```

## 3) Configure SSH Deploy Key (read-only)

On VPS (as `deploy`):

```bash
ssh-keygen -t ed25519 -C "continuum-deploy" -f ~/.ssh/continuum_deploy -N ""
cat ~/.ssh/continuum_deploy.pub
```

Add the printed public key into GitHub repository:
- Settings -> Deploy keys -> Add deploy key
- Permissions: read-only

Then configure SSH:

```bash
cat >> ~/.ssh/config <<'CFG'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/continuum_deploy
  IdentitiesOnly yes
CFG
chmod 600 ~/.ssh/config
```

Clone repo:

```bash
git clone git@github.com:<your-org-or-user>/<repo>.git /srv/continuum
```

## 4) Prepare env files

In `/srv/continuum/deploy/env/`, edit:
- `api.env`
- `worker.env`
- `postgres.env`
- `redis.env`

Mandatory:
- strong `BETTER_AUTH_SECRET` (не менее 32 случайных символов)
- public `BETTER_AUTH_URL` с внешним API-префиксом, например `https://app.example.com/api`
- secure `WORKER_INTERNAL_TOKEN`
- consistent DB settings across all files
- real production value for `WEB_ORIGIN` and `CORS_ORIGIN`
- GitHub Environment secrets `AUTH_SMOKE_LOGIN` и `AUTH_SMOKE_PASSWORD` для отдельной active test identity
- Beget S3 credentials and endpoint (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
- externally reachable HTTPS for `S3_PUBLIC_BASE_URL`
- Beget S3 bucket CORS policy for browser access from `https://app.example.com`:
  - allow origins: `https://app.example.com`
  - allow methods: `GET`, `HEAD`, `PUT`
  - allow headers: `*`

Quick verification (на VPS, после заполнения `deploy/env/api.env`):

```bash
grep -E '^(S3_|ASSETS_)' deploy/env/api.env
docker compose -f docker-compose.prod.yml config | sed -n '/api:/,/^[^ ]/p' | rg -n 'S3_|ASSETS_' || true
```

Проверка CORS на presigned URL (ожидается `Access-Control-Allow-Origin`):

```bash
curl -I -H "Origin: https://app.example.com" "<presigned-url>"
```

Production policy:
- use external S3 provider (Beget S3) in production;
- MinIO используется только в local/dev и не входит в `docker-compose.prod.yml`.
- На production VPS команды `docker compose up -d`/`docker compose down` без `-f docker-compose.prod.yml` не используем: это dev-контур (`docker-compose.yml`) с MinIO и bind-монтажами.
- Runtime-файлы `deploy/env/*.env` на VPS считаются локальной конфигурацией окружения; в git хранятся только `deploy/env/*.env.example`.

### One-time migration on VPS (если раньше `deploy/env/*.env` были tracked в git)

```bash
cd /srv/continuum
mkdir -p .env-backup
cp deploy/env/*.env .env-backup/

git stash push -m "server-env-before-untrack" -- deploy/env/api.env deploy/env/postgres.env deploy/env/worker.env deploy/env/redis.env
git pull --ff-only

for f in api worker postgres redis; do
  [ -f "deploy/env/$f.env" ] || cp "deploy/env/$f.env.example" "deploy/env/$f.env"
done
cp .env-backup/*.env deploy/env/
rm -rf .env-backup
```

Validation:
- `git status --short` — пусто.
- `ls deploy/env` содержит пары `*.env` и `*.env.example`.

## 5) Start production backend stack

```bash
cd /srv/continuum
docker compose -f docker-compose.prod.yml up -d postgres redis
```

Policy: backend build выполняется только в Docker.

## 6) First Better Auth cutover (one-time, pre-launch)

Этот сценарий намеренно удаляет текущие PostgreSQL и Redis volumes. Он допустим только для
зафиксированного pre-launch cutover без ценных данных. S3, Docker build cache и
`continuum-texlive-base` не затрагиваются.

До остановки сервисов от пользователя `deploy` подтяните уже запушенный `main` и соберите релиз:

```bash
cd /srv/continuum
git status --short
git fetch --all --prune
git checkout main
git merge --ff-only origin/main

pnpm install --frozen-lockfile
NEXT_PUBLIC_API_BASE_URL=https://vl-physics.ru/api pnpm --filter web build
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml build worker
```

Остановку и удаление runtime volumes выполните из root shell:

```bash
systemctl stop continuum-web
cd /srv/continuum
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d postgres redis
```

Вернитесь к пользователю `deploy`, примените миграции новым API image и создайте первого admin:

```bash
sudo -iu deploy
cd /srv/continuum
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -lc 'pnpm --filter @continuum/api exec prisma migrate status'

read -rsp 'Admin password: ' ADMIN_PASSWORD; echo
export ADMIN_PASSWORD
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e ADMIN_LOGIN=admin -e ADMIN_NAME=Administrator -e ADMIN_PASSWORD \
  api sh -lc 'pnpm --filter @continuum/api bootstrap:admin'
unset ADMIN_PASSWORD

docker compose -f docker-compose.prod.yml up -d api worker
sudo -n systemctl restart continuum-web
```

Пароль admin не передавайте через аргументы команд, Git или shell history.

## 7) Routine deploy after the cutover

```bash
cd /srv/continuum
git status --short
previous_head="$(git rev-parse HEAD)"
git fetch --all --prune
git checkout main
git merge --ff-only origin/main

PREVIOUS_HEAD="$previous_head" \
MIGRATIONS_APPROVED=yes \
APP_DOMAIN=vl-physics.ru \
  ./deploy/scripts/deploy-on-vps.sh
```

Скрипт собирает release до maintenance window, затем останавливает API/worker, запускает
`prisma migrate deploy`, поднимает новые сервисы и выполняет health checks. Destructive reset
в reusable script отсутствует намеренно.

### Dockerfile split для `worker`

Новая схема разделяет runtime и application build:

- `apps/worker/Dockerfile.texlive-base`
  - собирает только тяжёлый runtime-образ;
  - содержит установку `texlive-full`, `pandoc`, `ghostscript` и связанных системных пакетов;
  - должен пересобираться редко и только при изменениях runtime-layer.
- `apps/worker/Dockerfile`
  - больше не устанавливает `texlive-full`;
  - удаляет legacy Node runtime из `TEXLIVE_BASE_IMAGE` и накладывает pinned Node.js 24 из `NODE_RUNTIME_IMAGE`;
  - собирает только Node/application-слои `worker` поверх `TEXLIVE_BASE_IMAGE`;
  - используется для обычных релизов и быстрых кодовых пересборок.
- `docker-compose.prod.yml`
  - передаёт `TEXLIVE_BASE_IMAGE` в build args для `worker`.

Практический смысл:
- первый шаг `docker build -f apps/worker/Dockerfile.texlive-base ...` создаёт стабильную тяжёлую базу;
- последующие `docker compose -f docker-compose.prod.yml build worker` больше не должны повторно выполнять `install-texlive-runtime.sh`.
- обновление Node.js выполняется пересборкой `worker`; TeX Live base при этом не пересобирается.

### Stable TeX Live runtime base для `worker`

`worker` больше не должен собирать `texlive-full` внутри обычного application image.
Тяжёлый runtime вынесен в отдельный base image `continuum-texlive-base`.

Рекомендуемый tag:

```bash
export TEXLIVE_BASE_IMAGE=continuum-texlive-base:texlive-2022-node20-bookworm
export NODE_RUNTIME_IMAGE=node:24.18.0-bookworm-slim
```

Первичная сборка base image или явное обновление runtime-слоя:

```bash
cd /srv/continuum
docker build -f apps/worker/Dockerfile.texlive-base -t "$TEXLIVE_BASE_IMAGE" .
```

Обычный `worker` build использует этот base image через `TEXLIVE_BASE_IMAGE` и не должен заново скачивать `texlive-full`.
Legacy `node20` в имени tag временно сохраняется для совместимости с уже собранным тяжёлым image; фактический worker runtime использует Node.js 24 из `NODE_RUNTIME_IMAGE`.

### Cache-first policy для `worker`

Для обычных релизов используем селективную пересборку:

```bash
# Обязательный минимум для большинства релизов
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api

# worker пересобираем только если реально менялся worker/app слой
TEXLIVE_BASE_IMAGE="${TEXLIVE_BASE_IMAGE:-continuum-texlive-base:texlive-2022-node20-bookworm}" \
NODE_RUNTIME_IMAGE="${NODE_RUNTIME_IMAGE:-node:24.18.0-bookworm-slim}" \
  docker compose -f docker-compose.prod.yml build worker
docker compose -f docker-compose.prod.yml up -d worker
```

Когда `worker` обычно НЕ нужно пересобирать:
- изменения только в `apps/api/*`, web или docs.

Когда `worker` нужно пересобирать:
- изменения в `apps/worker/*`;
- изменения в `packages/latex-runtime/*`;
- изменения в `packages/shared/*` (worker импортирует `@continuum/shared`);
- изменения в `apps/worker/Dockerfile`, `pnpm-lock.yaml`, `package.json`.

Когда нужно пересобирать именно `continuum-texlive-base`:
- изменения в `apps/worker/Dockerfile.texlive-base`;
- изменения в `scripts/install-texlive-runtime.sh`;

Изменения `package.json`, `pnpm-lock.yaml`, Node.js или application-кода не требуют rebuild TeX Live base.

Чтобы не терять кэш `texlive`-слоя:
- не использовать `docker build --no-cache` для обычного релиза;
- не запускать `docker builder prune -a` и `docker system prune -a` (policy запрет для production deploy цикла).
- не пересобирать `continuum-texlive-base` без явной причины.

### Disk hygiene policy (production VPS)

Цель: не копить мусорные старые образы и держать стабильный запас места без регулярной потери `TeX Live` кэша.

Операционные пороги:
- `warning`: свободно < `12G` на `/`.
- `critical`: свободно < `8G` на `/`.

Базовая проверка перед/после deploy:

```bash
df -h
df -i
docker system df
```

Cleanup выполняется только после зелёного smoke. Сначала зафиксируйте защищённый image:

```bash
TEXLIVE_IMAGE=continuum-texlive-base:texlive-2022-node20-bookworm
TEXLIVE_ID_BEFORE="$(docker image inspect --format '{{.Id}}' "$TEXLIVE_IMAGE")"

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml images
docker image ls --filter dangling=true
docker container ls -a
```

Безопасный cleanup удаляет только остановленные containers и dangling images старых сборок:

```bash
docker container prune -f
docker image prune -f

TEXLIVE_ID_AFTER="$(docker image inspect --format '{{.Id}}' "$TEXLIVE_IMAGE")"
test "$TEXLIVE_ID_BEFORE" = "$TEXLIVE_ID_AFTER"
docker image ls "$TEXLIVE_IMAGE"
docker system df
```

Оставшиеся tagged images удаляются только по конкретному image ID после проверки, что image не
используется текущими containers, не равен `$TEXLIVE_ID_BEFORE` и не является PostgreSQL/Redis.

Аварийный cleanup при `no space left on device`:

```bash
df -h
df -i
docker system df -v
docker container prune -f
docker image prune -f
```

Если после этого всё ещё мало места:
- не удалять Docker build cache;
- освободить место на хосте вне Docker cache (`journalctl --vacuum-time=7d`, `apt-get clean`, cleanup логов/артефактов);
- при необходимости увеличить диск VPS перед следующей пересборкой `continuum-texlive-base`.

Что делать запрещено (чтобы не удалить TeX Live base, build cache или runtime data):
- `docker image prune -a`;
- `docker system prune` и `docker system prune -a`;
- `docker builder prune` и `docker builder prune -a`;
- `docker volume prune` (может удалить данные runtime-сервисов);

Validate backend:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/ready
```

## 8) Bootstrap and smoke identities

Первый admin создаётся CLI-командой из раздела 6. После запуска production через реальные
application flows создайте:

- `deploy-smoke-teacher` в `/admin/teachers`;
- `deploy-smoke-student` через созданного преподавателя.

Для постоянного auth smoke используйте student identity и route `/student/me`. Пароль student
хранится только в GitHub Environment secret `AUTH_SMOKE_PASSWORD`.

Для локального/dev seed без UI остаётся идемпотентный helper:

```bash
cd /srv/continuum
docker compose -f docker-compose.prod.yml run --rm --build api sh -lc \
'node apps/api/scripts/seed-users.mjs \
  --teacher-login=teacher1 \
  --teacher-password=Pass123! \
  --student-login=student1 \
  --student-password=Pass123!'
```

## 9) Frontend systemd service

Install service (под `root`):

```bash
cp deploy/systemd/continuum-web.service /etc/systemd/system/continuum-web.service
systemctl daemon-reload
systemctl enable continuum-web
```

Build and run frontend (под `deploy`; Better Auth требует абсолютный production API URL):

```bash
cd /srv/continuum
NEXT_PUBLIC_API_BASE_URL=https://vl-physics.ru/api pnpm --filter web build
sudo -n systemctl restart continuum-web
```

Check:

```bash
curl -fsS http://127.0.0.1:3001/login >/dev/null
```

## 10) Nginx and TLS

1. Replace `app.example.com` in `deploy/nginx/continuum.conf`.
2. Если сертификата ещё нет, не включайте SSL-конфиг сразу. Сначала поднимите bootstrap HTTP-only конфиг:

```bash
cat >/etc/nginx/sites-available/continuum.conf <<'EOF'
server {
  listen 80;
  listen [::]:80;
  server_name app.example.com;

  client_max_body_size 25m;

  location = /api {
    return 301 /api/;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
```

3. Enable and reload nginx:

```bash
ln -sf /etc/nginx/sites-available/continuum.conf /etc/nginx/sites-enabled/continuum.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

4. Issue Let's Encrypt certificate (certbot сам обновит nginx config):

```bash
apt-get update
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d app.example.com --redirect
```

5. Verify HTTPS:

```bash
curl -I https://app.example.com/login
curl -I https://app.example.com/api/health
```

## 11) GitHub Actions secrets (Environment: production)

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `APP_DIR` (example: `/srv/continuum`)
- `APP_DOMAIN` (example: `app.example.com`)
- `AUTH_SMOKE_LOGIN` (production: `deploy-smoke-student`)
- `AUTH_SMOKE_PASSWORD`
- `AUTH_SMOKE_PROTECTED_PATH` (production: `/student/me`)

## 12) Rollback

После первого Better Auth cutover и cleanup migration откат на старый JWT commit не
поддерживается. До появления ценных production данных сбой после reset исправляется roll-forward
или повторным чистым reset. Обычный checkout rollback ниже допустим только между post-cutover
commit, совместимыми с текущей Prisma schema.

```bash
cd /srv/continuum
git log --oneline -n 10
git checkout <previous-commit-or-tag>
export TEXLIVE_BASE_IMAGE="${TEXLIVE_BASE_IMAGE:-continuum-texlive-base:texlive-2022-node20-bookworm}"
export NODE_RUNTIME_IMAGE="${NODE_RUNTIME_IMAGE:-node:24.18.0-bookworm-slim}"
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml build worker
docker compose -f docker-compose.prod.yml up -d worker
NEXT_PUBLIC_API_BASE_URL=https://vl-physics.ru/api pnpm --filter web build
sudo systemctl restart continuum-web
```

Post-rollback checks:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/ready
curl -fsS http://127.0.0.1:3001/login >/dev/null
```

## 13) Что требуется от владельца проекта

Минимум для запуска CI/CD и первого production deploy:

1. GitHub repository URL (SSH) для привязки `origin`.
2. Домен, который уже указывает на VPS (например, `app.example.com`).
3. SSH-доступ к VPS (host, user, private key для GitHub Actions secret `DEPLOY_SSH_KEY`).
4. Заполненные production env-файлы в `/srv/continuum/deploy/env/*.env`:
   - заменить все `CHANGE_ME_*`,
   - выставить корректные `WEB_ORIGIN`, `CORS_ORIGIN`,
   - указать корректный `S3_PUBLIC_BASE_URL`.
5. Подтверждение, что на VPS доступны:
   - Docker + Compose,
   - Node.js 24 + pnpm 10.11.1,
   - `systemd`, `nginx`, `certbot`.
6. Первый Better Auth cutover выполнен по разделу 6; последующие миграции запускает deploy script после build и остановки API/worker.
7. Настроенный GitHub Environment `production` c manual approval и secrets:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `APP_DIR`, `APP_DOMAIN`, `AUTH_SMOKE_LOGIN`, `AUTH_SMOKE_PASSWORD`, `AUTH_SMOKE_PROTECTED_PATH`.

## 14) Troubleshooting (production-first)

- После `docker compose up -d` на production поднялись `minio`/dev-сервисы и/или `api` упал с `Bind for 127.0.0.1:3000 failed: port is already allocated`:
  - причина: был запущен dev compose (`docker-compose.yml`) вместо production compose;
  - исправление:
    - `docker compose down --remove-orphans`
    - (опционально, если нужно очистить dev-тома) `docker compose down --remove-orphans -v`
    - `docker compose -f docker-compose.prod.yml up -d postgres redis`
    - `docker compose -f docker-compose.prod.yml build api`
    - `docker compose -f docker-compose.prod.yml up -d api`
    - `docker compose -f docker-compose.prod.yml up -d worker`
  - проверка:
    - `docker compose -f docker-compose.prod.yml ps`
    - `curl -fsS http://127.0.0.1:3000/health`

- `BETTER_AUTH_SECRET must be set in production` при старте `api`:
  - заполнить `BETTER_AUTH_SECRET` и `BETTER_AUTH_URL` в `deploy/env/api.env`;
  - `docker compose -f docker-compose.prod.yml up -d --build api`.

- `Failed to restart continuum-web.service: Unit ... not found`:
  - unit-файл ещё не установлен в `/etc/systemd/system/`;
  - установить unit под `root`, затем `systemctl daemon-reload && systemctl enable continuum-web`.

- `nginx -t` падает на `cannot load certificate ... fullchain.pem`:
  - вы применили SSL-конфиг до выпуска certbot;
  - сначала используйте HTTP bootstrap-конфиг, затем `certbot --nginx`.

- `sudo` под `deploy` просит пароль:
  - без отдельного sudoers-правила это ожидаемо;
  - минимально для deploy-пайплайна: NOPASSWD на `systemctl restart continuum-web`.

- `worker` build снова скачивает `TeX Live` и занимает много времени:
  - причина: потерян/отсутствует image `continuum-texlive-base` либо вручную запущена его лишняя пересборка;
  - исправление:
    - для обычного релиза собирать только изменившийся сервис (чаще `api`);
    - `worker` собирать отдельно только при изменениях в `apps/worker`, `packages/latex-runtime`, `packages/shared` или worker app-слое;
    - `continuum-texlive-base` пересобирать только при изменениях в `apps/worker/Dockerfile.texlive-base` или `scripts/install-texlive-runtime.sh`;
    - не использовать `docker builder prune -a` / `docker system prune -a` (policy запрет для production deploy цикла).

- build падает с `no space left on device`:
  - причина: закончился disk space (или inode) во время сборки/распаковки тяжёлых слоёв (включая TeX Live);
  - исправление:
    - `df -h` и `df -i`;
    - `docker system df -v`;
    - `docker image prune -a -f` и `docker container prune -f`;
    - не удалять build cache; если места всё равно мало — чистить host-level логи/кеши и расширять диск VPS;
  - проверка: после cleanup есть устойчивый запас места, затем при необходимости `docker build -f apps/worker/Dockerfile.texlive-base -t "$TEXLIVE_BASE_IMAGE" .` и `docker compose -f docker-compose.prod.yml build worker` завершаются успешно.

- API 500 с Prisma `P2022` / `column sections.description does not exist` после `git pull`:
  - причина: код уже использует новую колонку, но миграция не была применена в текущий контейнерный образ;
  - запускать миграции через rebuild: `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && pnpm --filter @continuum/api exec prisma migrate deploy'`;
  - дополнительно проверить статус: `docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'pnpm --filter @continuum/api exec prisma migrate status'`;
  - если колонка всё ещё отсутствует, проверить БД напрямую: `docker compose -f docker-compose.prod.yml exec -T postgres psql -U continuum -d continuum -c "SELECT column_name FROM information_schema.columns WHERE table_schema='\''public'\'' AND table_name='\''sections'\'' AND column_name='\''description'\'';"`.

- API уходит в restart-loop с `Cannot find module '.prisma/client/default'`:
  - причина: runner stage `apps/api/Dockerfile` использует `node_modules` из stage `deps`, а `prisma generate` выполняется в `builder`;
  - исправление:
    - убедиться, что в runner stage `COPY --from=builder /app/node_modules ./node_modules` и `COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules`;
    - пересобрать и перезапустить API: `docker compose -f docker-compose.prod.yml build --no-cache api && docker compose -f docker-compose.prod.yml up -d --force-recreate api`;
  - проверка:
    - `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/health` = `200`;
    - `docker compose -f docker-compose.prod.yml logs --no-color --tail=120 api` не содержит `MODULE_NOT_FOUND`.
