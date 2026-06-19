#!/bin/bash
set -euo pipefail

APP_ROOT="/usr/local/WhatsApp_Banking_React"
NGINX_CONF="/etc/nginx/conf.d/whatsapp-banking.conf"

echo "==> Installing nginx if missing..."
if command -v yum >/dev/null 2>&1; then
  sudo yum install -y nginx || true
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y nginx
fi

echo "==> Deploying nginx site config..."
sudo cp "$APP_ROOT/deploy/nginx-whatsapp-banking.conf" "$NGINX_CONF"
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "==> Done. App root: $APP_ROOT/dist"
echo "Test: http://10.2.0.30/?service=openfd&customerId=<id>&mobile=<mobile>"
