@echo off
REM Script de configuración de GitHub Actions para Windows

echo ====================================
echo   CONFIGURACION GITHUB ACTIONS
echo ====================================
echo.

node scripts/setup-github-actions.js

echo.
echo ====================================
echo   PROXIMOS PASOS
echo ====================================
echo.
echo 1. Configura los secrets en GitHub (ve la guia de arriba)
echo 2. Haz commit y push de los cambios
echo 3. El AAB se compilara automaticamente
echo.

pause
