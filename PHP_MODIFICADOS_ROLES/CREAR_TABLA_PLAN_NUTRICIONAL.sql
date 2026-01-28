-- Tabla para almacenar los planes nutricionales asociados a planes físicos
-- Ejecutar este SQL en la base de datos de oposiciones-test.com

CREATE TABLE IF NOT EXISTS planes_nutricionales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_plan_fisico INT NOT NULL,
    id_usuario INT NOT NULL,
    
    -- Datos del plan nutricional
    objetivo VARCHAR(255) DEFAULT NULL,
    calorias_objetivo INT DEFAULT NULL,
    proteinas_objetivo INT DEFAULT NULL,
    carbos_objetivo INT DEFAULT NULL,
    grasas_objetivo INT DEFAULT NULL,
    
    -- Plan semanal generado por IA (JSON con 7 días, cada día con desayuno, almuerzo, cena, snacks)
    plan_semanal_json LONGTEXT DEFAULT NULL,
    
    -- Recomendaciones generales adaptadas al tipo de entrenamiento
    recomendaciones_json LONGTEXT DEFAULT NULL,
    
    -- Metadatos
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_plan_fisico (id_plan_fisico),
    INDEX idx_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nota: id_plan_fisico hace referencia al campo id de la tabla planes_fisicos
