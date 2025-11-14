@echo off
setlocal enabledelayedexpansion

echo =====================================
echo   RESOLUCION AUTOMATICA DE CONFLICTOS
echo =====================================
echo.

REM Verificar si hay conflictos
git diff --name-only --diff-filter=U > nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] No hay conflictos detectados
    exit /b 0
)

REM Listar archivos en conflicto
echo Archivos en conflicto:
git diff --name-only --diff-filter=U
echo.

set /p AUTO_RESOLVE="Resolver automaticamente segun reglas? (s/n): "
if /i not "!AUTO_RESOLVE!"=="s" (
    echo Resolucion cancelada
    exit /b 1
)

echo.
echo Aplicando reglas de resolucion...
echo.

REM Procesar cada archivo en conflicto
for /f "tokens=*" %%f in ('git diff --name-only --diff-filter=U') do (
    set "FILE=%%f"
    set "RESOLVED=0"
    
    REM Regla 1: build.gradle - SIEMPRE local
    echo %%f | findstr /i "build.gradle" > nul
    if !errorlevel! equ 0 (
        echo [LOCAL] %%f - Priorizando version local
        git checkout --ours "%%f"
        git add "%%f"
        set "RESOLVED=1"
    )
    
    REM Regla 2: Archivos de codigo fuente - LOCAL
    if "!RESOLVED!"=="0" (
        echo %%f | findstr /i "^src/" > nul
        if !errorlevel! equ 0 (
            echo [LOCAL] %%f - Priorizando version local
            git checkout --ours "%%f"
            git add "%%f"
            set "RESOLVED=1"
        )
    )
    
    REM Regla 3: Scripts - LOCAL
    if "!RESOLVED!"=="0" (
        echo %%f | findstr /i "^scripts/" > nul
        if !errorlevel! equ 0 (
            echo [LOCAL] %%f - Priorizando version local
            git checkout --ours "%%f"
            git add "%%f"
            set "RESOLVED=1"
        )
    )
    
    REM Regla 4: index.html - LOCAL
    if "!RESOLVED!"=="0" (
        echo %%f | findstr /i "index.html" > nul
        if !errorlevel! equ 0 (
            echo [LOCAL] %%f - Priorizando version local
            git checkout --ours "%%f"
            git add "%%f"
            set "RESOLVED=1"
        )
    )
    
    REM Regla 5: Archivos de configuracion - LOCAL
    if "!RESOLVED!"=="0" (
        echo %%f | findstr /i ".config.ts .config.js" > nul
        if !errorlevel! equ 0 (
            echo [LOCAL] %%f - Priorizando version local
            git checkout --ours "%%f"
            git add "%%f"
            set "RESOLVED=1"
        )
    )
    
    REM Regla 6: package.json - REMOTO
    if "!RESOLVED!"=="0" (
        echo %%f | findstr /i "package.json package-lock.json" > nul
        if !errorlevel! equ 0 (
            echo [REMOTO] %%f - Priorizando version remota
            git checkout --theirs "%%f"
            git add "%%f"
            set "RESOLVED=1"
        )
    )
    
    REM Si no se aplico regla, marcar para revision manual
    if "!RESOLVED!"=="0" (
        echo [MANUAL] %%f - Requiere revision manual
    )
)

echo.
echo =====================================

REM Verificar si quedan conflictos sin resolver
git diff --name-only --diff-filter=U > nul 2>&1
if %errorlevel% equ 0 (
    for /f %%i in ('git diff --name-only --diff-filter=U ^| find /c /v ""') do set REMAINING=%%i
    if !REMAINING! gtr 0 (
        echo [ADVERTENCIA] Quedan !REMAINING! archivo(s) con conflictos
        echo Archivos pendientes:
        git diff --name-only --diff-filter=U
        echo.
        echo Resuelve estos conflictos manualmente antes de continuar
        exit /b 1
    )
)

echo [OK] Todos los conflictos resueltos
echo.

set /p DO_COMMIT="Hacer commit de la resolucion? (s/n): "
if /i "!DO_COMMIT!"=="s" (
    git commit -m "Resuelve conflictos de merge automaticamente"
    echo [OK] Commit realizado
    echo.
    set /p DO_PUSH="Hacer push a GitHub? (s/n): "
    if /i "!DO_PUSH!"=="s" (
        git push origin main
        echo [OK] Push completado
    )
)

echo.
pause
