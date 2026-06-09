require('dotenv').config();
const { initPool, closePool } = require('./config/pool');
const { app } = require('./app');
const { connect, disconnect, subscribe } = require('./messaging/subscriber');
const { processTransactionEvent } = require('./services/deduction.service');

const PORT = process.env.INVENTORY_PORT || 3002;

async function start() {
  // Initialize DB pool
  initPool();
  console.log('[inventory] DB pool initialized');

  // Connect to RabbitMQ and subscribe
  try {
    await connect();
    console.log('[inventory] Connected to RabbitMQ');

    await subscribe(async (cdmPayload) => {
      console.log(`[inventory] Received ${cdmPayload.event_type} event for ${cdmPayload.transaction_id}`);
      const result = await processTransactionEvent(cdmPayload);
      if (result.success) {
        console.log(`[inventory] Stock deducted: ${result.deductions.length} ingredients updated`);
      } else {
        console.error(`[inventory] Failed to process event: ${result.error}`);
      }
    });

    console.log('[inventory] Subscribed to TRANSAKSI_SELESAI events');
  } catch (err) {
    console.error('[inventory] RabbitMQ connection failed — running without subscriber:', err.message);
  }

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`[inventory] Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[inventory] Shutting down...');
    server.close();
    await disconnect();
    await closePool();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('[inventory] Failed to start:', err);
  process.exit(1);
});
