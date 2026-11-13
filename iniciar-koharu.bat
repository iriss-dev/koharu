@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Koharu
echo Iniciando Koharu...
node -v
if not exist "node_modules\@napi-rs\canvas\package.json" (
  echo Instalando dependencias nuevas, solo la primera vez...
  call npm install --no-audit --no-fund
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm start 2>&1 | Tee-Object -FilePath koharu-log.txt"
echo.
echo Koharu se detuvo. Revisa koharu-log.txt
pause
