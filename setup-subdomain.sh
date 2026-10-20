#!/usr/bin/env bash
# ==============================================================================
# Скрипт первичной настройки поддомена на сервере Ubuntu / Debian
# Запускать на самом сервере: sudo bash setup-subdomain.sh
# ==============================================================================
set -euo pipefail

SUBDOMAIN="${1:-stroy.castleweb.ru}"
WEB_ROOT="${2:-/var/www/stroy-landing}"

echo "=================================================="
echo "   НАСТРОЙКА ПОДДОМЕНА ДЛЯ ЛЕНДИНГА"
echo "   Поддомен: $SUBDOMAIN"
echo "   Папка:    $WEB_ROOT"
echo "=================================================="

# 1. Создание папки для сайта
echo "[*] Создание веб-директории $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
chmod -R 755 "$WEB_ROOT"

# Если файлов сайта ещё нет, создадим временную заглушку
if [ ! -f "$WEB_ROOT/index.html" ]; then
    cat <<EOF > "$WEB_ROOT/index.html"
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>$SUBDOMAIN — Скоро запуск</title>
    <style>
        body { font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        p { color: #94a3b8; font-size: 1.1rem; }
    </style>
</head>
<body>
    <h1>🏗️ $SUBDOMAIN</h1>
    <p>Поддомен успешно настроен. Загрузите файлы лендинга через deploy.ps1.</p>
</body>
</html>
EOF
fi

# 2. Проверка типа Nginx (Docker-контейнер или системный Nginx)
if docker ps --format '{{.Names}}' | grep -q "castleweb_prod_nginx"; then
    echo "[*] Обнаружен Docker-контейнер Nginx (castleweb_prod_nginx)..."
    
    # Путь к конфигурациям проекта
    COMPOSE_DIR="$(find /var/www -name 'docker-compose.prod.yml' -exec dirname {} \; | head -n 1)"
    if [ -z "$COMPOSE_DIR" ]; then
        COMPOSE_DIR="/var/www/castleweb"
    fi
    
    NGINX_CONF_DIR="$COMPOSE_DIR/nginx/conf.d"
    mkdir -p "$NGINX_CONF_DIR"
    
    CONF_FILE="$NGINX_CONF_DIR/subdomain_${SUBDOMAIN//./_}.conf"
    
    cat <<EOF > "$CONF_FILE"
# Конфигурация поддомена $SUBDOMAIN (Cloudflare SSL)
server {
    listen 80;
    listen [::]:80;
    server_name $SUBDOMAIN;

    # Let's Encrypt ACME challenge (если нужен)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Редирект на HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $SUBDOMAIN;

    # Используются сертификаты Cloudflare Origin или Let's Encrypt домена
    ssl_certificate /etc/letsencrypt/live/castleweb.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/castleweb.ru/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Защитные заголовки
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Статические файлы лендинга
    location / {
        root $WEB_ROOT;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Кэширование CSS и JS (1 месяц)
    location ~* \.(?:css|js|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$ {
        root $WEB_ROOT;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
}
EOF
    echo "[+] Конфиг создан: $CONF_FILE"
    
    # Проверка и перезагрузка Nginx в Docker
    docker exec castleweb_prod_nginx nginx -t
    docker exec castleweb_prod_nginx nginx -s reload
    echo "[+] Nginx в Docker успешно перезагружен!"

elif command -v nginx >/dev/null 2>&1; then
    echo "[*] Обнаружен системный Nginx на хосте..."
    CONF_FILE="/etc/nginx/sites-available/$SUBDOMAIN.conf"
    
    cat <<EOF > "$CONF_FILE"
server {
    listen 80;
    listen [::]:80;
    server_name $SUBDOMAIN;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
}
EOF
    ln -sf "$CONF_FILE" /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx
    echo "[+] Системный Nginx успешно настроен и перезагружен!"
    
    # Предложение получить бесплатный Let's Encrypt через Certbot
    if command -v certbot >/dev/null 2>&1; then
        echo "[*] Получение SSL-сертификата Let's Encrypt..."
        certbot --nginx -d "$SUBDOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || true
    fi
else
    echo "[!] Nginx не найден. Установите Nginx: apt update && apt install -y nginx"
fi

echo "=================================================="
echo "  НАСТРОЙКА ЗАВЕРШЕНА!"
echo "  Проверьте работу в браузере: https://$SUBDOMAIN"
echo "=================================================="
