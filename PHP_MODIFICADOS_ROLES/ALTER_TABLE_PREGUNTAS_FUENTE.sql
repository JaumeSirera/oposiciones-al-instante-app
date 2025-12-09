-- =====================================================
-- ALTER TABLE preguntas - Añadir columnas de trazabilidad de fuente
-- Ejecutar este script en la base de datos para habilitar
-- la funcionalidad de referencia a documento/página/línea
-- =====================================================

-- Añadir columna para nombre del documento
ALTER TABLE preguntas 
ADD COLUMN documento VARCHAR(255) DEFAULT NULL 
COMMENT 'Nombre del documento PDF/texto del que se extrajo la pregunta';

-- Añadir columna para número de página
ALTER TABLE preguntas 
ADD COLUMN pagina VARCHAR(50) DEFAULT NULL 
COMMENT 'Número de página donde se encuentra la respuesta';

-- Añadir columna para ubicación en el texto
ALTER TABLE preguntas 
ADD COLUMN ubicacion VARCHAR(50) DEFAULT NULL 
COMMENT 'Ubicación aproximada: inicio, medio, final';

-- Añadir columna para cita textual
ALTER TABLE preguntas 
ADD COLUMN cita TEXT DEFAULT NULL 
COMMENT 'Fragmento del texto original de donde se extrajo la pregunta';

-- Índice opcional para búsquedas por documento
CREATE INDEX idx_preguntas_documento ON preguntas(documento);

-- =====================================================
-- Verificar que las columnas se crearon correctamente
-- =====================================================
SHOW COLUMNS FROM preguntas WHERE Field IN ('documento', 'pagina', 'ubicacion', 'cita');
