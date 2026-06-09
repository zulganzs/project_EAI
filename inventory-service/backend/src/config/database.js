/**
 * Inventory Database Configuration
 * Reads all connection params from environment variables with sensible defaults.
 */
module.exports = {
  host: process.env.INVENTORY_DB_HOST || 'localhost',
  port: Number(process.env.INVENTORY_DB_PORT) || 3306,
  user: process.env.INVENTORY_DB_USER || 'root',
  password: process.env.INVENTORY_DB_PASSWORD || 'secret',
  database: process.env.INVENTORY_DB_NAME || 'inventory_db',
};
