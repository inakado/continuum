#!/usr/bin/env bash
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

: "${DEPLOY_REF:=main}"
: "${APP_DIR:=/srv/continuum}"
: "${TEXLIVE_BASE_IMAGE:=continuum-texlive-base:texlive-2022-node20-bookworm}"
: "${REBUILD_WORKER:=auto}"
: "${REBUILD_WORKER_BASE:=auto}"

cd "$APP_DIR"

if [ ! -f "deploy/env/api.env" ]; then
  echo "deploy/env/api.env is required"
  exit 1
fi

set -a
. ./deploy/env/api.env
set +a

previous_head="$(git rev-parse HEAD)"
git fetch --all --prune
git checkout "$DEPLOY_REF"
git pull --ff-only origin "$DEPLOY_REF"
current_head="$(git rev-parse HEAD)"

changed_files="$(git diff --name-only "$previous_head" "$current_head" || true)"

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
  case "$REBUILD_WORKER_BASE" in
    always) return 0 ;;
    never) return 1 ;;
  esac

  if ! docker image inspect "$TEXLIVE_BASE_IMAGE" >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r file; do
    case "$file" in
      apps/worker/Dockerfile.texlive-base|scripts/install-texlive-runtime.sh|pnpm-lock.yaml|package.json)
        return 0
        ;;
    esac
  done <<EOF
$changed_files
EOF

  return 1
}

export TEXLIVE_BASE_IMAGE

if needs_worker_base_rebuild; then
  worker_base_rebuild_required=1
else
  worker_base_rebuild_required=0
fi

if needs_worker_rebuild; then
  worker_rebuild_required=1
else
  worker_rebuild_required=0
fi

echo "Changed files since previous deploy:"
if [ -n "$changed_files" ]; then
  printf '%s\n' "$changed_files"
else
  echo "(none)"
fi

echo "Worker base rebuild required: $worker_base_rebuild_required"
echo "Worker rebuild required: $worker_rebuild_required"

echo "Run DB migration manually before continuing if schema changed:"
echo "docker compose -f docker-compose.prod.yml run --rm --build api sh -lc 'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && pnpm --filter @continuum/api exec prisma migrate deploy'"

docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api

if [ "$worker_base_rebuild_required" -eq 1 ]; then
  echo "Rebuilding worker runtime base image: $TEXLIVE_BASE_IMAGE"
  docker build -f apps/worker/Dockerfile.texlive-base -t "$TEXLIVE_BASE_IMAGE" .
else
  echo "Skipping worker runtime base rebuild"
fi

if [ "$worker_rebuild_required" -eq 1 ] || [ "$worker_base_rebuild_required" -eq 1 ]; then
  echo "Rebuilding worker image"
  docker compose -f docker-compose.prod.yml build worker
else
  echo "Skipping worker image rebuild"
fi

docker compose -f docker-compose.prod.yml up -d worker

NEXT_PUBLIC_API_BASE_URL=/api pnpm --filter web build
sudo systemctl restart continuum-web

curl -fsS http://127.0.0.1:3000/health >/dev/null
curl -fsS http://127.0.0.1:3000/ready >/dev/null
curl -fsS http://127.0.0.1:3001/login >/dev/null
curl -fsS -X POST http://127.0.0.1:3000/debug/enqueue-ping \
  -H 'Content-Type: application/json' \
  -d '{"from":"manual-deploy"}' >/dev/null

echo "Deploy checks passed"
