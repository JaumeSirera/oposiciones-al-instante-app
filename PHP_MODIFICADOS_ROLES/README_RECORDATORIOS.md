# Sistema de Recordatorios de Planes de Estudio

## 📋 Archivos a subir a tu servidor PHP

1. **recordatorios_plan.php** - API para gestionar recordatorios
2. **cron_enviar_recordatorios.php** - Script del cron job
3. **CREAR_TABLAS_RECORDATORIOS.sql** - Tablas necesarias en la BD

## 🗄️ Paso 1: Crear las tablas en la base de datos

Ejecuta el archivo `CREAR_TABLAS_RECORDATORIOS.sql` en tu base de datos MySQL a través de phpMyAdmin o línea de comandos.

Este script creará:
- `recordatorios_plan` - Almacena los recordatorios programados
- `config_notificaciones_plan` - Configuración de notificaciones por usuario

## 📤 Paso 2: Subir archivos PHP

Sube estos archivos a la misma carpeta donde tienes tu API PHP:
- `recordatorios_plan.php`
- `cron_enviar_recordatorios.php`

Asegúrate de que estén en la misma carpeta que `config.php` (tu archivo de conexión a la BD).

## ⏰ Paso 3: Configurar el Cron Job

### Opción A: cPanel (Hosting compartido)

1. Accede a cPanel de tu hosting
2. Busca la sección "Cron Jobs" o "Tareas Cron"
3. Añade un nuevo cron job con esta configuración:

**Comando:**
```bash
/usr/bin/php /home/tuusuario/public_html/ruta/a/tu/api/cron_enviar_recordatorios.php
```

**Frecuencia sugerida:** Todos los días a las 8:00 AM
```
0 8 * * *
```

**Otras frecuencias comunes:**
- `30 7 * * *` - Todos los días a las 7:30 AM
- `0 9 * * *` - Todos los días a las 9:00 AM
- `0 20 * * *` - Todos los días a las 8:00 PM

### Opción B: Servidor VPS/Dedicado (Linux)

Edita el crontab:
```bash
crontab -e
```

Añade esta línea:
```bash
0 8 * * * /usr/bin/php /ruta/completa/a/cron_enviar_recordatorios.php >> /ruta/a/logs/recordatorios.log 2>&1
```

## 🔍 Verificar que funciona

### Prueba manual
Ejecuta el script manualmente para verificar que funciona:
```bash
php cron_enviar_recordatorios.php
```

Deberías ver una salida similar a:
```
=== Iniciando envío de recordatorios diarios ===
Fecha: 2024-01-15 08:00:00

Recordatorios pendientes encontrados: 3

Enviando recordatorio para: usuario@ejemplo.com - Plan: Oposiciones 2024
✓ Email enviado exitosamente

=== Resumen ===
Total procesados: 3
Enviados exitosamente: 3
Errores: 0
Finalizado: 2024-01-15 08:01:23
```

### Verificar logs
Si configuraste logs en el cron job, revisa el archivo de log:
```bash
tail -f /ruta/a/logs/recordatorios.log
```

## 📧 Configuración de Resend

El sistema usa Resend para enviar emails. Ya está configurado en Lovable Cloud con tu API key.

**Importante:** Asegúrate de verificar tu dominio en Resend:
https://resend.com/domains

## 🔧 Personalización

### Cambiar hora de envío por usuario

Los usuarios pueden tener diferentes horas de envío. Esto se configura en la tabla `config_notificaciones_plan`:

```sql
UPDATE config_notificaciones_plan 
SET hora_envio = '20:00:00' 
WHERE id_usuario = 123;
```

### Desactivar notificaciones para un usuario

```sql
UPDATE config_notificaciones_plan 
SET activo = 0 
WHERE id_usuario = 123;
```

## 🐛 Solución de problemas

### El cron no se ejecuta
- Verifica que la ruta al script PHP sea absoluta y correcta
- Asegúrate de que el archivo tenga permisos de ejecución (755)
- Revisa los logs del servidor para errores

### Los emails no se envían
- Verifica que la API key de Resend esté configurada correctamente
- Comprueba que tu dominio esté verificado en Resend
- Revisa los logs del script para ver errores específicos

### No hay recordatorios en la base de datos
- Asegúrate de que al crear un plan se llame a la función de crear recordatorios
- Verifica que las tablas se hayan creado correctamente

## 📞 Soporte

Si tienes problemas, revisa:
1. Los logs del cron job
2. Los logs de tu servidor PHP
3. La tabla `recordatorios_plan` en la base de datos
4. La configuración de Resend en https://resend.com

## ✅ Checklist de instalación

- [ ] Tablas creadas en la base de datos
- [ ] Archivos PHP subidos al servidor
- [ ] Cron job configurado
- [ ] Dominio verificado en Resend
- [ ] Prueba manual ejecutada exitosamente
- [ ] Primer email de prueba recibido
