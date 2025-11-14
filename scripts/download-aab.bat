@echo off
REM Script para descargar el último AAB desde GitHub Releases

echo ====================================
echo Descargando ultimo AAB de GitHub
echo ====================================
echo.

REM Si tienes un token de GitHub para repositorios privados,
REM descomenta la siguiente línea y pon tu token:
REM set GITHUB_TOKEN=tu_token_aqui

node scripts/download-aab.js

echo.
pause
