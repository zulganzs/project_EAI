const dotenv = require('dotenv');
dotenv.config();

const { app } = require('./app');
const pool = require('./config/pool');
const eventPublisher = require('./messaging/eventPublisher');

const PORT = process.env.POS_PORT || 3001;

async function start() {
  // Initialize database pool
  pool.initPool();

  // Connect to RabbitMQ
  try {
    await eventPublisher.connect();
    console.log('✅ Connected to RabbitMQ');
  } catch (err) {
    console.warn('⚠️  RabbitMQ not available — events will be published on first use:', err.message);
  }

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`🚀 POS Backend running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down POS Backend...');
    server.close();
    await eventPublisher.disconnect();
    await pool.closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start POS Backend:', err);
  process.exit(1);
});
