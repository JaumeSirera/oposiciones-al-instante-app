# SOLUCIÓN AL ERROR 500 - Sistema de Roles para Procesos

## ⚠️ PROBLEMA ACTUAL
El error 500 ocurre porque `procesos_usuario.php` necesita:
1. Las columnas `id_usuario` y `es_publico` en la tabla `procesos`
2. Validación de token JWT en lugar de consulta a tabla usuarios

## 📋 SOLUCIÓN EN 2 PASOS

### PASO 1: Ejecutar SQL en MySQL

Ejecuta este SQL en tu base de datos (ver archivo `ALTER_TABLE_PROCESOS.sql`):

```sql
ALTER TABLE procesos 
ADD COLUMN id_usuario INT(11) UNSIGNED NULL AFTER descripcion,
ADD COLUMN es_publico TINYINT(1) DEFAULT 0 AFTER id_usuario;

CREATE INDEX idx_procesos_usuario ON procesos(id_usuario);
CREATE INDEX idx_procesos_publico ON procesos(es_publico);
```

### PASO 2: Subir archivos PHP actualizados

Sube estos 2 archivos a `https://oposiciones-test.com/api/`:

1. **procesos.php** - Gestión completa de procesos con roles
2. **procesos_usuario.php** - **CRÍTICO**: Este archivo ahora usa JWT en vez de consultar la tabla usuarios

## 🔐 Lógica de Roles Implementada

| Rol | Procesos que ve | Puede crear |
|-----|----------------|-------------|
| **SA** | Todos los activos | Procesos públicos |
| **admin** | Públicos + propios | Procesos privados |
| **user** | Solo públicos | No puede crear |

## 📁 Archivos en esta carpeta

### 1. `procesos.php`
Gestión CRUD de procesos con autenticación JWT.

**Funcionalidades:**
- GET: Lista todos los procesos (con filtros opcionales)
- POST: Crea proceso (requiere rol admin/SA)
  - SA → crea públicos (`es_publico=1`)
  - admin → crea privados (`es_publico=0`)
- PUT/DELETE: Actualiza/elimina (solo admin/SA)

### 2. `procesos_usuario.php` ⚠️ ARCHIVO CRÍTICO
Filtra procesos según rol del usuario autenticado.

**Cambios principales:**
- ✅ Usa `validarToken()` para obtener rol del JWT
- ✅ No consulta tabla `usuarios` (evita el error 500)
- ✅ Retorna array directo (no objeto `{success, procesos}`)
- ✅ Aplica filtros según rol:
  - SA: todos activos
  - admin: públicos + propios
  - user: solo públicos

### 3. `ALTER_TABLE_PROCESOS.sql`
Script SQL para agregar columnas necesarias.

## ✅ Verificación Post-Instalación

Después de completar los 2 pasos:

1. **Recarga la aplicación** (Ctrl+F5)
2. **El error 500 debe desaparecer**
3. **Verifica los procesos visibles** según tu rol:
   - Si eres SA: verás todos los procesos activos
   - Si eres admin: verás públicos + tus propios procesos
   - Si eres user: solo verás procesos públicos

## 🔍 Queries SQL Implementadas

### Usuario SA
```sql
SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado
FROM procesos 
WHERE estado = 'activo'
ORDER BY descripcion ASC
```

### Usuario admin
```sql
SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado
FROM procesos 
WHERE estado = 'activo' AND (es_publico = 1 OR id_usuario = ?)
ORDER BY descripcion ASC
```

### Usuario normal
```sql
SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado
FROM procesos 
WHERE estado = 'activo' AND es_publico = 1
ORDER BY descripcion ASC
```

## 🚨 Diferencias Clave vs Versión Anterior

### ❌ ANTES (causaba error 500)
```php
// Consultaba tabla usuarios
$stmt = $conn->prepare("SELECT nivel FROM usuarios WHERE id = ?");
$stmt->bind_param("i", $id_usuario);
// ... podía fallar si la tabla no existe o tiene estructura diferente
```

### ✅ AHORA (funciona correctamente)
```php
// Usa el token JWT que ya viene en el header
$payload = validarToken($claveJWT);
$nivel = $payload['nivel'] ?? 'user';
// ... más robusto, usa datos ya autenticados
```

## 📝 Notas Adicionales

- El archivo `config.php` debe contener la variable `$claveJWT` con tu clave secreta
- Los tokens JWT deben incluir los campos: `id`, `nivel`, `exp`
- La columna `nivel` en usuarios debe ser: 'SA', 'admin', o 'user'
```json
{
  "ok": true,
  "preguntas": 2,
  "es_publico": 1,
  "rol": "sa"
}
```

### Test 2: Generar pregunta como admin
Mismo curl pero con `id_usuario` de un admin.

**Respuesta esperada:**
```json
{
  "ok": true,
  "preguntas": 2,
  "es_publico": 0,
  "rol": "admin"
}
```

### Test 3: Verificar en BD
```sql
-- Ver últimas preguntas con rol del creador
SELECT 
  p.id,
  p.pregunta,
  p.es_publico,
  u.nivel as rol_creador
FROM preguntas p
INNER JOIN usuarios u ON p.id_usuario = u.id
ORDER BY p.id DESC
LIMIT 10;
```

## 📊 Logs

Los archivos generan logs detallados:

**Archivo:** `log_preguntas.txt`
```
2025-01-14 10:30:45 | Usuario 1 tiene rol: sa
2025-01-14 10:30:45 | Usuario 1 (rol: sa) generará preguntas PÚBLICAS
2025-01-14 10:30:47 | ✅ Commit OK: 5 preguntas públicas para usuario 1
```

**Archivo:** `log_psicotecnicos.txt`
```
2025-01-14 10:35:12 | Usuario 2 tiene rol: admin
2025-01-14 10:35:12 | Usuario 2 (rol: admin) generará preguntas psico PRIVADAS
2025-01-14 10:35:15 | ✅ OK 10 insertadas privadas | user=2 proc=100
```

## ⚠️ Notas Importantes

1. **Compatibilidad**: Los archivos funcionan CON o SIN la columna `es_publico`. Si no existe, simplemente no guardan ese dato.

2. **Normalización de roles**: Los roles se normalizan a minúsculas: `SA → sa`, `Admin → admin`, `USER → user`

3. **Default rol**: Si no se encuentra el rol del usuario, se asume `user` (sin permisos de generación)

4. **Transacciones**: Todas las inserciones usan transacciones MySQL. Si falla alguna pregunta, se hace ROLLBACK completo.

5. **Endpoint de consultas**: Necesitarás modificar tu endpoint PHP que consulta preguntas para implementar el filtrado por rol. Ver ejemplos en `INSTRUCCIONES_SQL.sql`.

## 🚀 Próximos Pasos

1. Modificar endpoint de consulta de preguntas (ej: `/api/obtener_preguntas.php`)
2. Agregar UI para mostrar badge "Pública/Privada" en admin
3. Implementar filtros de búsqueda por visibilidad
4. Agregar estadísticas de preguntas públicas/privadas por usuario

## 🆘 Soporte

Si encuentras errores:
1. Revisa los logs: `log_preguntas.txt` y `log_psicotecnicos.txt`
2. Verifica la estructura de tu BD con `SHOW COLUMNS FROM preguntas`
3. Confirma que los roles están correctamente asignados en `usuarios.nivel`
