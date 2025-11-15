@echo off
REM Script para compilar Android APK en Windows

echo ====================================
echo Configurando JAVA_HOME y ANDROID_HOME
echo ====================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo JAVA_HOME: %JAVA_HOME%
echo ANDROID_HOME: %ANDROID_HOME%
echo.

echo ====================================
echo Creando local.properties
echo ====================================
echo sdk.dir=%ANDROID_HOME:\=/% > android\local.properties
echo Archivo local.properties creado
echo.

echo ====================================
echo Instalando dependencias
echo ====================================
call npm install
if errorlevel 1 (
    echo Error al instalar dependencias
    pause
    exit /b 1
)

echo.
echo ====================================
echo Compilando web
echo ====================================
call npm run build
if errorlevel 1 (
    echo Error al compilar web
    pause
    exit /b 1
)

echo.
echo ====================================
echo Sincronizando Capacitor
echo ====================================
call npx cap sync android
if errorlevel 1 (
    echo Error al sincronizar Capacitor
    pause
    exit /b 1
)

echo.
echo ====================================
echo Compilando APK
echo ====================================
cd android
call gradlew.bat :app:assembleRelease --stacktrace
if errorlevel 1 (
    echo Error al compilar APK
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ====================================
echo COMPILACION EXITOSA
echo ====================================
echo.
echo APK generado en:
echo android\app\build\outputs\apk\release\app-release.apk
echo.

pause
