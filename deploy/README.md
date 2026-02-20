# Deploy Guide (Beget VPS, Ubuntu/Debian)

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
- strong `JWT_SECRET`
- secure `WORKER_INTERNAL_TOKEN`
- consistent DB settings across all files
- real production value for `WEB_ORIGIN` and `CORS_ORIGIN`
- Beget S3 credentials and endpoint (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
- externally reachable HTTPS for `S3_PUBLIC_BASE_URL`

Production policy:
- use external S3 provider (Beget S3) in production;
- MinIO используется только в local/dev и не входит в `docker-compose.prod.yml`.

## 5) Start production backend stack

```bash
cd /srv/continuum
docker compose -f docker-compose.prod.yml up -d postgres redis
```

Policy: backend build выполняется только в Docker.

## 6) Manual DB migration before deploy

Важно: для production не запускаем миграции с хоста через `pnpm ... prisma migrate deploy`,
потому что `DATABASE_URL` обычно указывает на `postgres:5432` (имя сервиса внутри docker network),
а это имя не резолвится на хосте.

```bash
cd /srv/continuum
docker compose -f docker-compose.prod.yml run --rm api \
  sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'
```

## 7) Start API and Worker

```bash
cd /srv/continuum
docker compose -f docker-compose.prod.yml up -d --build api worker
```

Validate backend:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/ready
```

## 8) Seed teacher/student (optional, for first login)

Если в базе ещё нет пользователей, создайте базовые аккаунты:

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

Build and run frontend (под `deploy`):

```bash
cd /srv/continuum
NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build
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

## 12) Rollback

```bash
cd /srv/continuum
git log --oneline -n 10
git checkout <previous-commit-or-tag>
docker compose -f docker-compose.prod.yml up -d --build api worker
NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build
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
   - Node 20 + pnpm,
   - `systemd`, `nginx`, `certbot`.
6. Ручной запуск миграций перед первым deploy:
   - `docker compose -f docker-compose.prod.yml run --rm api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'`
7. Настроенный GitHub Environment `production` c manual approval и secrets:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `APP_DIR`, `APP_DOMAIN`.

## 14) Troubleshooting (production-first)

- `JWT_SECRET must be set in production` при старте `api`:
  - заполнить `JWT_SECRET` в `deploy/env/api.env`;
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
