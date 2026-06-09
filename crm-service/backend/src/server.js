const dotenv = require('dotenv');
dotenv.config();

const { app } = require('./app');
const pool = require('./config/pool');

const PORT = process.env.CRM_PORT || 3003;

async function start() {
  // Initialize database pool
  pool.initPool();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`🚀 CRM Backend running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down CRM Backend...');
    server.close();
    await pool.closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start CRM Backend:', err);
  process.exit(1);
});
