/**
 * CRM Database Configuration
 * Reads all connection params from environment variables with sensible defaults.
 */
module.exports = {
  host: process.env.CRM_DB_HOST || 'localhost',
  port: Number(process.env.CRM_DB_PORT) || 3306,
  user: process.env.CRM_DB_USER || 'root',
  password: process.env.CRM_DB_PASSWORD || 'secret',
  database: process.env.CRM_DB_NAME || 'crm_db',
};
