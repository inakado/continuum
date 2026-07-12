#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  nginx \
  certbot \
  python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [ "$node_major" != "24" ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo corepack enable
sudo corepack prepare pnpm@10.11.1 --activate
