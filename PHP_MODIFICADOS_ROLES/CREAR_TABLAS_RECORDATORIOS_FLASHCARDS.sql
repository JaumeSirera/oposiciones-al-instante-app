-- =====================================================
-- TABLAS PARA RECORDATORIOS DE FLASHCARDS
-- Ejecutar este script en phpMyAdmin o consola MySQL
-- =====================================================

-- Tabla de configuración de recordatorios por usuario
CREATE TABLE IF NOT EXISTS recordatorios_flashcards_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    activo TINYINT(1) DEFAULT 1,
    frecuencia ENUM('diario', 'semanal') DEFAULT 'diario',
    hora_envio TIME DEFAULT '09:00:00',
    dias_semana VARCHAR(20) DEFAULT '1,2,3,4,5', -- 1=Lunes, 7=Domingo
    min_pendientes INT DEFAULT 5, -- Mínimo de flashcards pendientes para enviar
    ultimo_envio DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_usuario (id_usuario),
    INDEX idx_activo_hora (activo, hora_envio),
    FOREIGN KEY (id_usuario) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de historial de recordatorios enviados
CREATE TABLE IF NOT EXISTS recordatorios_flashcards_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_envio DATETIME NOT NULL,
    pending_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuario_fecha (id_usuario, fecha_envio),
    FOREIGN KEY (id_usuario) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comentarios para documentación
COMMENT ON TABLE recordatorios_flashcards_config IS 'Configuración de recordatorios de flashcards por usuario';
COMMENT ON TABLE recordatorios_flashcards_historial IS 'Historial de recordatorios de flashcards enviados';
