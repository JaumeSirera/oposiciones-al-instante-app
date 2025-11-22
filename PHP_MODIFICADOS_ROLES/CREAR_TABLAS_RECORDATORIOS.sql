-- Tabla para almacenar los recordatorios de planes de estudio
CREATE TABLE IF NOT EXISTS `recordatorios_plan` (
  `id_recordatorio` INT AUTO_INCREMENT PRIMARY KEY,
  `id_plan` INT NOT NULL,
  `id_usuario` INT NOT NULL,
  `fecha` DATE NOT NULL,
  `temas` JSON NOT NULL,
  `enviado` TINYINT(1) DEFAULT 0,
  `fecha_envio` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_fecha` (`fecha`),
  INDEX `idx_plan` (`id_plan`),
  INDEX `idx_usuario` (`id_usuario`),
  INDEX `idx_enviado` (`enviado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para configuración de notificaciones de usuario
CREATE TABLE IF NOT EXISTS `config_notificaciones_plan` (
  `id_config` INT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario` INT NOT NULL UNIQUE,
  `email_activo` TINYINT(1) DEFAULT 1,
  `hora_envio` TIME DEFAULT '08:00:00',
  `dias_anticipacion` INT DEFAULT 0,
  `activo` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración por defecto para todos los usuarios existentes
INSERT IGNORE INTO config_notificaciones_plan (id_usuario, email_activo, hora_envio)
SELECT id_usuario, 1, '08:00:00' 
FROM usuarios;
