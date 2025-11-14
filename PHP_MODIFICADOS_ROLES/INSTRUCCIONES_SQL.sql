-- ==================================================================
-- INSTRUCCIONES SQL PARA IMPLEMENTAR SISTEMA DE ROLES
-- ==================================================================
-- 
-- Este archivo contiene las instrucciones SQL necesarias para:
-- 1. Agregar la columna es_publico a la tabla preguntas
-- 2. Crear índices para mejorar el rendimiento de las consultas
-- 3. Ejemplos de consultas para filtrar preguntas según roles
--
-- IMPORTANTE: Ejecuta estas instrucciones en tu base de datos MySQL
-- ==================================================================

-- ------------------------------------------------------------------
-- PASO 1: Agregar columna es_publico a tabla preguntas
-- ------------------------------------------------------------------
-- Esta columna determina si una pregunta es visible para todos (1) o solo para su creador (0)
-- Por defecto, las preguntas son privadas (0)

ALTER TABLE preguntas ADD COLUMN es_publico TINYINT DEFAULT 0;

-- ------------------------------------------------------------------
-- PASO 2: Crear índice para mejorar rendimiento
-- ------------------------------------------------------------------
-- Este índice mejora las consultas que filtran por es_publico, id_usuario y id_proceso

CREATE INDEX idx_preguntas_visibilidad ON preguntas(es_publico, id_usuario, id_proceso);

-- ------------------------------------------------------------------
-- PASO 3: Actualizar preguntas existentes (OPCIONAL)
-- ------------------------------------------------------------------
-- Si tienes usuarios SA que ya han creado preguntas, puedes marcarlas como públicas
-- SUSTITUYE 'SA' por el valor exacto del campo nivel de tus usuarios SA

UPDATE preguntas p
INNER JOIN usuarios u ON p.id_usuario = u.id
SET p.es_publico = 1
WHERE LOWER(TRIM(u.nivel)) = 'sa';

-- Verificar las actualizaciones
SELECT COUNT(*) as total_publicas FROM preguntas WHERE es_publico = 1;
SELECT COUNT(*) as total_privadas FROM preguntas WHERE es_publico = 0;

-- ------------------------------------------------------------------
-- PASO 4: Consultas de ejemplo según roles
-- ------------------------------------------------------------------

-- A) Consulta para usuarios SA (superadmin)
--    Ven TODAS las preguntas (públicas y privadas)
--    Parámetros: @id_proceso, @secciones, @temas
SELECT p.*, r.*
FROM preguntas p
LEFT JOIN respuestas r ON p.id = r.id_pregunta
WHERE p.id_proceso = @id_proceso
  AND p.seccion IN (@secciones)
  AND p.tema IN (@temas)
ORDER BY RAND()
LIMIT @num_preguntas;

-- B) Consulta para usuarios admin
--    Ven: preguntas públicas (es_publico=1) + sus propias preguntas (es_publico=0)
--    Parámetros: @id_usuario, @id_proceso, @secciones, @temas
SELECT p.*, r.*
FROM preguntas p
LEFT JOIN respuestas r ON p.id = r.id_pregunta
WHERE p.id_proceso = @id_proceso
  AND p.seccion IN (@secciones)
  AND p.tema IN (@temas)
  AND (
    p.es_publico = 1  -- Preguntas públicas
    OR p.id_usuario = @id_usuario  -- Sus propias preguntas
  )
ORDER BY RAND()
LIMIT @num_preguntas;

-- C) Consulta para usuarios normales (user)
--    Solo ven preguntas públicas (es_publico=1)
--    Parámetros: @id_proceso, @secciones, @temas
SELECT p.*, r.*
FROM preguntas p
LEFT JOIN respuestas r ON p.id = r.id_pregunta
WHERE p.id_proceso = @id_proceso
  AND p.seccion IN (@secciones)
  AND p.tema IN (@temas)
  AND p.es_publico = 1  -- Solo preguntas públicas
ORDER BY RAND()
LIMIT @num_preguntas;

-- ------------------------------------------------------------------
-- PASO 5: Consultas de verificación y debugging
-- ------------------------------------------------------------------

-- Ver distribución de preguntas por visibilidad
SELECT 
  es_publico,
  COUNT(*) as total,
  CONCAT(ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM preguntas), 2), '%') as porcentaje
FROM preguntas
GROUP BY es_publico;

-- Ver preguntas por usuario y visibilidad
SELECT 
  u.id,
  u.nombre,
  u.nivel as rol,
  COUNT(CASE WHEN p.es_publico = 1 THEN 1 END) as publicas,
  COUNT(CASE WHEN p.es_publico = 0 THEN 1 END) as privadas,
  COUNT(*) as total
FROM usuarios u
LEFT JOIN preguntas p ON u.id = p.id_usuario
GROUP BY u.id, u.nombre, u.nivel
ORDER BY u.nivel, u.nombre;

-- Ver últimas preguntas creadas con su visibilidad
SELECT 
  p.id,
  p.pregunta,
  p.es_publico,
  u.nombre as creador,
  u.nivel as rol_creador,
  p.fecha_creacion
FROM preguntas p
INNER JOIN usuarios u ON p.id_usuario = u.id
ORDER BY p.fecha_creacion DESC
LIMIT 20;

-- ==================================================================
-- FIN DE INSTRUCCIONES SQL
-- ==================================================================
