-- ============================================================
-- POS Service Database Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL DEFAULT 'Walk-in Customer',
    reservation_id VARCHAR(50) DEFAULT NULL,
    table_number INT DEFAULT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    trace_id VARCHAR(100) NOT NULL,
    event_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_trace_id (trace_id),
    INDEX idx_created_at (created_at),
    INDEX idx_reservation_id (reservation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transaction_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    menu_id VARCHAR(50) NOT NULL,
    menu_name VARCHAR(255) NOT NULL,
    qty INT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    INDEX idx_transaction_id (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
