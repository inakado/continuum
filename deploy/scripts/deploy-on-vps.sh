#!/usr/bin/env bash
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

: "${APP_DIR:=/srv/continuum}"
: "${MIGRATIONS_APPROVED:=no}"
: "${AUTH_SMOKE_PROTECTED_PATH:=/me}"

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempt

  for ((attempt = 1; attempt <= 30; attempt += 1)); do
    if curl --connect-timeout 2 --max-time 5 -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "$label did not become ready: $url"
  curl --connect-timeout 2 --max-time 5 -fsS "$url" >/dev/null
}

if [ "$(id -u)" -eq 0 ]; then
  echo "Run deploy as the deploy user, not root."
  exit 1
fi

cd "$APP_DIR"

if [ -n "$(git status --short)" ]; then
  echo "Working tree must be clean before deploy."
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" != "24" ]; then
  echo "Node.js 24 is required on the VPS host; current: $(node -v)"
  exit 1
fi

if [ "$(pnpm --version)" != "10.11.1" ]; then
  echo "pnpm 10.11.1 is required; current: $(pnpm --version)"
  exit 1
fi

if [ ! -f "deploy/env/api.env" ]; then
  echo "deploy/env/api.env is required"
  exit 1
fi

set -a
. ./deploy/env/api.env
set +a

for name in BETTER_AUTH_SECRET BETTER_AUTH_URL WEB_ORIGIN CORS_ORIGIN; do
  if [ -z "${!name:-}" ]; then
    echo "$name is required in deploy/env/api.env"
    exit 1
  fi
done

if [ -z "${APP_DOMAIN:-}" ]; then
  echo "APP_DOMAIN is required for the production web build"
  exit 1
fi

if [ ${#BETTER_AUTH_SECRET} -lt 32 ]; then
  echo "BETTER_AUTH_SECRET must contain at least 32 characters"
  exit 1
fi

echo "Deploying commit: $(git rev-parse HEAD)"

pnpm install --frozen-lockfile
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml build api
NEXT_PUBLIC_API_BASE_URL="https://${APP_DOMAIN}/api" pnpm --filter web build

docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  node apps/api/scripts/configure-s3-cors.mjs

cors_probe_headers=''
for ((attempt = 1; attempt <= 30; attempt += 1)); do
  cors_probe_headers="$(curl --connect-timeout 5 --max-time 15 -sSi -X OPTIONS \
    "${S3_PUBLIC_BASE_URL%/}/${S3_BUCKET}/continuum-cors-probe" \
    -H "Origin: ${WEB_ORIGIN}" \
    -H 'Access-Control-Request-Method: PUT' \
    -H 'Access-Control-Request-Headers: content-type' || true)"
  if printf '%s\n' "$cors_probe_headers" | grep -Fiq "Access-Control-Allow-Origin: ${WEB_ORIGIN}"; then
    break
  fi
  sleep 1
done
if ! printf '%s\n' "$cors_probe_headers" | grep -Fiq "Access-Control-Allow-Origin: ${WEB_ORIGIN}"; then
  echo 'S3 CORS preflight did not allow the production web origin.'
  exit 1
fi

if [ "$MIGRATIONS_APPROVED" != "yes" ]; then
  echo "Set MIGRATIONS_APPROVED=yes to allow prisma migrate deploy."
  exit 1
fi

docker compose -f docker-compose.prod.yml stop api || true
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'
docker compose -f docker-compose.prod.yml up -d api
sudo -n systemctl restart continuum-web

wait_for_http http://127.0.0.1:3000/health "API health"
wait_for_http http://127.0.0.1:3000/ready "API readiness"
wait_for_http http://127.0.0.1:3001/login "Frontend"
wait_for_http "https://${APP_DOMAIN}/api/health" "Public API"
wait_for_http "https://${APP_DOMAIN}/login" "Public frontend"

if [ -n "${AUTH_SMOKE_LOGIN:-}" ] || [ -n "${AUTH_SMOKE_PASSWORD:-}" ]; then
  if [ -z "${AUTH_SMOKE_LOGIN:-}" ] || [ -z "${AUTH_SMOKE_PASSWORD:-}" ]; then
    echo "AUTH_SMOKE_LOGIN and AUTH_SMOKE_PASSWORD must be set together."
    exit 1
  fi

  docker compose -f docker-compose.prod.yml exec -T \
    -e API_URL="https://${APP_DOMAIN}/api" \
    -e AUTH_SMOKE_ORIGIN="https://${APP_DOMAIN}" \
    -e AUTH_SMOKE_LOGIN="$AUTH_SMOKE_LOGIN" \
    -e AUTH_SMOKE_PASSWORD="$AUTH_SMOKE_PASSWORD" \
    -e AUTH_SMOKE_PROTECTED_PATH="$AUTH_SMOKE_PROTECTED_PATH" \
    api sh -lc 'cd /app/apps/api && pnpm smoke:auth'
fi

echo "Deploy checks passed"
