#!/usr/bin/env bash
# ==============================================================================
# Скрипт деплоя лендинга через Bash (Linux / macOS / WSL)
# ==============================================================================
set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${1:-${SERVER_HOST:-}}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/stroy-landing}"
PORT="${PORT:-22}"

if [ -z "$SERVER_HOST" ]; then
    read -rp "Введите IP-адрес сервера: " SERVER_HOST
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Деплой лендинга на $SERVER_USER@$SERVER_HOST:$REMOTE_DIR ==="

echo "[*] Создание директории на сервере..."
ssh -p "$PORT" "$SERVER_USER@$SERVER_HOST" "mkdir -p '$REMOTE_DIR'"

echo "[*] Синхронизация файлов..."
if command -v rsync >/dev/null 2>&1; then
    rsync -avz -e "ssh -p $PORT" \
        --exclude ".git" \
        --exclude ".claude" \
        --exclude "*.bat" \
        --exclude "*.ps1" \
        --exclude "*.sh" \
        --exclude "*.md" \
        "$SCRIPT_DIR/index.html" \
        "$SCRIPT_DIR/css" \
        "$SCRIPT_DIR/js" \
        "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"
else
    tar -czf - -C "$SCRIPT_DIR" index.html css js | \
        ssh -p "$PORT" "$SERVER_USER@$SERVER_HOST" "tar -xzf - -C '$REMOTE_DIR'"
fi

ssh -p "$PORT" "$SERVER_USER@$SERVER_HOST" "chmod -R 755 '$REMOTE_DIR'"

echo "✅ Успешно! Файлы обновлены на сервере."
