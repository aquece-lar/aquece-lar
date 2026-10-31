CREATE TABLE IF NOT EXISTS sellers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL,
  phone      VARCHAR(30)  NOT NULL DEFAULT '',
  region     VARCHAR(80)  NOT NULL DEFAULT '',
  status     ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  kind       ENUM('PF','PJ') NOT NULL,
  document   VARCHAR(30)  NOT NULL DEFAULT '',
  phone      VARCHAR(30)  NOT NULL DEFAULT '',
  city       VARCHAR(80)  NOT NULL DEFAULT '',
  seller_id  BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_seller FOREIGN KEY (seller_id) REFERENCES sellers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(40)  NOT NULL,
  description    VARCHAR(200) NOT NULL,
  category       ENUM('Aquecedores a gás','Boilers','Lareiras','Piscina','Acessórios','Serviços') NOT NULL,
  unit_price     DECIMAL(12,2) NOT NULL,
  status         ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inactivated_at DATETIME NULL,
  UNIQUE KEY uq_products_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- customer_info / seller_info são a cópia dos dados no momento do orçamento.
CREATE TABLE IF NOT EXISTS quotes (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number         INT UNSIGNED NOT NULL,
  customer_id    BIGINT UNSIGNED NULL,
  seller_id      BIGINT UNSIGNED NULL,
  customer_name  VARCHAR(160) NOT NULL,
  seller_name    VARCHAR(120) NOT NULL,
  customer_info  JSON NOT NULL,
  seller_info    JSON NOT NULL,
  valid_until    DATE NOT NULL,
  payment_terms  VARCHAR(200) NOT NULL DEFAULT '',
  discount_type  ENUM('percent','amount') NULL,
  discount_value DECIMAL(12,2) NULL,
  notes          TEXT NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  status         ENUM('Pendente','Enviado','Aprovado','Cancelado') NOT NULL DEFAULT 'Pendente',
  created_at     DATETIME NOT NULL,
  UNIQUE KEY uq_quotes_number (number),
  KEY idx_quotes_created (created_at),
  KEY idx_quotes_customer (customer_id),
  KEY idx_quotes_seller (seller_id),
  CONSTRAINT fk_quotes_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_quotes_seller FOREIGN KEY (seller_id) REFERENCES sellers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quote_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_id    BIGINT UNSIGNED NOT NULL,
  position    SMALLINT UNSIGNED NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  description VARCHAR(200) NOT NULL,
  quantity    INT UNSIGNED NOT NULL,
  unit_price  DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_items_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quote_events (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_id BIGINT UNSIGNED NOT NULL,
  status   ENUM('Pendente','Enviado','Aprovado','Cancelado') NOT NULL,
  at       DATETIME NOT NULL,
  note     VARCHAR(200) NOT NULL,
  CONSTRAINT fk_events_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
