-- Tabla de seguimiento por destinatario para envíos de email masivos.
-- Cada fila representa un destinatario de un envío concreto (email_history.id)
-- y guarda su estado (pending / sent / failed), intentos y último error.

CREATE TABLE IF NOT EXISTS email_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_history_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) DEFAULT NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT DEFAULT NULL,
  sent_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_history (email_history_id),
  INDEX idx_status (status),
  INDEX idx_history_status (email_history_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
