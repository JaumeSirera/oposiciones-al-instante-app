# Compilación Automática de Android AAB

Este proyecto incluye scripts automatizados para compilar la aplicación Android y generar el archivo AAB listo para subir a Google Play Store.

## 📋 Requisitos Previos

1. **Android Studio** instalado con JDK
2. **Node.js** instalado
3. **Archivo de firma** configurado en `android/key.properties`
4. **Variables de entorno** (el script las configura automáticamente)

## 🚀 Uso Rápido

### En Windows:

```bash
# Opción 1: Ejecutar el script BAT (configura JAVA_HOME automáticamente)
scripts\build-android.bat

# Opción 2: Ejecutar directamente con Node
node scripts/build-android.js
```

### En Linux/Mac:

```bash
node scripts/build-android.js
```

## ⚙️ ¿Qué hace el script?

El script automáticamente:

1. ✅ **Incrementa versionCode** en 1 (de 68 a 69, etc.)
2. ✅ **Actualiza versionName** con la fecha actual (formato DD.MM.YY)
3. ✅ **Compila la aplicación web** (`npm run build`)
4. ✅ **Sincroniza Capacitor** (`npx cap sync android`)
5. ✅ **Genera el AAB firmado** (`gradlew :app:bundleRelease`)

## 📦 Resultado

El archivo AAB se genera en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

Este archivo está listo para subirse a Google Play Console.

## 🔧 Configuración Manual (si es necesario)

Si el script `build-android.bat` no funciona, asegúrate de que JAVA_HOME apunte a tu JDK de Android Studio:

```bash
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
```

## 📝 Notas

- El versionCode se incrementa automáticamente cada vez que ejecutas el script
- El versionName se actualiza con la fecha actual
- No necesitas editar manualmente `android/app/build.gradle`
- El script muestra la salida completa de cada paso para facilitar la depuración

## ❗ Solución de Problemas

### Error: "JAVA_HOME not found"
Ejecuta `scripts\build-android.bat` en lugar de `node scripts/build-android.js`

### Error: "keystore not found"
Verifica que exista el archivo `android/key.properties` con las rutas correctas

### Error en compilación Gradle
Verifica que Android Studio esté correctamente instalado y que tengas las dependencias necesarias

## 🎯 Flujo Completo

```
┌─────────────────────────┐
│ Ejecutar script         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Incrementar versión     │ versionCode++, versionName=fecha
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ npm run build           │ Compila React/Vite
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ npx cap sync android    │ Sincroniza con Capacitor
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ gradlew bundleRelease   │ Genera AAB firmado
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ AAB listo para subir    │ ✓
└─────────────────────────┘
```
