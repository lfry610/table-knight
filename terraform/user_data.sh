#!/bin/bash
set -euo pipefail

apt-get update -y
apt-get install -y docker.io debian-keyring debian-archive-keyring apt-transport-https curl

# ── Caddy ──────────────────────────────────────────────────────────────────────
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

cat > /etc/caddy/Caddyfile <<EOF
${api_domain} {
    reverse_proxy 127.0.0.1:${api_port}
}
EOF

systemctl enable caddy
systemctl start caddy

# ── Docker / Postgres ──────────────────────────────────────────────────────────
systemctl enable docker
systemctl start docker

docker run -d \
  --name postgres \
  --restart always \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=${db_password} \
  -e POSTGRES_DB=table_knight \
  -p 127.0.0.1:5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine

# ── API ────────────────────────────────────────────────────────────────────────
mkdir -p /opt/table-knight

cat > /opt/table-knight/.env <<EOF
DATABASE_URL=postgres://postgres:${db_password}@127.0.0.1:5432/table_knight?sslmode=disable
JWT_SECRET=${jwt_secret}
PORT=${api_port}
APP_ENV=production
FRONTEND_URL=${frontend_url}
ALLOWED_ORIGIN=${frontend_url}
GOOGLE_CLIENT_ID=${google_client_id}
GOOGLE_CLIENT_SECRET=${google_client_secret}
GOOGLE_REDIRECT_URL=https://${api_domain}/auth/google/callback
EOF
chmod 600 /opt/table-knight/.env

cat > /etc/systemd/system/table-knight-api.service <<'UNIT'
[Unit]
Description=Table Knight API
After=network.target docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/table-knight
EnvironmentFile=/opt/table-knight/.env
ExecStart=/opt/table-knight/table-knight-api
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable table-knight-api

chown -R ubuntu:ubuntu /opt/table-knight
