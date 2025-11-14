# Sistema de Roles para Generación de Preguntas

## 📋 Resumen

Este sistema implementa visibilidad basada en roles para las preguntas generadas:

- **SA (superadmin)**: Genera preguntas **públicas** (visibles para todos)
- **admin**: Genera preguntas **privadas** (solo visibles para él mismo)
- **user**: Solo puede ver preguntas públicas

## 📁 Archivos Modificados

### 1. `generar_preguntas.php`
Generador de preguntas tipo test con sistema de roles implementado.

**Cambios principales:**
- Nueva función `obtener_rol_usuario()` - Consulta el rol desde tabla `usuarios.nivel`
- Nueva función `es_publico_segun_rol()` - Determina visibilidad según rol
- INSERT con campo `es_publico` (si la columna existe en la BD)
- Compatibilidad con BDs sin columna `es_publico`
- Logging completo del rol y visibilidad de cada generación

### 2. `generar_psicotecnicos.php`
Generador de pruebas psicotécnicas con sistema de roles implementado.

**Cambios principales:**
- Misma lógica de roles que `generar_preguntas.php`
- Soporte para columnas meta (tipo, habilidad, dificultad)
- Múltiples combinaciones de INSERT según columnas disponibles
- Logging detallado de rol y visibilidad

## 🗄️ Cambios en Base de Datos

### SQL Requerido

```sql
-- Agregar columna es_publico
ALTER TABLE preguntas ADD COLUMN es_publico TINYINT DEFAULT 0;

-- Crear índice para optimizar consultas
CREATE INDEX idx_preguntas_visibilidad ON preguntas(es_publico, id_usuario, id_proceso);
```

### Estructura de tabla `usuarios`
Los archivos PHP asumen que existe:
```sql
CREATE TABLE usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(255),
  nivel VARCHAR(50),  -- 'SA', 'admin', 'user'
  ...
);
```

## 🔐 Lógica de Visibilidad

### Generación de Preguntas

| Rol Usuario | Campo `es_publico` | Visible para |
|-------------|-------------------|--------------|
| SA | 1 | Todos los usuarios |
| admin | 0 | Solo el creador (admin) |
| user | N/A | No genera preguntas |

### Consulta de Preguntas

**Usuario SA:**
```sql
SELECT * FROM preguntas 
WHERE id_proceso = ? AND seccion IN (?) AND tema IN (?);
-- Ve TODAS las preguntas
```

**Usuario admin:**
```sql
SELECT * FROM preguntas 
WHERE id_proceso = ? 
  AND seccion IN (?) 
  AND tema IN (?)
  AND (es_publico = 1 OR id_usuario = ?);
-- Ve preguntas públicas + sus propias preguntas
```

**Usuario normal:**
```sql
SELECT * FROM preguntas 
WHERE id_proceso = ? 
  AND seccion IN (?) 
  AND tema IN (?)
  AND es_publico = 1;
-- Solo ve preguntas públicas
```

## 📦 Instalación

### Paso 1: Backup
```bash
# Respalda tus archivos actuales
cp generar_preguntas.php generar_preguntas.php.backup
cp generar_psicotecnicos.php generar_psicotecnicos.php.backup
```

### Paso 2: Subir archivos al servidor PHP
Copia los archivos de esta carpeta a tu servidor PHP:
- `generar_preguntas.php` → `/api/generar_preguntas.php`
- `generar_psicotecnicos.php` → `/api/generar_psicotecnicos.php`

### Paso 3: Ejecutar SQL
Ejecuta el contenido de `INSTRUCCIONES_SQL.sql` en tu base de datos MySQL.

### Paso 4: Verificar roles en usuarios
```sql
-- Verificar que los usuarios tienen roles asignados
SELECT id, nombre, nivel FROM usuarios;

-- Actualizar roles si es necesario
UPDATE usuarios SET nivel = 'SA' WHERE id = 1;  -- Ejemplo
UPDATE usuarios SET nivel = 'admin' WHERE id IN (2, 3);
```

## 🔍 Testing

### Test 1: Generar pregunta como SA
```bash
curl -X POST https://tu-servidor/api/generar_preguntas.php \
  -H "Content-Type: application/json" \
  -d '{
    "id_usuario": 1,
    "id_proceso": 100,
    "seccion": "Tema1",
    "tema": "Constitución",
    "num_preguntas": 2
  }'
```

**Respuesta esperada:**
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
