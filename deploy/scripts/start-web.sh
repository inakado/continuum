#!/usr/bin/env bash
set -euo pipefail
: "${APP_DIR:=/srv/continuum}"
if [ -f "$APP_DIR/deploy/current/web/apps/web/server.js" ]; then
  exec node "$APP_DIR/deploy/current/web/apps/web/server.js"
fi
# Переходный откат первого artifact-release к прежней сборке, без её пересборки.
cd "$APP_DIR"
exec pnpm --filter web start --hostname 127.0.0.1 --port "${PORT:-3001}"
