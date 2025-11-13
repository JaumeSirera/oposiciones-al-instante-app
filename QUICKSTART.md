# ⚡ Quick Start - Deploy Automatizado

Guía rápida de 5 minutos para configurar el sistema de deploy automático.

## 🎯 ¿Qué tendrás al final?

✅ Cada push a GitHub compila automáticamente tu APK/AAB  
✅ Versionado automático en cada build  
✅ Releases organizados con archivos descargables  
✅ (Opcional) Deploy automático a Google Play  

## 🚀 Pasos (5 minutos)

### 1. Conectar a GitHub (si aún no lo hiciste)

En Lovable:
1. Click en botón **GitHub** (arriba derecha)
2. **Connect to GitHub** → Autorizar
3. **Create Repository**

### 2. Clonar el proyecto localmente

```bash
git clone <URL_DE_TU_REPO>
cd <nombre-del-proyecto>
npm install
```

### 3. Configurar secrets de GitHub

#### Windows:
```bash
node scripts/setup-github-actions.js
```

#### Linux/Mac:
```bash
./scripts/setup-complete.sh
```

Este script te mostrará los valores que necesitas copiar.

### 4. Añadir secrets en GitHub

1. Ve a: **Tu Repo → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Añade estos 4 secrets (copia los valores del paso 3):
   - `KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_PASSWORD`
   - `KEY_ALIAS`

### 5. ¡Listo! Haz tu primer deploy

```bash
git add .
git commit -m "Configurar deploy automático"
git push origin main
```

Ve a **Actions** en GitHub y verás tu build en progreso 🎉

## 📥 Descargar el AAB

Cuando termine el build:

**Opción 1 - Desde Actions:**
- Actions → workflow → Artifacts → Descargar AAB

**Opción 2 - Desde Releases:**
- Releases → Última versión → Descargar `app-release.aab`

## 🔄 Uso diario

Desde ahora, solo necesitas:

```bash
# Opción A: Script automático (recomendado)
./scripts/auto-deploy.sh

# Opción B: Git normal
git add .
git commit -m "Mi cambio"
git push
```

El AAB se compilará automáticamente en GitHub y estará listo para descargar.

## 📱 Subir a Google Play

1. Descarga el AAB desde GitHub
2. Ve a [Google Play Console](https://play.google.com/console)
3. Tu App → Producción → Crear nueva versión
4. Sube el AAB
5. ¡Publica!

## 🤔 ¿Preguntas?

- **¿Cuánto tarda el build?** → 5-10 minutos
- **¿Cuesta algo?** → No, GitHub Actions es gratis para repos públicos y 2000 min/mes en privados
- **¿Puedo compilar localmente?** → Sí: `node scripts/build-android.js`
- **¿Funciona con iOS?** → Este setup es solo Android, iOS requiere macOS + Xcode

## 📚 Más información

- **Guía completa:** Lee `DEPLOY_AUTOMATIZADO.md`
- **Scripts:** Lee `scripts/README.md`
- **Troubleshooting:** Lee `BUILD_ANDROID.md`

---

**🎉 ¡Ya está todo configurado!** Ahora puedes desarrollar tranquilo sabiendo que cada push compilará automáticamente tu app.
