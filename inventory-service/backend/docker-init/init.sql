-- Inventory Service Database Initialization
-- Auto-executed by MySQL Docker container on first start

SOURCE /docker-entrypoint-initdb.d/schema.sql;
SOURCE /docker-entrypoint-initdb.d/seed.sql;
