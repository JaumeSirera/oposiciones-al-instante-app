# Google Play Billing v8 — Donaciones

Guía rápida para dejar operativas las donaciones nativas en Android.

## 1. SQL

Ejecuta en tu MySQL:
```
PHP_MODIFICADOS_ROLES/CREAR_TABLA_DONACIONES_IAP.sql
```

## 2. PHP

Sube al servidor `PHP_MODIFICADOS_ROLES/validar_donacion_google.php` a `/api/` (junto al resto de endpoints).

## 3. Cuenta de servicio de Google

1. Sube el JSON de tu cuenta de servicio a una ruta **fuera** de `public_html`, por ejemplo:
   `/home/USUARIO/private/google-play-service-account.json`
2. Ajusta la constante `$SERVICE_ACCOUNT_JSON` dentro de `validar_donacion_google.php` a esa ruta.
3. En Google Play Console → Users & permissions, invita al email de la cuenta de servicio con permiso **"View financial data, orders and cancellation survey responses"** para el paquete `com.jaumesirera.TestsOposiciones`.

## 4. Productos en Google Play Console

Crea **3 productos consumibles gestionados** con estos IDs exactos:

| ID producto  | Precio |
|--------------|--------|
| `donation_5` | 5,00 € |
| `donation_10`| 10,00 €|
| `donation_20`| 20,00 €|

Publícalos (aunque sea en test cerrado). Sin publicación no aparecerán en la app.

## 5. Compilar Android

```
npm install
npx cap sync android
cd android && gradlew.bat :app:bundleRelease
```

El plugin `cordova-plugin-purchase` se enlaza automáticamente vía Capacitor.

## 6. Comprobación

- Abre la app en un dispositivo con la cuenta de tester añadida en Play Console.
- Ve a `/donacion`: el botón mostrará **"Donar Xé vía Google Play"** (verde).
- Tras pagar, el hook llama a `validar_donacion_google.php`, que consulta la Google Play Developer API y consume el producto para permitir donar de nuevo.

## Notas

- En **web** el flujo Stripe existente se mantiene intacto.
- La política de Google exige Billing para bienes/servicios digitales dentro de la app; las donaciones a organizaciones benéficas registradas podrían usar otros medios, pero para donaciones al desarrollador **Google Play Billing es lo correcto**.
- `cordova-plugin-purchase@13` usa Billing Library v7; su próxima release mayor se actualizará a v8 (antes del 31 ago 2026). Bastará con `bun update cordova-plugin-purchase` y `npx cap sync`.
