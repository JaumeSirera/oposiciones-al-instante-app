#!/bin/bash

# Script de despliegue automatizado
# Incrementa versión, compila, hace commit y push para activar GitHub Actions

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  DESPLIEGUE AUTOMATIZADO ANDROID${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Verificar que estamos en la rama correcta
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}▶ Rama actual: ${CURRENT_BRANCH}${NC}"

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠ No estás en la rama 'main'${NC}"
    read -p "¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verificar cambios pendientes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠ Hay cambios sin commitear${NC}"
    git status -s
    echo
    read -p "¿Hacer commit de estos cambios? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Mensaje del commit: " COMMIT_MSG
        git add .
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✓ Cambios commiteados${NC}\n"
    fi
fi

# Pull antes de push
echo -e "${BLUE}▶ Sincronizando con remoto...${NC}"
git pull origin $CURRENT_BRANCH

# Incrementar versión localmente (opcional)
echo -e "${BLUE}▶ ¿Quieres incrementar la versión localmente primero?${NC}"
echo "  (Se incrementará automáticamente en GitHub Actions de todos modos)"
read -p "(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    node scripts/build-android.js --version-only
    
    # Commit del cambio de versión
    git add android/app/build.gradle
    git commit -m "chore: bump version [skip ci]" || echo "No hay cambios de versión"
fi

# Push para activar GitHub Actions
echo -e "${BLUE}▶ Haciendo push a GitHub...${NC}"
git push origin $CURRENT_BRANCH

echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}  ✓ DESPLIEGUE INICIADO${NC}"
echo -e "${GREEN}=====================================${NC}\n"

echo -e "${BLUE}GitHub Actions compilará automáticamente el AAB.${NC}"
echo -e "${BLUE}Ve a: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}\n"

echo -e "${YELLOW}Próximos pasos:${NC}"
echo -e "  1. Espera a que termine el workflow en GitHub Actions"
echo -e "  2. Descarga el AAB desde Actions → Artifacts"
echo -e "  3. O encuentra el release automático en la pestaña Releases\n"
