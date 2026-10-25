@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul
if %errorlevel%==0 set "NODE_EXE=node"

if not defined NODE_EXE (
  if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if not defined NODE_EXE (
  echo [ERROR] Node.js not found.
  pause
  exit /b 1
)

echo ==========================================
echo   [1/5] Engine smoke tests
echo ==========================================
"%NODE_EXE%" "scripts\run-smoke.mjs"
if errorlevel 1 (
  echo ENGINE TESTS FAILED
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   [2/5] UI smoke tests
echo ==========================================
"%NODE_EXE%" "scripts\run-ui-smoke.mjs"
if errorlevel 1 (
  echo UI TESTS FAILED
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   [3/5] Multiplayer relay tests
echo ==========================================
"%NODE_EXE%" "scripts\net-smoke.mjs"
if errorlevel 1 (
  echo NETWORK TESTS FAILED
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   [4/5] Online host integration test
echo ==========================================
"%NODE_EXE%" "scripts\run-online-host-smoke.mjs"
if errorlevel 1 (
  echo ONLINE TEST FAILED
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   [5/5] BGM loop quality check
echo ==========================================
"%NODE_EXE%" "scripts\audio-check.mjs"
if errorlevel 1 (
  echo AUDIO TESTS FAILED
  pause
  exit /b 1
)

echo.
echo All tests passed.
pause
