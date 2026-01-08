-- =====================================================
-- TABLAS PARA SISTEMA DE REPETICIÓN ESPACIADA (SM-2)
-- =====================================================
-- Ejecutar en tu base de datos MySQL de oposiciones-test.com

-- Tabla de flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    id_proceso INT DEFAULT NULL,
    front TEXT NOT NULL COMMENT 'Pregunta o frente de la tarjeta',
    back TEXT NOT NULL COMMENT 'Respuesta o reverso de la tarjeta',
    category VARCHAR(255) DEFAULT NULL COMMENT 'Categoría/tema de la tarjeta',
    tags VARCHAR(500) DEFAULT NULL COMMENT 'Etiquetas separadas por comas',
    source_type ENUM('manual', 'pregunta_fallada', 'importada') DEFAULT 'manual',
    source_id INT DEFAULT NULL COMMENT 'ID de la pregunta original si viene de un test',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_proceso (id_proceso),
    INDEX idx_category (category),
    INDEX idx_source (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de progreso de flashcards (algoritmo SM-2)
CREATE TABLE IF NOT EXISTS flashcard_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    flashcard_id INT NOT NULL,
    ease_factor DECIMAL(4,2) DEFAULT 2.50 COMMENT 'Factor de facilidad (mínimo 1.30)',
    interval_days INT DEFAULT 0 COMMENT 'Intervalo actual en días',
    repetitions INT DEFAULT 0 COMMENT 'Número de repeticiones correctas consecutivas',
    next_review DATE DEFAULT NULL COMMENT 'Fecha de próxima revisión',
    last_review TIMESTAMP NULL COMMENT 'Última vez que se revisó',
    total_reviews INT DEFAULT 0 COMMENT 'Total de veces revisada',
    correct_reviews INT DEFAULT 0 COMMENT 'Veces respondida correctamente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_flashcard (user_id, flashcard_id),
    INDEX idx_next_review (user_id, next_review),
    INDEX idx_flashcard (flashcard_id),
    FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vista para obtener flashcards pendientes de revisión
CREATE OR REPLACE VIEW v_flashcards_pendientes AS
SELECT 
    f.id,
    f.user_id,
    f.id_proceso,
    f.front,
    f.back,
    f.category,
    f.tags,
    f.source_type,
    COALESCE(fp.ease_factor, 2.50) as ease_factor,
    COALESCE(fp.interval_days, 0) as interval_days,
    COALESCE(fp.repetitions, 0) as repetitions,
    fp.next_review,
    fp.last_review,
    COALESCE(fp.total_reviews, 0) as total_reviews,
    COALESCE(fp.correct_reviews, 0) as correct_reviews,
    CASE 
        WHEN fp.next_review IS NULL THEN 1
        WHEN fp.next_review <= CURDATE() THEN 1
        ELSE 0
    END as needs_review
FROM flashcards f
LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND f.user_id = fp.user_id;
