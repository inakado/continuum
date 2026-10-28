#!/usr/bin/env bash
set -euo pipefail
: "${APP_DIR:=/srv/continuum}"
: "${MIGRATIONS_APPROVED:=no}"
: "${BACKUP_CONFIRMED:=no}"
bundle=$(realpath "${1:?Pass the downloaded CI bundle directory}")
[ "$(id -u)" -ne 0 ] || { echo 'Run as deploy, not root'; exit 1; }
cd "$APP_DIR"
[ -z "$(git status --short)" ] || { echo 'Checkout must be clean'; exit 1; }
state="$APP_DIR/deploy/runtime"
releases="$APP_DIR/deploy/releases"
mkdir -p "$state" "$releases"
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
set -a
. ./deploy/env/api.env
set +a
: "${APP_DOMAIN:?APP_DOMAIN required}"
[ "${#BETTER_AUTH_SECRET}" -ge 32 ]
if [ "${PREPARE_ONLY:-no}" != yes ]; then
  systemctl cat continuum-web | grep -Fq '/srv/continuum/deploy/scripts/start-web.sh' || { echo 'Install the verified release web launcher first'; exit 1; }
fi
fingerprint=$(node scripts/ci/release.mjs fingerprint)
python3 deploy/scripts/release_bundle.py verify "$bundle" "$fingerprint" "https://$APP_DOMAIN/api" > "$state/candidate.json"
field() { python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$state/candidate.json" "$1"; }
image=$(field apiImage)
image_id=$(field apiImageId)
compose=(docker compose -f docker-compose.prod.yml)
old_container=$("${compose[@]}" ps -q api)
[ -n "$old_container" ]
old_image=$(docker inspect "$old_container" --format '{{.Image}}')
old_web=$(readlink -f "$APP_DIR/deploy/current" || true)
if [ ! -d "$old_web" ]; then old_web=''; fi
if [ -n "$old_web" ]; then
  [[ "$old_web" =~ ^$releases/[a-f0-9]{64}$ ]] || { echo 'Unexpected current web path'; exit 1; }
fi
wait_http() {
  local url=$1
  for i in {1..30}; do
    if curl --connect-timeout 2 --max-time 5 -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Not ready: $url" >&2
  return 1
}
if [ -f "$state/current.json" ] && [ "$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d["fingerprint"]+":"+d["apiImageId"])' "$state/current.json")" = "$fingerprint:$old_image" ] && [ "$old_web" = "$releases/$fingerprint" ]; then
  wait_http http://127.0.0.1:3000/ready
  wait_http http://127.0.0.1:3001/login
  echo 'This checked source is already deployed'
  exit 0
fi
"${compose[@]}" exec -T -w /app/apps/api api node -e '
const {PrismaService}=require("./dist/prisma/prisma.service");const db=new PrismaService();
db.$queryRawUnsafe("SELECT migration_name AS name, checksum, finished_at AS finished, rolled_back_at AS \"rolledBack\" FROM _prisma_migrations")
.then(rows=>console.log(JSON.stringify(rows))).finally(()=>db.$disconnect()).catch(()=>process.exitCode=1);
' > "$state/applied.json"
pending=$(python3 deploy/scripts/release_bundle.py migrations "$state/candidate.json" "$state/applied.json")
if [ -n "$pending" ] && { [ "$MIGRATIONS_APPROVED" != yes ] || [ "$BACKUP_CONFIRMED" != yes ]; }; then
  echo 'New migrations require MIGRATIONS_APPROVED=yes and confirmed provider backup (BACKUP_CONFIRMED=yes)'
  exit 1
fi
loaded=$(docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true)
if [ "$loaded" != "$image_id" ]; then docker image load -i "$bundle/api-image.tar.gz"; fi
[ "$(docker image inspect "$image" --format '{{.Id}}')" = "$image_id" ]
prepared="$releases/$fingerprint"
if [ -d "$prepared" ]; then
  cmp "$bundle/SHA256SUMS" "$prepared/SHA256SUMS" || { echo 'Conflicting prepared release'; exit 1; }
else
  stage=$(mktemp -d "$releases/.prepare-XXXXXX")
  trap 'rm -rf "${stage:-}"' EXIT
  mkdir "$stage/web"
  python3 deploy/scripts/release_bundle.py extract "$bundle" "$stage/web"
  cp "$bundle/release.json" "$bundle/SHA256SUMS" "$stage/"
  mv "$stage" "$prepared"
  stage=''
  trap - EXIT
fi
if [ "${PREPARE_ONLY:-no}" = yes ]; then echo "Prepared $fingerprint; runtime unchanged"; exit 0; fi
export CONTINUUM_API_IMAGE="$image"
rollback() {
  local status=$?
  trap - EXIT
  if [ "$status" -eq 0 ]; then return; fi
  echo 'Activation failed; restoring previous runtime (database is not reset)' >&2
  if [ -n "$old_web" ]; then
    ln -sfn "$old_web" "$state/web-rollback"
    mv -Tf "$state/web-rollback" "$APP_DIR/deploy/current"
  else
    rm -f "$APP_DIR/deploy/current"
  fi
  CONTINUUM_API_IMAGE="$old_image" "${compose[@]}" up -d --no-build --pull never --no-deps api || true
  sudo -n systemctl restart continuum-web || true
  exit "$status"
}
trap rollback EXIT
if [ -n "$pending" ]; then
  "${compose[@]}" stop api
  "${compose[@]}" run --rm -T --no-deps api sh -lc 'pnpm --filter @continuum/api exec prisma migrate deploy'
fi
"${compose[@]}" up -d --no-build --pull never --no-deps api
ln -sfn "$prepared" "$state/web-next"
mv -Tf "$state/web-next" "$APP_DIR/deploy/current"
sudo -n systemctl restart continuum-web
wait_http http://127.0.0.1:3000/ready
wait_http http://127.0.0.1:3001/login
wait_http "https://$APP_DOMAIN/api/ready"
wait_http "https://$APP_DOMAIN/login"
python3 - "$state" "$old_image" "$old_web" <<'PY'
import json,sys
from pathlib import Path
state,old_image,old_web=Path(sys.argv[1]),sys.argv[2],sys.argv[3]
old={'apiImageId':old_image,'webPath':old_web or None,'fingerprint':Path(old_web).name if old_web else None}
(state/'previous.json').write_text(json.dumps(old))
(state/'candidate.json').replace(state/'current.json')
PY
trap - EXIT
rm -f "$state/applied.json"
python3 deploy/scripts/prune-releases.py "$APP_DIR/deploy"
echo "Deploy checks passed: $fingerprint (no install/build, no data backup created)"
