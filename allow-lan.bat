@echo off
setlocal
net session >nul 2>&1
if not %errorlevel%==0 (
  echo Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Adding Windows Firewall rules for CardGameMaker...
netsh advfirewall firewall delete rule name="CardGameMaker Web 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="CardGameMaker Relay 8787" >nul 2>&1
netsh advfirewall firewall add rule name="CardGameMaker Web 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="CardGameMaker Relay 8787" dir=in action=allow protocol=TCP localport=8787

echo.
echo Done. Phones on the same WiFi can now connect:
echo   web  : http://^<PC-IP^>:3000
echo   relay: ws://^<PC-IP^>:8787
echo.
pause
