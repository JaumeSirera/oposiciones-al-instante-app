# 🛠️ Scripts de Compilación Android

Scripts para automatizar la compilación y despliegue de la app Android.

## 📁 Archivos

| Archivo | Descripción |
|---------|-------------|
| `build-android.js` | Compila el AAB localmente (incrementa versión, build web, sync, compile) |
| `build-android.bat` | Wrapper de Windows para build-android.js |
| `setup-github-actions.js` | Configura los secrets de GitHub para CI/CD |
| `setup-complete.sh` | Script completo de configuración inicial |
| `auto-deploy.sh` | Deploy automático (commit, push, activa GitHub Actions) |

## 🚀 Inicio Rápido

### 1️⃣ Configuración inicial (solo una vez)

```bash
# Linux/Mac
./scripts/setup-complete.sh

# Windows
node scripts/setup-github-actions.js
```

### 2️⃣ Deploy automático

```bash
# Linux/Mac
./scripts/auto-deploy.sh

# Windows - Usa Git Bash o WSL
bash scripts/auto-deploy.sh
```

### 3️⃣ Compilación local

```bash
# Windows
scripts\build-android.bat

# Linux/Mac/Windows con Node
node scripts/build-android.js
```

## 🎯 Comandos

### Compilación local completa
```bash
node scripts/build-android.js
```
- Incrementa versionCode
- Actualiza versionName (DD.MM.YY)
- Compila web (npm run build)
- Sincroniza Capacitor
- Compila AAB firmado

**Salida:** `android/app/build/outputs/bundle/release/app-release.aab`

### Solo actualizar versión
```bash
node scripts/build-android.js --version-only
```
Útil para incrementar versión sin compilar.

### Configurar GitHub Secrets
```bash
node scripts/setup-github-actions.js
```
- Lee `android/key.properties`
- Codifica keystore a base64
- Muestra valores para GitHub Secrets
- Opcionalmente configura secrets automáticamente (requiere GitHub CLI)

### Deploy completo
```bash
./scripts/auto-deploy.sh
```
1. Verifica rama actual
2. Commitea cambios pendientes
3. Pull de remoto
4. Opcionalmente incrementa versión
5. Push → activa GitHub Actions

## 📋 Requisitos

### Para compilación local:
- ✅ Node.js 18+
- ✅ Android Studio con JDK
- ✅ Keystore configurado (`android/key.properties`)
- ✅ `android/app/eas-upload.jks` presente

### Para GitHub Actions (deploy automático):
- ✅ Repositorio en GitHub
- ✅ Secrets configurados en GitHub
- ✅ Push access a rama `main`

### Para configuración automática de secrets:
- ✅ [GitHub CLI](https://cli.github.com/) instalado
- ✅ Autenticado con `gh auth login`

## 🔐 Secrets de GitHub

Configura estos secrets en: **GitHub → Settings → Secrets → Actions**

| Secret | Obtener de |
|--------|------------|
| `KEYSTORE_BASE64` | Ejecutar setup script |
| `KEYSTORE_PASSWORD` | `android/key.properties` |
| `KEY_PASSWORD` | `android/key.properties` |
| `KEY_ALIAS` | `android/key.properties` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play Console (opcional) |

## 🔄 Workflow Automático

El workflow de GitHub Actions (`.github/workflows/build-android.yml`) se activa:

1. **Automáticamente:** Push a rama `main`
2. **Manualmente:** Actions → Build Android AAB → Run workflow

### ¿Qué hace?
1. ✅ Instala dependencias
2. ✅ Incrementa versión automáticamente
3. ✅ Compila web
4. ✅ Sincroniza Capacitor
5. ✅ Compila AAB firmado
6. ✅ Crea Release en GitHub con el AAB
7. ✅ (Opcional) Sube a Google Play Internal Track

### Descargar AAB compilado:
- **Actions:** Busca en Artifacts del workflow
- **Releases:** Descarga desde la sección Releases

## 🐛 Troubleshooting

### Windows: "node no se reconoce como comando"
```bash
# Verifica instalación de Node
node --version

# Si no está instalado, descarga de nodejs.org
```

### Linux/Mac: "Permission denied"
```bash
# Da permisos de ejecución
chmod +x scripts/*.sh
```

### Error: "JAVA_HOME not found"
```bash
# Windows (ajusta la ruta a tu instalación)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"

# Linux/Mac
export JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home
```

### Error: "keystore not found"
```bash
# Verifica que existan estos archivos:
ls android/key.properties
ls android/app/eas-upload.jks
```

### Workflow falla en GitHub
1. Verifica que todos los secrets estén configurados
2. Revisa los logs del workflow en Actions
3. Asegúrate que el keystore sea válido

## 📖 Documentación completa

Ver `DEPLOY_AUTOMATIZADO.md` en la raíz del proyecto para documentación detallada.

## 💡 Tips

- Usa `auto-deploy.sh` para deploy rápido sin preocuparte de detalles
- El versionado es automático, no edites `build.gradle` manualmente
- Los secrets se guardan en `scripts/github-secrets.txt` (en .gitignore)
- Para testing, usa compilación local; para producción, usa GitHub Actions
