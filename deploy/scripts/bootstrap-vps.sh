#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run bootstrap as root'; exit 1; }
: "${APP_DIR:=/srv/continuum}"
: "${DEPLOY_PUBLIC_KEY_FILE:?Path to operator public key required}"
[[ "$APP_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$APP_DIR" != *..* ]] || exit 1
ssh-keygen -lf "$DEPLOY_PUBLIC_KEY_FILE" >/dev/null
export DEBIAN_FRONTEND=noninteractive
docker_installed=no
if ! command -v certbot >/dev/null || ! command -v nginx >/dev/null; then
  apt-get update
  apt-get install -y ca-certificates curl git gnupg nginx certbot python3-certbot-nginx ufw
fi
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  docker_installed=yes
fi
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [ "$node_major" != "24" ]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@10.11.1 --activate
if ! id deploy >/dev/null 2>&1; then useradd --create-home --shell /bin/bash deploy; fi
runuser -l deploy -c 'corepack prepare pnpm@10.11.1 --activate'
usermod -aG docker deploy
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
key=$(cat "$DEPLOY_PUBLIC_KEY_FILE")
if ! grep -qxF "$key" /home/deploy/.ssh/authorized_keys; then printf '\n%s\n' "$key" >> /home/deploy/.ssh/authorized_keys; fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
install -d -o deploy -g deploy -m 750 "$APP_DIR"
printf 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart continuum-web\n' > /etc/sudoers.d/continuum-deploy
chmod 440 /etc/sudoers.d/continuum-deploy
visudo -cf /etc/sudoers.d/continuum-deploy
if [ ! -f /swap-continuum ]; then
  fallocate -l 2G /swap-continuum
  chmod 600 /swap-continuum
  mkswap /swap-continuum
fi
if ! swapon --show=NAME --noheadings | grep -qxF /swap-continuum; then swapon /swap-continuum; fi
if ! grep -q '^/swap-continuum ' /etc/fstab; then printf '/swap-continuum none swap sw 0 0\n' >> /etc/fstab; fi
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/etc/docker/daemon.json')
config=json.loads(p.read_text()) if p.exists() else {}
config.setdefault('log-driver','local')
config.setdefault('log-opts',{'max-size':'10m','max-file':'3'})
p.write_text(json.dumps(config,indent=2)+'\n')
PY
systemctl enable --now docker nginx
if [ "$docker_installed" = yes ]; then systemctl restart docker; fi
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

# After cloning, rerun bootstrap once to install the launcher for this checkout.
if [ -f "$APP_DIR/deploy/systemd/continuum-web.service" ]; then
  : "${APP_DOMAIN:?Public application hostname required}"
  [[ "$APP_DOMAIN" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z0-9-]+$ ]] || exit 1
  sed "s|/srv/continuum|$APP_DIR|g" "$APP_DIR/deploy/systemd/continuum-web.service" > /etc/systemd/system/continuum-web.service
  systemctl daemon-reload
  systemctl enable continuum-web
  if [ ! -f "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" ]; then
    install -d -m 755 /var/www/certbot
    cat > /etc/nginx/sites-available/continuum.conf <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $APP_DOMAIN;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 503; }
}
EOF
    ln -sfn /etc/nginx/sites-available/continuum.conf /etc/nginx/sites-enabled/continuum.conf
    nginx -t
    systemctl reload nginx
    certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos --register-unsafely-without-email -d "$APP_DOMAIN"
  fi
  sed "s/app.example.com/$APP_DOMAIN/g" "$APP_DIR/deploy/nginx/continuum.conf" > /etc/nginx/sites-available/continuum.conf
  ln -sfn /etc/nginx/sites-available/continuum.conf /etc/nginx/sites-enabled/continuum.conf
  nginx -t
  systemctl reload nginx
  systemctl enable --now certbot.timer
fi
if [ "${HARDEN_SSH:-no}" = yes ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-continuum.conf
  sshd -t
  systemctl reload ssh
fi
echo 'Base ready; verify deploy SSH before changing SSH authentication policy.'
