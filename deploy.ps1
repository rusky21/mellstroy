# ==============================================================================
# Скрипт автоматического деплоя лендинга на сервер (Windows PowerShell)
# ==============================================================================
param(
    [string]$ServerHost = "",
    [string]$ServerUser = "root",
    [string]$RemoteDir  = "/var/www/stroy-landing",
    [int]$Port          = 22
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   ДЕПЛОЙ ЛЕНДИНГА СТРОИТЕЛЬНОЙ КОМПАНИИ" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Запрос IP сервера, если не указан параметром
if (-not $ServerHost) {
    $ServerHost = Read-Host "Введите IP-адрес вашего сервера (например, 185.xxx.xxx.xxx)"
    if (-not $ServerHost) {
        Write-Host "[!] Ошибка: IP-адрес сервера не может быть пустым." -ForegroundColor Red
        exit 1
    }
}

# 2. Проверка наличия scp и ssh в системе
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Ошибка: Команда 'scp' не найдена в системе. Убедитесь, что OpenSSH Client установлен." -ForegroundColor Red
    exit 1
}

$CurrentDir = $PSScriptRoot
if (-not $CurrentDir) { $CurrentDir = Get-Location }

Write-Host "`n[*] Локальная папка проекта: $CurrentDir" -ForegroundColor Gray
Write-Host "[*] Сервер назначения: ${ServerUser}@${ServerHost}:${RemoteDir} (порт $Port)" -ForegroundColor Gray

# 3. Создание временного архива файлов для быстрой и надёжной передачи
$TempZip = Join-Path $env:TEMP ("stroy_landing_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".zip")
Write-Host "[*] Упаковка файлов лендинга (index.html, css, js)..." -ForegroundColor Yellow

$ItemsToCompress = @(
    (Join-Path $CurrentDir "index.html"),
    (Join-Path $CurrentDir "css"),
    (Join-Path $CurrentDir "js")
)

foreach ($item in $ItemsToCompress) {
    if (-not (Test-Path $item)) {
        Write-Host "[!] Внимание: элемент '$item' не найден!" -ForegroundColor Yellow
    }
}

Compress-Archive -Path $ItemsToCompress -DestinationPath $TempZip -Force
$ZipSize = [math]::Round(((Get-Item $TempZip).Length / 1KB), 1)
Write-Host "[+] Архив готов (${ZipSize} KB): $TempZip" -ForegroundColor Green

# 4. Создание директории на сервере
Write-Host "[*] Подготовка директории на сервере ($RemoteDir)..." -ForegroundColor Yellow
ssh -p $Port "${ServerUser}@${ServerHost}" "mkdir -p $RemoteDir /tmp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Ошибка при подключении к серверу по SSH." -ForegroundColor Red
    Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
    exit 1
}

# 5. Передача архива на сервер
$RemoteZip = "/tmp/stroy_landing.zip"
Write-Host "[*] Передача архива по SCP..." -ForegroundColor Yellow
scp -P $Port $TempZip "${ServerUser}@${ServerHost}:${RemoteZip}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Ошибка при передаче архива по SCP." -ForegroundColor Red
    Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
    exit 1
}

# 6. Распаковка на сервере и выставление прав
Write-Host "[*] Распаковка файлов на сервере..." -ForegroundColor Yellow
$RemoteCmd = "which unzip >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq unzip); unzip -q -o " + $RemoteZip + " -d " + $RemoteDir + "; rm -f " + $RemoteZip + "; chmod -R 755 " + $RemoteDir + "; echo 'OK'"

ssh -p $Port "${ServerUser}@${ServerHost}" $RemoteCmd

# 7. Очистка локального архива
Remove-Item -Force $TempZip -ErrorAction SilentlyContinue

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  ДЕПЛОЙ УСПЕШНО ЗАВЕРШЁН!" -ForegroundColor Green
Write-Host "  Файлы обновлены в $RemoteDir на сервере $ServerHost" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
