# 🚀 Инструкция: Запуск лендинга строительной компании на поддомене

Данное руководство объясняет, как за 5 минут настроить поддомен в Cloudflare, сконфигурировать сервер и задеплоить лендинг.

---

## ЧАСТЬ 1. Настройка поддомена в Cloudflare (2 минуты)

1. Войдите в панель [Cloudflare Dashboard](https://dash.cloudflare.com/) и выберите ваш домен `castleweb.ru`.
2. Перейдите в левом меню: **DNS** -> **Records**.
3. Нажмите синюю кнопку **Add record** и заполните поля:
   - **Type**: `A`
   - **Name**: имя поддомена (например, `stroy` или `dom` или `build`).
     > В строке ниже отобразится итоговый адрес: `stroy.castleweb.ru`.
   - **IPv4 address**: вставьте IP-адрес вашего сервера (например, `185.xxx.xxx.xxx`).
   - **Proxy status**: обязательно **Proxied** (оранжевое облако 🟠).
     > Это обеспечит бесплатный автоматический SSL-сертификат, защиту от атак и быстрое CDN-кэширование.
   - **TTL**: `Auto`.
4. Нажмите **Save**.

### Проверка SSL в Cloudflare:
В левом меню перейдите в **SSL/TLS** -> **Overview**:
- Режим шифрования должен быть установлен в **Full** (или **Full (strict)**).

---

## ЧАСТЬ 2. Настройка на сервере (1 минута)

Подключитесь к вашему серверу по SSH:
```bash
ssh root@<IP_ВАШЕГО_СЕРВЕРА>
```

Выполните команду первичной настройки:
```bash
# Создаём директорию для лендинга
mkdir -p /var/www/stroy-landing
chmod -R 755 /var/www/stroy-landing
```

### Вариант А. Если у вас работает Nginx в Docker (проект Castleweb):
Скопируйте шаблон конфига в папку Nginx:
```bash
# Добавляем конфиг поддомена в Nginx Docker
nano /var/www/castleweb/nginx/conf.d/stroy.conf
```
Вставьте следующее содержимое:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name stroy.castleweb.ru;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name stroy.castleweb.ru;

    ssl_certificate /etc/letsencrypt/live/castleweb.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/castleweb.ru/privkey.pem;

    root /var/www/stroy-landing;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
}
```

> **Примечание по Docker:** если Nginx запущен в Docker, убедитесь, что папка `/var/www/stroy-landing` смонтирована в `docker-compose.prod.yml` в сервис `nginx`:
> ```yaml
> volumes:
>   - /var/www/stroy-landing:/var/www/stroy-landing:ro
> ```
> И перезагрузите Nginx:
> ```bash
> docker exec castleweb_prod_nginx nginx -s reload
> ```

### Вариант Б. Либо используйте автоматический скрипт настройки:
Вы можете запустить готовый скрипт, загрузив его на сервер:
```bash
bash setup-subdomain.sh stroy.castleweb.ru /var/www/stroy-landing
```

---

## ЧАСТЬ 3. Деплой сайта с вашего компьютера в 1 клик

На вашем компьютере прямо из этой папки запустите деплой:

### Способ 1 (PowerShell — рекомендуется для Windows):
1. Нажмите правой кнопкой на свободном месте в этой папке -> **Открыть в терминале** (или PowerShell).
2. Запустите:
   ```powershell
   .\deploy.ps1
   ```
3. Скрипт спросит IP-адрес сервера (например, `185.123.45.67`) и сам:
   - Упакует `index.html`, `css/`, `js/`
   - Передаст на сервер через SCP
   - Распакует в `/var/www/stroy-landing`
   - Выставит корректные права доступа

> Можно запускать сразу с параметром IP:
> ```powershell
> .\deploy.ps1 -ServerHost 185.xxx.xxx.xxx
> ```

---

## ЧАСТЬ 4. Локальный предпросмотр (без интернета)

Чтобы быстро открыть и проверить сайт на своём компьютере перед загрузкой:
- Просто дважды кликните по файлу **`preview.bat`**.
- В браузере автоматически откроется `http://localhost:3000`.

---

## ЧАСТЬ 5. Проверка работы

После выполнения деплоя откройте в браузере:
👉 **`https://stroy.castleweb.ru`** (или ваш выбранный поддомен)

Лендинг откроется по безопасному протоколу HTTPS с защитой Cloudflare!
