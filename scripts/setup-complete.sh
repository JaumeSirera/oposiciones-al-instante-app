#!/bin/bash

# Script de configuración completa para GitHub Actions + Android Build

set -e

GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  CONFIGURACIÓN COMPLETA ANDROID${NC}"
echo -e "${GREEN}=====================================${NC}\n"

# 1. Instalar dependencias
echo -e "${BLUE}▶ Instalando dependencias...${NC}"
npm install

# 2. Configurar GitHub secrets
echo -e "\n${BLUE}▶ Configurando GitHub secrets...${NC}"
node scripts/setup-github-actions.js

# 3. Crear directorio para release notes
echo -e "\n${BLUE}▶ Creando estructura de release notes...${NC}"
mkdir -p android/release-notes/es-ES
mkdir -p android/release-notes/en-US

# Crear plantilla de release notes
cat > android/release-notes/es-ES/default.txt << 'EOF'
🚀 Nueva versión disponible

• Mejoras de rendimiento
• Corrección de errores
• Nuevas funcionalidades

Gracias por usar nuestra app!
EOF

cat > android/release-notes/en-US/default.txt << 'EOF'
🚀 New version available

• Performance improvements
• Bug fixes
• New features

Thanks for using our app!
EOF

echo -e "${GREEN}✓ Release notes creados${NC}"

# 4. Permisos para scripts
echo -e "\n${BLUE}▶ Configurando permisos de scripts...${NC}"
chmod +x scripts/auto-deploy.sh
chmod +x scripts/setup-complete.sh
chmod +x scripts/build-android.bat

echo -e "${GREEN}✓ Permisos configurados${NC}"

# 5. Verificar estructura
echo -e "\n${BLUE}▶ Verificando estructura del proyecto...${NC}"

FILES=(
    ".github/workflows/build-android.yml"
    "scripts/build-android.js"
    "scripts/setup-github-actions.js"
    "scripts/auto-deploy.sh"
    "android/app/build.gradle"
    "android/key.properties"
    "android/app/eas-upload.jks"
)

ALL_OK=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓ $file${NC}"
    else
        echo -e "${RED}  ✗ $file (falta)${NC}"
        ALL_OK=false
    fi
done

# 6. Resumen final
echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}  CONFIGURACIÓN COMPLETADA${NC}"
echo -e "${GREEN}=====================================${NC}\n"

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✓ Todo listo para usar!${NC}\n"
    
    echo -e "${BLUE}Comandos disponibles:${NC}"
    echo -e "  ${YELLOW}./scripts/auto-deploy.sh${NC} - Deploy automático completo"
    echo -e "  ${YELLOW}node scripts/build-android.js${NC} - Build local del AAB"
    echo -e "  ${YELLOW}scripts\\build-android.bat${NC} - Build local (Windows)\n"
    
    echo -e "${BLUE}Para activar el pipeline automático:${NC}"
    echo -e "  1. Asegúrate de que los secrets estén en GitHub"
    echo -e "  2. Ejecuta: ${YELLOW}./scripts/auto-deploy.sh${NC}"
    echo -e "  3. El AAB se compilará automáticamente en GitHub\n"
else
    echo -e "${YELLOW}⚠ Faltan algunos archivos. Revisa la lista de arriba.${NC}\n"
fi
