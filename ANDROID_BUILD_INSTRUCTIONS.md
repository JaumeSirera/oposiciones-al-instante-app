# Instrucciones para Compilar y Publicar en Play Store

## Requisitos Previos

1. **Android Studio** instalado en tu computadora
2. **Node.js** versión 16 o superior
3. **Java JDK** versión 11 o superior
4. Cuenta de **Google Play Console** (cuesta $25 USD de registro único)

## Paso 1: Transferir el Proyecto a GitHub

1. Haz clic en el botón "Export to Github" en la esquina superior derecha de Lovable
2. Conecta tu cuenta de GitHub si no lo has hecho
3. Crea un nuevo repositorio para tu proyecto
4. Una vez transferido, clona el repositorio en tu máquina local:
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   cd TU_REPOSITORIO
   ```

## Paso 2: Configurar el Proyecto Localmente

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicializa Capacitor (si no está ya inicializado):
   ```bash
   npx cap init
   ```
   - App ID: `app.lovable.48fb2d1f6abf404785e460f69d619ae1`
   - App Name: `oposiciones-al-instante-app`

3. Añade la plataforma Android:
   ```bash
   npx cap add android
   ```

4. Actualiza las dependencias nativas:
   ```bash
   npx cap update android
   ```

## Paso 3: Compilar el Proyecto Web

1. Construye la versión de producción:
   ```bash
   npm run build
   ```

2. Sincroniza con Android:
   ```bash
   npx cap sync android
   ```

## Paso 4: Configurar para Producción

### 4.1 Cambiar la URL del servidor

Edita `capacitor.config.ts` y **ELIMINA O COMENTA** la sección `server` para producción:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.48fb2d1f6abf404785e460f69d619ae1',
  appName: 'oposiciones-al-instante-app',
  webDir: 'dist',
  // Comenta o elimina esta sección para producción
  // server: {
  //   url: 'https://48fb2d1f-6abf-4047-85e4-60f69d619ae1.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  android: {
    allowMixedContent: true
  }
};

export default config;
```

### 4.2 Generar un Keystore (Clave de Firma)

```bash
keytool -genkey -v -keystore oposiciones-release.keystore -alias oposiciones -keyalg RSA -keysize 2048 -validity 10000
```

Guarda bien:
- La contraseña del keystore
- La contraseña de la clave
- El archivo `.keystore` en un lugar seguro (¡nunca lo subas a GitHub!)

### 4.3 Configurar el Keystore en Android Studio

1. Abre el proyecto Android:
   ```bash
   npx cap open android
   ```

2. En Android Studio, ve a `Build > Generate Signed Bundle / APK`

3. Selecciona **Android App Bundle**

4. Haz clic en "Create new..." para configurar tu keystore

5. O edita manualmente `android/app/build.gradle` añadiendo:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("/ruta/a/tu/oposiciones-release.keystore")
            storePassword "tu_password_keystore"
            keyAlias "oposiciones"
            keyPassword "tu_password_clave"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Paso 5: Compilar el AAB (Android App Bundle)

### Opción A: Desde Android Studio
1. Ve a `Build > Generate Signed Bundle / APK`
2. Selecciona **Android App Bundle**
3. Selecciona tu keystore
4. Elige **release** como build variant
5. Haz clic en **Finish**

El AAB se generará en: `android/app/release/app-release.aab`

### Opción B: Desde Línea de Comandos
```bash
cd android
./gradlew bundleRelease
```

El AAB se generará en: `android/app/build/outputs/bundle/release/app-release.aab`

## Paso 6: Preparar Assets para Play Store

Necesitas crear los siguientes assets:

### Iconos de la App
- **Icono principal**: 512x512 px (PNG)
- **Icono de función**: 512x512 px (PNG)

### Screenshots (mínimo 2 por categoría)
- **Teléfono**: 1080x1920 px o más
- **Tablet de 7 pulgadas** (opcional): 1200x1920 px
- **Tablet de 10 pulgadas** (opcional): 1920x1200 px

### Banner de Función (opcional)
- 1024x500 px (PNG o JPG)

## Paso 7: Subir a Play Console

1. Ve a [Google Play Console](https://play.google.com/console)

2. Crea una nueva aplicación:
   - Nombre de la app: `Oposiciones Test`
   - Idioma predeterminado: `Español (España)`
   - Tipo: `Aplicación`

3. Completa la **Ficha de Play Store**:
   - Título (máx. 50 caracteres)
   - Descripción breve (máx. 80 caracteres)
   - Descripción completa (máx. 4000 caracteres)
   - Icono de la aplicación
   - Capturas de pantalla
   - Banner de función (opcional)

4. Ve a **Producción** > **Crear nueva versión**

5. Sube tu archivo `app-release.aab`

6. Completa la información de la versión:
   - Nombre de la versión: `1.0`
   - Notas de la versión

7. Completa el **Cuestionario de contenido**:
   - Clasificación de contenido
   - Público objetivo
   - Privacidad de datos

8. Configura **Precios y distribución**:
   - Países donde estará disponible
   - Si es gratis o de pago

9. Revisa todo y haz clic en **Enviar para revisión**

## Paso 8: Proceso de Revisión

- Google tardará entre **1-7 días** en revisar tu app
- Te notificarán por email sobre el estado
- Una vez aprobada, estará disponible en Play Store

## Actualizaciones Futuras

Cuando hagas cambios:

1. Haz los cambios en Lovable o en tu código local
2. Incrementa el `versionCode` y `versionName` en `android/app/build.gradle`:
   ```gradle
   defaultConfig {
       ...
       versionCode 2  // Incrementa este número
       versionName "1.1"  // Actualiza la versión
   }
   ```
3. Ejecuta:
   ```bash
   npm run build
   npx cap sync android
   ```
4. Compila un nuevo AAB
5. Sube el nuevo AAB a Play Console como una nueva versión

## Solución de Problemas Comunes

### Error: "Plugin not found"
```bash
npx cap sync android
```

### Error de compilación en Gradle
```bash
cd android
./gradlew clean
./gradlew bundleRelease
```

### App no se conecta a la API
- Verifica que has comentado la sección `server` en `capacitor.config.ts`
- Asegúrate de que tu API permite peticiones CORS desde la app

### Cambiar el App ID después de crear el proyecto
No es recomendable. Si necesitas cambiarlo:
1. Cambia el `appId` en `capacitor.config.ts`
2. Ejecuta `npx cap sync android`
3. Actualiza el `applicationId` en `android/app/build.gradle`

## Recursos Adicionales

- [Documentación de Capacitor](https://capacitorjs.com/docs)
- [Guía de Android Studio](https://developer.android.com/studio/intro)
- [Centro de Ayuda de Play Console](https://support.google.com/googleplay/android-developer)
- [Blog de Lovable sobre Capacitor](https://docs.lovable.dev)

## Notas Importantes

⚠️ **NUNCA** subas tu archivo `.keystore` a GitHub o repositorios públicos
⚠️ **GUARDA** las contraseñas del keystore en un lugar seguro
⚠️ **HAZ BACKUP** de tu archivo `.keystore` - sin él no podrás actualizar tu app
