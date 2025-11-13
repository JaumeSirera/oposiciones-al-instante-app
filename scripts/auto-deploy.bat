@echo off
setlocal enabledelayedexpansion

echo =====================================
echo   DESPLIEGUE AUTOMATIZADO ANDROID
echo =====================================
echo.

REM Verificar rama actual
for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a
echo Rama actual: %CURRENT_BRANCH%
echo.

if not "%CURRENT_BRANCH%"=="main" (
    echo [ADVERTENCIA] No estas en la rama 'main'
    set /p CONTINUE="Continuar de todos modos? (s/n): "
    if /i not "!CONTINUE!"=="s" exit /b 1
)

REM Verificar cambios pendientes
git status -s > nul 2>&1
if %errorlevel% equ 0 (
    for /f %%i in ('git status -s ^| find /c /v ""') do set CHANGES=%%i
    if !CHANGES! gtr 0 (
        echo [ADVERTENCIA] Hay cambios sin commitear
        git status -s
        echo.
        set /p DO_COMMIT="Hacer commit de estos cambios? (s/n): "
        if /i "!DO_COMMIT!"=="s" (
            set /p COMMIT_MSG="Mensaje del commit: "
            git add .
            git commit -m "!COMMIT_MSG!"
            echo [OK] Cambios commiteados
            echo.
        )
    )
)

REM Verificar si hay un merge sin terminar
if exist ".git\MERGE_HEAD" (
    echo.
    echo [ADVERTENCIA] Hay un merge sin terminar
    echo.
    
    REM Verificar si hay conflictos
    git diff --name-only --diff-filter=U > nul 2>&1
    if %errorlevel% equ 0 (
        echo Hay conflictos sin resolver. Ejecutando resolucion automatica...
        echo.
        call "%~dp0resolve-conflicts.bat"
        
        if %errorlevel% neq 0 (
            echo.
            echo [ERROR] No se pudieron resolver todos los conflictos
            echo Opciones:
            echo   1. Resuelve manualmente: git status
            echo   2. Aborta el merge: git merge --abort
            exit /b 1
        )
    ) else (
        echo No hay conflictos. Completando el merge...
        git commit --no-edit
        if %errorlevel% neq 0 (
            echo [ERROR] No se pudo completar el merge
            exit /b 1
        )
        echo [OK] Merge completado
    )
)

REM Pull antes de push
echo Sincronizando con remoto...
git pull origin %CURRENT_BRANCH%
if %errorlevel% neq 0 (
    echo.
    echo [ADVERTENCIA] Detectados conflictos durante el pull
    echo.
    
    REM Verificar si hay conflictos de merge
    git diff --name-only --diff-filter=U > nul 2>&1
    if %errorlevel% equ 0 (
        echo Ejecutando resolucion automatica de conflictos...
        echo.
        call "%~dp0resolve-conflicts.bat"
        
        if %errorlevel% neq 0 (
            echo.
            echo [ERROR] No se pudieron resolver todos los conflictos automaticamente
            echo Resuelve los conflictos restantes manualmente y ejecuta de nuevo
            exit /b 1
        )
        
        echo.
        echo [OK] Conflictos resueltos, continuando con el despliegue...
        echo.
    ) else (
        echo [ERROR] Fallo al hacer pull (no son conflictos de merge)
        echo Revisa el error e intenta de nuevo
        exit /b 1
    )
)

REM Incrementar version localmente (opcional)
echo.
set /p INCREMENT="Quieres incrementar la version localmente primero? (s/n): "
if /i "!INCREMENT!"=="s" (
    node scripts/build-android.js --version-only
    git add android/app/build.gradle
    git commit -m "chore: bump version [skip ci]" 2>nul || echo No hay cambios de version
)

REM Push para activar GitHub Actions
echo.
echo Haciendo push a GitHub...
git push origin %CURRENT_BRANCH%
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al hacer push
    exit /b 1
)

echo.
echo =====================================
echo   [OK] DESPLIEGUE INICIADO
echo =====================================
echo.
echo GitHub Actions compilara automaticamente el AAB.
for /f "tokens=*" %%a in ('git config --get remote.origin.url') do set REPO_URL=%%a
set REPO_URL=!REPO_URL:.git=!
set REPO_URL=!REPO_URL:*github.com/=!
set REPO_URL=!REPO_URL:*github.com:=!
echo Ve a: https://github.com/!REPO_URL!/actions
echo.
echo Proximos pasos:
echo   1. Espera a que termine el workflow en GitHub Actions
echo   2. Descarga el AAB desde Actions - Artifacts
echo   3. O encuentra el release automatico en la pestana Releases
echo.
pause