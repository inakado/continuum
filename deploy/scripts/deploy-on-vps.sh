#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_REF:=main}"
: "${APP_DIR:=/srv/continuum}"

cd "$APP_DIR"

if [ ! -f "deploy/env/api.env" ]; then
  echo "deploy/env/api.env is required"
  exit 1
fi

set -a
. ./deploy/env/api.env
set +a

git fetch --all --prune
git checkout "$DEPLOY_REF"
git pull --ff-only origin "$DEPLOY_REF"

pnpm install --frozen-lockfile

echo "Run DB migration manually before continuing if schema changed:"
echo "DATABASE_URL=... pnpm --filter @continuum/api exec prisma migrate deploy"

docker compose -f docker-compose.prod.yml up -d --build postgres redis minio api worker

NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build
sudo systemctl restart continuum-web

curl -fsS http://127.0.0.1:3000/health >/dev/null
curl -fsS http://127.0.0.1:3000/ready >/dev/null
curl -fsS http://127.0.0.1:3001/login >/dev/null
curl -fsS -X POST http://127.0.0.1:3000/debug/enqueue-ping \
  -H 'Content-Type: application/json' \
  -d '{"from":"manual-deploy"}' >/dev/null

echo "Deploy checks passed"
