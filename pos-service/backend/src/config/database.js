/**
 * POS Database Configuration
 * Reads all connection params from environment variables with sensible defaults.
 */
module.exports = {
  host: process.env.POS_DB_HOST || 'localhost',
  port: Number(process.env.POS_DB_PORT) || 3306,
  user: process.env.POS_DB_USER || 'root',
  password: process.env.POS_DB_PASSWORD || 'secret',
  database: process.env.POS_DB_NAME || 'pos_db',
};
