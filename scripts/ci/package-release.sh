#!/usr/bin/env bash
set -euo pipefail
bundle=${1:?Output directory required}
[ -z "$(git status --porcelain)" ] || { echo 'Release requires a clean checkout'; exit 1; }
mkdir -p "$bundle"
fingerprint=$(node scripts/ci/release.mjs fingerprint)
image="continuum-release-api:$fingerprint"
docker tag continuum-prod-api "$image"
docker image save "$image" | gzip -1 > "$bundle/api-image.tar.gz"
[ -f apps/web/.next/standalone/apps/web/server.js ]
web_dir=$(mktemp -d)
trap 'rm -rf "$web_dir"' EXIT
cp -a apps/web/.next/standalone/. "$web_dir/"
mkdir -p "$web_dir/apps/web/.next"
cp -a apps/web/.next/static "$web_dir/apps/web/.next/static"
cp -a apps/web/public "$web_dir/apps/web/public"
tar -czf "$bundle/web.tar.gz" -C "$web_dir" .
node scripts/ci/release.mjs manifest "$bundle" "$(docker image inspect "$image" --format '{{.Id}}')"
(cd "$bundle" && sha256sum api-image.tar.gz web.tar.gz release.json > SHA256SUMS)
