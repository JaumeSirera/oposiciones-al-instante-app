# 🚀 Sistema de Deploy Automatizado

Este proyecto incluye un sistema completo de compilación y despliegue automatizado para Android usando GitHub Actions.

## 📋 Características

- ✅ **Versionado automático** - Incrementa `versionCode` y actualiza `versionName` con cada build
- ✅ **Compilación en la nube** - GitHub Actions compila el AAB automáticamente
- ✅ **Releases automáticos** - Crea releases en GitHub con el AAB adjunto
- ✅ **Deploy a Google Play** - (Opcional) Sube automáticamente a Google Play Console
- ✅ **Artifacts organizados** - AABs nombrados con versión para fácil identificación

## 🏁 Configuración Inicial (Una sola vez)

### Paso 1: Ejecutar el script de configuración

#### Windows:
```bash
node scripts/setup-github-actions.js
```

#### Linux/Mac:
```bash
chmod +x scripts/setup-complete.sh
./scripts/setup-complete.sh
```

Este script:
- Lee tu configuración de keystore desde `android/key.properties`
- Codifica el keystore en base64
- Te muestra los valores para configurar en GitHub
- (Opcional) Intenta configurar los secrets automáticamente si tienes GitHub CLI

### Paso 2: Configurar Secrets en GitHub

Ve a: **Tu Repositorio → Settings → Secrets and variables → Actions**

Crea estos secrets con los valores proporcionados por el script:

| Secret | Descripción |
|--------|-------------|
| `KEYSTORE_BASE64` | Tu keystore codificado en base64 |
| `KEYSTORE_PASSWORD` | Password del keystore |
| `KEY_PASSWORD` | Password de la key |
| `KEY_ALIAS` | Alias de la key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | (Opcional) Service account para Google Play |

> **Nota**: Los valores exactos están guardados en `scripts/github-secrets.txt` (este archivo NO se sube a Git)

### Paso 3: Configurar Google Play (Opcional)

Si quieres deploy automático a Google Play:

1. Ve a Google Play Console → API Access
2. Crea un Service Account
3. Descarga el archivo JSON
4. Cópialo como secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` en GitHub

## 🎯 Uso del Sistema

### Opción 1: Deploy Automático Completo (Recomendado)

Ejecuta el script de deploy automático:

#### Windows:
```bash
scripts\auto-deploy.sh
```

#### Linux/Mac:
```bash
./scripts/auto-deploy.sh
```

Este script:
1. ✅ Verifica que estés en la rama correcta
2. ✅ Hace commit de cambios pendientes (si los hay)
3. ✅ Sincroniza con GitHub (pull)
4. ✅ Opcionalmente incrementa la versión localmente
5. ✅ Hace push para activar GitHub Actions
6. ✅ Te da el link directo al workflow

### Opción 2: Push Manual

Simplemente haz push a la rama `main`:

```bash
git add .
git commit -m "Nueva funcionalidad"
git push origin main
```

GitHub Actions se activará automáticamente y:
- Incrementará la versión
- Compilará el AAB
- Creará un release con el AAB
- (Opcional) Subirá a Google Play

### Opción 3: Compilación Local

Para compilar localmente sin GitHub Actions:

#### Windows:
```bash
scripts\build-android.bat
```

#### Linux/Mac:
```bash
node scripts/build-android.js
```

## 📦 Descargar el AAB Compilado

### Desde GitHub Actions:
1. Ve a: **Actions** → selecciona el workflow más reciente
2. Scroll down hasta **Artifacts**
3. Descarga: `app-release-v{version}-{build}.aab`

### Desde Releases:
1. Ve a: **Releases** en tu repositorio
2. Selecciona la versión que quieres
3. Descarga el archivo `app-release.aab`

## 🔧 Configuración del Workflow

El workflow está en `.github/workflows/build-android.yml`

### Trigger automático:
- ✅ Push a rama `main`

### Trigger manual:
- ✅ Desde la pestaña Actions → "Build Android AAB" → "Run workflow"

### Opciones de versionado:
- `auto` - Incrementa automáticamente (default)
- `major` - Cambio mayor (1.0.0 → 2.0.0)
- `minor` - Cambio menor (1.0.0 → 1.1.0)
- `patch` - Parche (1.0.0 → 1.0.1)

## 📝 Release Notes

Los release notes se encuentran en `android/release-notes/`:

```
android/release-notes/
├── es-ES/
│   └── default.txt
└── en-US/
    └── default.txt
```

Edita estos archivos para personalizar el mensaje que verán los usuarios al actualizar.

## 🚨 Troubleshooting

### Error: "KEYSTORE_BASE64 secret not found"
→ Asegúrate de haber configurado todos los secrets en GitHub

### Error: "Gradle build failed"
→ Verifica que `android/key.properties` y el keystore existan localmente

### Error: "Upload to Google Play failed"
→ Verifica que el Service Account tenga permisos y que el package name sea correcto

### El workflow no se activa automáticamente
→ Verifica que estés pusheando a la rama `main` y que el workflow esté habilitado en Actions

## 📊 Flujo del Sistema

```
┌─────────────────┐
│  git push main  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  GitHub Actions     │
│  se activa          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Incrementa versión │
│  auto (build.gradle)│
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Compila web        │
│  (npm run build)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Sync Capacitor     │
│  (npx cap sync)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Compila AAB        │
│  (gradlew bundle)   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Crea Release       │
│  con AAB adjunto    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  (Opcional)         │
│  Sube a Google Play │
└─────────────────────┘
```

## 🎓 Comandos Útiles

```bash
# Ver status del repositorio
git status

# Ver historial de commits
git log --oneline

# Ver workflows en ejecución
gh run list  # Requiere GitHub CLI

# Ver secrets configurados (solo nombres)
gh secret list  # Requiere GitHub CLI

# Cancelar un workflow en ejecución
gh run cancel <run-id>  # Requiere GitHub CLI
```

## 🔗 Enlaces Útiles

- [GitHub Actions](https://github.com/features/actions)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Google Play Console](https://play.google.com/console)
- [GitHub CLI](https://cli.github.com/)

## 💡 Tips

1. **Commits claros** - Usa mensajes descriptivos, aparecerán en los releases
2. **Branches** - Desarrolla en branches y haz merge a `main` solo cuando esté listo
3. **Tags** - Los releases se crean automáticamente, no necesitas tags manuales
4. **Versiones** - El sistema maneja versionado automático, no edites manualmente
5. **Secrets** - NUNCA subas secrets al repositorio, siempre usa GitHub Secrets

---

**¿Necesitas ayuda?** Abre un issue en el repositorio o consulta la documentación de GitHub Actions.
