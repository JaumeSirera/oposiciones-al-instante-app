-- SQL para ampliar la tabla procesos con campos para sistema de roles

-- Añadir campo id_usuario (usuario que creó el proceso)
ALTER TABLE procesos 
ADD COLUMN id_usuario INT(11) UNSIGNED NULL AFTER descripcion,
ADD INDEX idx_id_usuario (id_usuario);

-- Añadir campo es_publico (1 = público, 0 = privado)
ALTER TABLE procesos 
ADD COLUMN es_publico TINYINT(1) DEFAULT 0 AFTER id_usuario,
ADD INDEX idx_es_publico (es_publico);

-- Índice compuesto para optimizar consultas de filtrado por rol
CREATE INDEX idx_procesos_visibilidad ON procesos(es_publico, id_usuario, estado);

-- Opcional: Actualizar procesos existentes para que sean públicos
-- (solo ejecutar si quieres que los procesos actuales sean visibles por todos)
UPDATE procesos SET es_publico = 1 WHERE id_usuario IS NULL;

-- Verificar la estructura actualizada
DESCRIBE procesos;
