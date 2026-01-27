-- Tabla para almacenar el historial de análisis nutricionales
-- Ejecutar en la base de datos de oposiciones-test.com

CREATE TABLE IF NOT EXISTS historial_nutricional (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    dish_name VARCHAR(255) NOT NULL,
    image_base64 LONGTEXT NULL,
    ingredients JSON NOT NULL,
    totals JSON NOT NULL,
    health_score INT DEFAULT 0,
    recommendations JSON NULL,
    fecha_analisis DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_usuario (id_usuario),
    INDEX idx_fecha (fecha_analisis),
    
    FOREIGN KEY (id_usuario) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Descripción de campos:
-- id: Identificador único del análisis
-- id_usuario: ID del usuario que realizó el análisis
-- dish_name: Nombre del plato analizado
-- image_base64: Imagen del plato en base64 (opcional para ahorrar espacio)
-- ingredients: JSON con el desglose de ingredientes (name, quantity, calories, protein, carbs, sugar, fat, saturatedFat, transFat, fiber, cholesterol, sodium)
-- totals: JSON con los totales nutricionales
-- health_score: Puntuación de salud del 1 al 10
-- recommendations: JSON con las recomendaciones generadas
-- fecha_analisis: Fecha y hora del análisis
