@echo off
chcp 65001 > nul
title Скачивание изображений для лендинга
echo Запуск загрузки картинок...
python download_images.py
pause
