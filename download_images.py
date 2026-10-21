"""
Автоматический скрипт загрузки всех изображений лендинга.
1. Скачивает все фотографии с Unsplash (напрямую или через обходной CDN-прокси без VPN).
2. Сохраняет их в локальную папку img/.
3. Автоматически обновляет index.html, заменяя внешние ссылки на локальные пути.
4. Создает резервную копию index.html.bak.
"""

import os
import re
import sys
import time
import urllib.request
import urllib.parse

# Настройка кодировки консоли
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(SCRIPT_DIR, "img")
HTML_PATH = os.path.join(SCRIPT_DIR, "index.html")
BACKUP_PATH = os.path.join(SCRIPT_DIR, "index.html.bak")

os.makedirs(IMG_DIR, exist_ok=True)

HAS_PIL = False
try:
    from PIL import Image
    import io
    HAS_PIL = True
except ImportError:
    pass


def download_photo(photo_id, target_path):
    """Скачивает фото: сначала напрямую, при блокировке — через обходной DuckDuckGo прокси."""
    clean_url = f"https://images.unsplash.com/{photo_id}"
    
    # 1. Напрямую (если включен VPN)
    try:
        req = urllib.request.Request(
            f"{clean_url}?w=1600&q=80&auto=format&fit=crop",
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = resp.read()
            if len(data) > 5000:
                actual_path = save_image(data, target_path)
                return True, "напрямую", actual_path
    except Exception:
        pass

    # 2. Через DuckDuckGo CDN прокси (работает в РФ без VPN)
    try:
        ddg_url = f"https://external-content.duckduckgo.com/iu/?u={urllib.parse.quote(clean_url)}"
        req = urllib.request.Request(
            ddg_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if len(data) > 5000:
                actual_path = save_image(data, target_path)
                return True, "через DDG-прокси", actual_path
    except Exception as e:
        return False, str(e), None

    return False, "таймаут / ошибка", None


def save_image(raw_bytes, target_path):
    """Сохраняет изображение, оптимизируя в WebP при наличии Pillow."""
    if HAS_PIL:
        try:
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            if img.width > 1600 or img.height > 1600:
                img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            webp_path = os.path.splitext(target_path)[0] + ".webp"
            img.save(webp_path, "WEBP", quality=82, method=6)
            return webp_path
        except Exception:
            pass
            
    # Сохраняем JPG
    jpg_path = os.path.splitext(target_path)[0] + ".jpg"
    with open(jpg_path, "wb") as f:
        f.write(raw_bytes)
    return jpg_path


def main():
    print("=" * 65)
    print("   АВТОМАТИЧЕСКАЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ ДЛЯ ЛЕНДИНГА СТРОЙКИ")
    print("=" * 65)

    if not os.path.exists(HTML_PATH):
        print(f"[!] Файл {HTML_PATH} не найден!")
        return

    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Ищем ссылки Unsplash
    raw_urls = re.findall(r'https://images\.unsplash\.com/[a-zA-Z0-9\-_?=&#.%]+', html_content)
    unique_urls = list(set(raw_urls))
    print(f"[*] Найдено ссылок Unsplash: {len(raw_urls)} (уникальных: {len(unique_urls)})")
    print(f"[*] Локальная папка для фото: {IMG_DIR}")
    print(f"[*] Формат сжатия: {'WebP (Pillow)' if HAS_PIL else 'JPG'}")
    print("-" * 65)

    photo_to_urls = {}
    for url in unique_urls:
        m = re.search(r'(photo-[a-zA-Z0-9\-]+)', url)
        if m:
            pid = m.group(1)
            photo_to_urls.setdefault(pid, []).append(url)

    total_photos = len(photo_to_urls)
    current = 0
    photo_cache = {}
    success_count = 0
    fail_count = 0

    for pid, urls in photo_to_urls.items():
        current += 1
        webp_candidate = os.path.join(IMG_DIR, f"{pid}.webp")
        jpg_candidate = os.path.join(IMG_DIR, f"{pid}.jpg")

        if os.path.exists(webp_candidate) and os.path.getsize(webp_candidate) > 5000:
            print(f"[{current:02d}/{total_photos}] Уже есть: {pid}.webp ({os.path.getsize(webp_candidate) // 1024} KB)")
            photo_cache[pid] = f"img/{pid}.webp"
            success_count += 1
            continue
        elif os.path.exists(jpg_candidate) and os.path.getsize(jpg_candidate) > 5000:
            print(f"[{current:02d}/{total_photos}] Уже есть: {pid}.jpg ({os.path.getsize(jpg_candidate) // 1024} KB)")
            photo_cache[pid] = f"img/{pid}.jpg"
            success_count += 1
            continue

        print(f"[{current:02d}/{total_photos}] Скачиваем {pid}...", end=" ", flush=True)
        ok, method, saved_path = download_photo(pid, os.path.join(IMG_DIR, f"{pid}.jpg"))
        
        if ok and saved_path:
            rel_name = os.path.basename(saved_path)
            photo_cache[pid] = f"img/{rel_name}"
            size_kb = os.path.getsize(saved_path) // 1024
            print(f"OK ({method}, {size_kb} KB)")
            success_count += 1
        else:
            print(f"ОШИБКА: {method}")
            fail_count += 1

        time.sleep(0.2)

    print("-" * 65)
    print(f"[*] Итог скачивания: Успешно: {success_count}, Ошибок: {fail_count}")

    # Бэкап index.html
    if not os.path.exists(BACKUP_PATH):
        with open(BACKUP_PATH, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"[*] Создан резервный файл: index.html.bak")

    # Обновление index.html
    print("[*] Перелинковываем index.html на локальные файлы...")
    new_html = html_content
    replacements_done = 0

    for pid, local_path in photo_cache.items():
        pattern = re.compile(r'https://images\.unsplash\.com/' + re.escape(pid) + r'[^"\'\s)]*')
        matches = pattern.findall(new_html)
        if matches:
            replacements_done += len(matches)
            new_html = pattern.sub(local_path, new_html)

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(new_html)

    print(f"[+] Заменено {replacements_done} внешних ссылок на '{IMG_DIR}\\...'")
    print(f"[+] Файл index.html успешно обновлён!")
    print("=" * 65)


if __name__ == "__main__":
    main()
