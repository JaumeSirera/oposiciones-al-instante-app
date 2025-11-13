@echo off
REM Script para compilar Android AAB en Windows
REM Asegura que JAVA_HOME esté configurado correctamente

echo ====================================
echo Configurando JAVA_HOME
echo ====================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo JAVA_HOME: %JAVA_HOME%
echo.

echo ====================================
echo Ejecutando script de compilación
echo ====================================

node scripts/build-android.js

pause
