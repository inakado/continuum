#!/usr/bin/env bash
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

: "${APP_DIR:=/srv/continuum}"
: "${PREVIOUS_HEAD:=}"
: "${MIGRATIONS_APPROVED:=no}"
: "${TEXLIVE_BASE_IMAGE:=continuum-texlive-base:texlive-2022-node20-bookworm}"
: "${REBUILD_WORKER:=auto}"
: "${REBUILD_WORKER_BASE:=never}"
: "${AUTH_SMOKE_PROTECTED_PATH:=/student/me}"

export TEXLIVE_BASE_IMAGE

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

for name in BETTER_AUTH_SECRET BETTER_AUTH_URL WEB_ORIGIN CORS_ORIGIN WORKER_INTERNAL_TOKEN; do
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

current_head="$(git rev-parse HEAD)"
if [ -n "$PREVIOUS_HEAD" ] && git cat-file -e "$PREVIOUS_HEAD^{commit}" 2>/dev/null; then
  changed_files="$(git diff --name-only "$PREVIOUS_HEAD" "$current_head")"
else
  changed_files=""
  REBUILD_WORKER=always
fi

needs_worker_rebuild() {
  case "$REBUILD_WORKER" in
    always) return 0 ;;
    never) return 1 ;;
  esac

  while IFS= read -r file; do
    case "$file" in
      apps/worker/*|packages/latex-runtime/*|packages/shared/*|pnpm-lock.yaml|package.json)
        return 0
        ;;
    esac
  done <<EOF
$changed_files
EOF

  return 1
}

needs_worker_base_rebuild() {
  if ! docker image inspect "$TEXLIVE_BASE_IMAGE" >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r file; do
    case "$file" in
      apps/worker/Dockerfile.texlive-base|scripts/install-texlive-runtime.sh)
        return 0
        ;;
    esac
  done <<EOF
$changed_files
EOF

  return 1
}

echo "Deploying commit: $current_head"
echo "Changed files since previous deploy:"
if [ -n "$changed_files" ]; then
  printf '%s\n' "$changed_files"
else
  echo "(unknown; worker rebuild forced)"
fi

if needs_worker_base_rebuild; then
  if [ "$REBUILD_WORKER_BASE" != "always" ]; then
    echo "TeX Live base rebuild is required but not approved."
    echo "Build it manually, or rerun with REBUILD_WORKER_BASE=always."
    exit 1
  fi
  docker build -f apps/worker/Dockerfile.texlive-base -t "$TEXLIVE_BASE_IMAGE" .
else
  echo "Skipping TeX Live base rebuild: $TEXLIVE_BASE_IMAGE"
fi

pnpm install --frozen-lockfile
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml build api

if needs_worker_rebuild || [ "$REBUILD_WORKER_BASE" = "always" ]; then
  docker compose -f docker-compose.prod.yml build worker
else
  echo "Skipping worker application image rebuild"
fi

NEXT_PUBLIC_API_BASE_URL="https://${APP_DOMAIN}/api" pnpm --filter web build

if [ "$MIGRATIONS_APPROVED" != "yes" ]; then
  echo "Set MIGRATIONS_APPROVED=yes to allow prisma migrate deploy."
  exit 1
fi

docker compose -f docker-compose.prod.yml stop api worker || true
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'
docker compose -f docker-compose.prod.yml up -d api worker
sudo -n systemctl restart continuum-web

wait_for_http http://127.0.0.1:3000/health "API health"
wait_for_http http://127.0.0.1:3000/ready "API readiness"
wait_for_http http://127.0.0.1:3001/login "Frontend"

wait_for_http "https://${APP_DOMAIN}/api/health" "Public API"
wait_for_http "https://${APP_DOMAIN}/login" "Public frontend"

if [ -n "${AUTH_SMOKE_LOGIN:-}" ] || [ -n "${AUTH_SMOKE_PASSWORD:-}" ]; then
  if [ -z "${APP_DOMAIN:-}" ] || [ -z "${AUTH_SMOKE_LOGIN:-}" ] || [ -z "${AUTH_SMOKE_PASSWORD:-}" ]; then
    echo "APP_DOMAIN, AUTH_SMOKE_LOGIN and AUTH_SMOKE_PASSWORD are all required for auth smoke."
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
