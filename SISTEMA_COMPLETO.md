# 🏗️ Sistema Completo de Compilación y Deploy

## 📊 Visión General

Este proyecto tiene **3 formas de compilar** la app Android:

| Método | Cuándo usarlo | Complejidad |
|--------|---------------|-------------|
| 🚀 **GitHub Actions** | Deploy a producción | ⭐ Fácil |
| 💻 **Build Local** | Testing y desarrollo | ⭐⭐ Media |
| 🔧 **Manual** | Troubleshooting | ⭐⭐⭐ Avanzada |

## 🚀 Método 1: GitHub Actions (Recomendado)

**✅ Lo mejor para:** Producción, builds limpios, colaboración

### Ventajas:
- ✅ Totalmente automático
- ✅ No necesitas Android Studio
- ✅ No necesitas configurar nada localmente
- ✅ Versionado automático
- ✅ Releases organizados
- ✅ Compilaciones en paralelo
- ✅ Deploy directo a Google Play (opcional)

### Setup:
```bash
# 1. Conecta GitHub desde Lovable
# 2. Clona el repo localmente
# 3. Ejecuta:
node scripts/setup-github-actions.js

# 4. Configura secrets en GitHub (te lo muestra el script)
# 5. ¡Listo! Cada push compilará automáticamente
```

### Uso:
```bash
# Opción A: Script automático
./scripts/auto-deploy.sh

# Opción B: Git normal
git push origin main
```

### Descargar AAB:
- **GitHub Actions** → Artifacts
- **GitHub Releases** → Download AAB

📖 **Documentación:** `DEPLOY_AUTOMATIZADO.md`

---

## 💻 Método 2: Build Local

**✅ Lo mejor para:** Desarrollo rápido, testing antes de push

### Requisitos:
- Node.js 18+
- Android Studio con JDK
- Keystore configurado

### Setup (una vez):
```bash
# Asegúrate de tener estos archivos:
android/key.properties
android/app/eas-upload.jks
```

### Uso:

#### Windows:
```bash
scripts\build-android.bat
```

#### Linux/Mac/Multiplataforma:
```bash
node scripts/build-android.js
```

### Salida:
```
android/app/build/outputs/bundle/release/app-release.aab
```

📖 **Documentación:** `BUILD_ANDROID.md`

---

## 🔧 Método 3: Comandos Manuales

**✅ Lo mejor para:** Troubleshooting, casos especiales

### Proceso completo:

```bash
# 1. Configurar JAVA_HOME (Windows)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"

# 2. Build web
npm run build

# 3. Sync Capacitor
npx cap sync android

# 4. Build AAB
cd android
gradlew.bat :app:bundleRelease --stacktrace
```

### Incrementar versión manualmente:

Edita `android/app/build.gradle`:
```gradle
versionCode 123  // Incrementa en 1
versionName "13.11.25"  // Fecha DD.MM.YY
```

📖 **Documentación:** `Instrucciones para compilar.txt`

---

## 📁 Estructura de Archivos

```
proyecto/
├── 📄 QUICKSTART.md                 ← Empieza aquí (5 min)
├── 📄 DEPLOY_AUTOMATIZADO.md        ← Guía completa GitHub Actions
├── 📄 BUILD_ANDROID.md              ← Guía build local
├── 📄 SISTEMA_COMPLETO.md           ← Este archivo (overview)
│
├── scripts/
│   ├── 📄 README.md                 ← Docs de los scripts
│   ├── 🔧 build-android.js          ← Build local
│   ├── 🔧 build-android.bat         ← Build local (Windows)
│   ├── 🔧 setup-github-actions.js   ← Setup inicial GitHub
│   ├── 🔧 setup-github-actions.bat  ← Setup (Windows)
│   ├── 🔧 setup-complete.sh         ← Setup completo (Linux/Mac)
│   └── 🔧 auto-deploy.sh            ← Deploy automático
│
├── .github/
│   └── workflows/
│       └── build-android.yml        ← Workflow de GitHub Actions
│
└── android/
    ├── key.properties               ← Config del keystore
    ├── app/
    │   ├── eas-upload.jks          ← Keystore de firma
    │   └── build.gradle            ← Versión de la app
    └── release-notes/
        ├── es-ES/default.txt       ← Release notes español
        └── en-US/default.txt       ← Release notes inglés
```

---

## 🎯 Flujo Recomendado

### Para desarrollo diario:

```bash
# 1. Desarrolla en Lovable (visual + rápido)
# 2. Cambios automáticos → GitHub (sync bidireccional)
# 3. Cada push → Build automático
# 4. Descarga AAB → Sube a Google Play
```

### Para testing local antes de producción:

```bash
# 1. git pull (traer cambios de Lovable)
# 2. npm install (actualizar deps)
# 3. node scripts/build-android.js (compilar local)
# 4. Probar AAB en dispositivo
# 5. git push (activar build de producción)
```

---

## 🆚 Comparación de Métodos

| Característica | GitHub Actions | Build Local | Manual |
|----------------|---------------|-------------|--------|
| **Setup inicial** | Media (5 min) | Fácil (1 min) | Difícil |
| **Compilación** | Automática | 1 comando | Múltiples pasos |
| **Versionado** | ✅ Automático | ✅ Automático | ❌ Manual |
| **Releases** | ✅ Sí | ❌ No | ❌ No |
| **Deploy Google Play** | ✅ Opcional | ❌ Manual | ❌ Manual |
| **Requiere Android Studio** | ❌ No | ✅ Sí | ✅ Sí |
| **Requiere configuración local** | ❌ No | ✅ Sí | ✅ Sí |
| **Tiempo de build** | 5-10 min | 2-5 min | 2-5 min |
| **Costo** | ✅ Gratis | ✅ Gratis | ✅ Gratis |
| **Historial** | ✅ Sí | ❌ No | ❌ No |
| **Reproducible** | ✅ Siempre | ⚠️ Depende | ⚠️ Depende |

---

## 🚦 Guía de Decisión

### ¿Qué método usar?

```
┌─────────────────────────────────┐
│ ¿Es tu primera vez compilando?  │
└──────────┬──────────────────────┘
           │
           ├─ Sí → Lee QUICKSTART.md
           │       Setup GitHub Actions
           │
           └─ No → ¿Qué necesitas?
                   │
                   ├─ Subir a Google Play
                   │  → GitHub Actions
                   │
                   ├─ Testing rápido
                   │  → Build Local
                   │
                   ├─ Debug de errores
                   │  → Manual
                   │
                   └─ Desarrollo diario
                      → Lovable + GitHub Actions
```

---

## 📞 Ayuda y Soporte

### Tengo un error en el build
1. Lee la sección de troubleshooting en `BUILD_ANDROID.md`
2. Revisa los logs completos (GitHub Actions o local)
3. Verifica que el keystore esté configurado

### No tengo keystore
1. Genera uno nuevo: `BUILD_ANDROID.md` → Sección "Crear Keystore"
2. Configura `android/key.properties`
3. Vuelve a ejecutar el build

### El workflow de GitHub falla
1. Verifica que los 4 secrets estén configurados
2. Revisa los logs en Actions
3. Asegúrate que el keystore sea válido

### ¿Cómo actualizo la app en Google Play?
1. Descarga el AAB desde GitHub
2. Google Play Console → Tu app → Producción
3. Crear nueva versión → Subir AAB → Revisar → Publicar

---

## 🎓 Recursos Adicionales

- 📖 [Quick Start (5 min)](QUICKSTART.md)
- 📖 [Deploy Automatizado - Guía Completa](DEPLOY_AUTOMATIZADO.md)
- 📖 [Build Local - Guía Completa](BUILD_ANDROID.md)
- 📖 [Scripts - Documentación](scripts/README.md)
- 🔗 [Capacitor Docs](https://capacitorjs.com/docs)
- 🔗 [GitHub Actions Docs](https://docs.github.com/actions)
- 🔗 [Google Play Console](https://play.google.com/console)

---

## ✅ Checklist de Verificación

### ¿Todo está configurado correctamente?

**GitHub Actions:**
- [ ] Repositorio conectado a GitHub
- [ ] 4 secrets configurados en GitHub
- [ ] Workflow presente en `.github/workflows/build-android.yml`
- [ ] Push a main → build se activa automáticamente

**Build Local:**
- [ ] Android Studio instalado con JDK
- [ ] `JAVA_HOME` configurado
- [ ] `android/key.properties` existe
- [ ] `android/app/eas-upload.jks` existe
- [ ] `node scripts/build-android.js` funciona

**Lovable + GitHub:**
- [ ] Cambios en Lovable → push automático a GitHub
- [ ] Push desde local → aparece en Lovable
- [ ] Sync bidireccional funcionando

---

**🎉 Con este sistema, tu flujo de trabajo está completamente automatizado. Desarrolla en Lovable, push automático a GitHub, build automático en la nube, y descarga el AAB listo para Google Play. ¡Simple!**
