@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   正在启动 CardGameMaker 网页版 ...
echo   浏览器会自动打开，玩的时候别关这个黑窗口。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
