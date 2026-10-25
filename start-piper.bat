@echo off
chcp 65001 >nul
title CardGameMaker - Piper 中文 TTS
cd /d "%~dp0"
rem Piper 离线中文 TTS：双击启动，游戏访问 http://127.0.0.1:9881
rem 关闭本窗口即停止服务；模型 voice_service\piper\voices\zh_CN-huayan-medium.onnx
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE goto :no_node
echo ============================================================
echo   Piper 中文 TTS 服务：http://127.0.0.1:9881
echo   关闭本窗口即停止服务
echo ============================================================
"%NODE_EXE%" "%~dp0voice_service\piper-server.mjs"
echo.
echo 服务已停止。
pause
exit /b 0
:no_node
echo [错误] 未检测到 Node.js 18+，请先安装 Node.js 或运行 install-node.bat。
pause
exit /b 1
