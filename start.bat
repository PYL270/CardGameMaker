@echo off
setlocal
cd /d "%~dp0"
title CardGameMaker

set "LOG=%~dp0launcher.log"
echo [%time%] launcher start>>"%LOG%"

set "NODE_EXE="
where node >nul 2>nul
if %errorlevel%==0 set "NODE_EXE=node"

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  echo [ERROR] Node.js not found.
  echo Please install Node.js 18+ from https://nodejs.org and run again.
  echo [%time%] ERROR node not found>>"%LOG%"
  echo.
  pause
  exit /b 1
)

echo [%time%] node=%NODE_EXE%>>"%LOG%"

if not exist "node_modules\vite\bin\vite.js" (
  echo [ERROR] Dependencies are missing.
  echo Run "npm install" in D:\CardGameMaker first.
  echo [%time%] ERROR node_modules missing>>"%LOG%"
  echo.
  pause
  exit /b 1
)

echo ==========================================
echo   CardGameMaker
echo   web  : http://localhost:3000
echo   relay: ws://localhost:8787  (multiplayer)
echo   Keep this window open while playing.
echo   Press Ctrl+C to stop.
echo ==========================================
echo.

"%NODE_EXE%" "scripts\launch.mjs"

if errorlevel 1 goto failed

echo [%time%] launcher exit ok>>"%LOG%"
exit /b 0

:failed
echo [%time%] launcher failed>>"%LOG%"
echo.
echo [ERROR] CardGameMaker failed to start.
echo Check launcher.log in D:\CardGameMaker for details.
echo.
pause
exit /b 1
