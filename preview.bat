@echo off
chcp 65001 >nul
echo ========================================================
echo   Локальный предпросмотр лендинга: http://localhost:3000
echo ========================================================
echo.
start http://localhost:3000
python -m http.server 3000
pause
