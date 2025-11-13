# 📱 Guía de Compilación Android

> **Sistema completo de compilación y deploy automatizado para Android**

## 🎯 Empieza Aquí

### ¿Primera vez? → [QUICKSTART.md](QUICKSTART.md) (5 minutos)

### ¿Ya configuraste todo? → [SISTEMA_COMPLETO.md](SISTEMA_COMPLETO.md)

---

## 📚 Documentación

| Documento | Para qué sirve | Cuándo leerlo |
|-----------|----------------|---------------|
| [**QUICKSTART.md**](QUICKSTART.md) | Setup inicial rápido | Primera vez usando el sistema |
| [**SISTEMA_COMPLETO.md**](SISTEMA_COMPLETO.md) | Visión general de todos los métodos | Entender todas las opciones |
| [**DEPLOY_AUTOMATIZADO.md**](DEPLOY_AUTOMATIZADO.md) | Guía completa de GitHub Actions | Configurar deploy automático |
| [**BUILD_ANDROID.md**](BUILD_ANDROID.md) | Compilación local paso a paso | Compilar en tu computadora |
| [**scripts/README.md**](scripts/README.md) | Documentación de scripts | Usar los scripts correctamente |

---

## ⚡ Comandos Rápidos

### Para usuarios de Windows:

```bash
# Setup inicial (solo una vez)
node scripts\setup-github-actions.js

# Build local
scripts\build-android.bat

# Deploy automático (requiere Git Bash o WSL)
bash scripts/auto-deploy.sh
```

### Para usuarios de Linux/Mac:

```bash
# Setup completo (solo una vez)
chmod +x scripts/*.sh
./scripts/setup-complete.sh

# Build local
node scripts/build-android.js

# Deploy automático
./scripts/auto-deploy.sh
```

---

## 🚀 Los 3 Métodos de Compilación

### 1️⃣ GitHub Actions (Recomendado para producción)
✅ Completamente automático  
✅ No requiere Android Studio local  
✅ Versionado automático  
✅ Releases organizados  
✅ Deploy opcional a Google Play  

**Cómo:** Push a GitHub → Build automático → Descarga AAB  
**Docs:** [DEPLOY_AUTOMATIZADO.md](DEPLOY_AUTOMATIZADO.md)

### 2️⃣ Build Local (Recomendado para desarrollo)
✅ Rápido para testing  
✅ No depende de internet  
✅ Control total del proceso  

**Cómo:** `node scripts/build-android.js`  
**Docs:** [BUILD_ANDROID.md](BUILD_ANDROID.md)

### 3️⃣ Manual (Para troubleshooting)
✅ Máximo control  
✅ Útil para debugging  

**Cómo:** Comandos Gradle directos  
**Docs:** [BUILD_ANDROID.md](BUILD_ANDROID.md) + `Instrucciones para compilar.txt`

---

## 🎯 Flujo de Trabajo Recomendado

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  1. Desarrolla en Lovable (Visual + Rápido)            │
│                      ↓                                   │
│  2. Cambios automáticos → GitHub (Sync bidireccional)   │
│                      ↓                                   │
│  3. Push a 'main' → Build automático en GitHub Actions  │
│                      ↓                                   │
│  4. Descarga AAB → Sube a Google Play Console           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
📦 Proyecto
│
├── 📘 COMPILACION_ANDROID.md      ← EMPIEZA AQUÍ
├── 📗 QUICKSTART.md               ← Setup en 5 minutos
├── 📕 DEPLOY_AUTOMATIZADO.md      ← GitHub Actions completo
├── 📙 BUILD_ANDROID.md            ← Build local completo
├── 📓 SISTEMA_COMPLETO.md         ← Overview de todo
│
├── 📂 scripts/                    ← Scripts de automatización
│   ├── 📄 README.md               ← Docs de scripts
│   ├── build-android.js           ← Build local
│   ├── build-android.bat          ← Build (Windows)
│   ├── setup-github-actions.js    ← Setup GitHub
│   ├── setup-complete.sh          ← Setup completo
│   └── auto-deploy.sh             ← Deploy automático
│
├── 📂 .github/workflows/          ← CI/CD
│   └── build-android.yml          ← Workflow automático
│
└── 📂 android/                    ← Proyecto Android
    ├── key.properties             ← Config keystore
    ├── app/
    │   ├── eas-upload.jks        ← Keystore (no subir a Git)
    │   └── build.gradle          ← Config versión
    └── release-notes/
        ├── es-ES/
        └── en-US/
```

---

## 🔑 Conceptos Clave

### AAB (Android App Bundle)
Formato moderno de Android para distribución. Google Play lo optimiza automáticamente para cada dispositivo.

### Keystore
Archivo que contiene tu certificado de firma. **¡Guárdalo bien!** Sin él no podrás actualizar tu app.

### versionCode
Número entero que incrementa en cada build (1, 2, 3...). Google Play lo usa para saber qué versión es más nueva.

### versionName
Nombre legible de la versión (ej: "13.11.25"). Lo ven los usuarios en Google Play.

### GitHub Actions
Sistema de CI/CD de GitHub que compila tu app automáticamente en la nube.

### Capacitor
Framework que convierte tu app web en app nativa Android/iOS.

---

## 🆘 Solución Rápida de Problemas

| Problema | Solución Rápida |
|----------|-----------------|
| **"JAVA_HOME not found"** | Instala Android Studio o configura JAVA_HOME |
| **"keystore not found"** | Verifica que `android/app/eas-upload.jks` exista |
| **Workflow falla en GitHub** | Revisa que los 4 secrets estén configurados |
| **Error de Gradle** | Ejecuta `cd android && ./gradlew clean` |
| **App no instala** | Verifica firma del keystore |

**Más detalles:** Cada documento tiene su propia sección de troubleshooting.

---

## 🎓 Recursos Externos

- 🔗 [Lovable Docs](https://docs.lovable.dev/)
- 🔗 [Capacitor Docs](https://capacitorjs.com/docs)
- 🔗 [GitHub Actions](https://docs.github.com/actions)
- 🔗 [Google Play Console](https://play.google.com/console)
- 🔗 [Android Developer](https://developer.android.com/)

---

## ✅ Checklist de Verificación

### Setup inicial completado:
- [ ] Leí [QUICKSTART.md](QUICKSTART.md)
- [ ] Conecté GitHub a Lovable
- [ ] Cloné el repositorio localmente
- [ ] Ejecuté el script de setup
- [ ] Configuré los 4 secrets en GitHub
- [ ] Hice mi primer push y verificué el build

### Build local configurado:
- [ ] Android Studio instalado
- [ ] JAVA_HOME configurado
- [ ] `android/key.properties` existe
- [ ] `android/app/eas-upload.jks` existe
- [ ] Build local funciona correctamente

### Listo para producción:
- [ ] Build automático funciona en GitHub
- [ ] Puedo descargar AAB de GitHub Actions/Releases
- [ ] Probé la app en un dispositivo físico
- [ ] Configuré cuenta de Google Play Developer
- [ ] Listé la app en Google Play (o en progreso)

---

## 🎯 Próximos Pasos

1. **Si es tu primera vez:** Lee [QUICKSTART.md](QUICKSTART.md)
2. **Si quieres entender todo:** Lee [SISTEMA_COMPLETO.md](SISTEMA_COMPLETO.md)
3. **Si quieres automatizar:** Lee [DEPLOY_AUTOMATIZADO.md](DEPLOY_AUTOMATIZADO.md)
4. **Si tienes problemas:** Lee la sección de troubleshooting en cada doc

---

## 🎉 ¡Listo para Empezar!

Con esta documentación y estos scripts, tienes todo lo necesario para compilar y desplegar tu app Android de forma profesional y automatizada.

**¿Preguntas?** Revisa la documentación correspondiente o consulta el archivo `Instrucciones para compilar.txt` para comandos legacy.

---

**Última actualización:** Noviembre 2025  
**Versión del sistema:** 2.0 (Automatizado)
