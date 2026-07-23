-- Tabla para almacenar y auditar donaciones realizadas vía Google Play Billing (IAP)
CREATE TABLE IF NOT EXISTS donaciones_iap (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  purchase_token VARCHAR(512) NOT NULL,
  order_id VARCHAR(255) DEFAULT NULL,
  amount_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'EUR',
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  estado ENUM('pending','validated','consumed','refunded','failed') NOT NULL DEFAULT 'pending',
  google_response TEXT,
  fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_validacion DATETIME DEFAULT NULL,
  UNIQUE KEY uq_purchase_token (purchase_token),
  KEY idx_usuario (id_usuario),
  KEY idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
