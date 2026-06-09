const mysql = require('mysql2/promise');
const dbConfig = require('./database');

let pool = null;

/**
 * Initialize the MySQL connection pool.
 * Call this once at application startup.
 */
function initPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

/**
 * Get a connection from the pool.
 */
async function getConnection() {
  if (!pool) {
    initPool();
  }
  return pool.getConnection();
}

/**
 * Close all connections in the pool.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { initPool, getConnection, closePool };
