const amqplib = require('amqplib');

/**
 * RabbitMQ subscriber configuration from environment variables.
 */
const config = {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: Number(process.env.RABBITMQ_PORT) || 5672,
  user: process.env.RABBITMQ_USER || 'guest',
  password: process.env.RABBITMQ_PASSWORD || 'guest',
  exchange: process.env.RABBITMQ_EXCHANGE || 'flowca.events',
  routingKey: process.env.RABBITMQ_ROUTING_KEY || 'transaction.completed',
  queue: process.env.INVENTORY_QUEUE || 'inventory_queue',
};

let connection = null;
let channel = null;

/**
 * Get the current config (useful for testing).
 */
function getConfig() {
  return config;
}

/**
 * Connect to RabbitMQ and create a channel with a durable topic exchange.
 */
async function connect() {
  const url = `amqp://${config.user}:${config.password}@${config.host}:${config.port}`;
  connection = await amqplib.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  return channel;
}

/**
 * Subscribe to TRANSAKSI_SELESAI events.
 * Sets up a durable queue bound to the exchange and starts consuming messages.
 *
 * @param {Function} handler - Async function called with the parsed CDM payload
 */
async function subscribe(handler) {
  if (!channel) {
    await connect();
  }

  // Assert a durable queue for inventory
  const q = await channel.assertQueue(config.queue, { durable: true });

  // Bind queue to exchange with routing key
  await channel.bindQueue(q.queue, config.exchange, config.routingKey);

  // Start consuming messages
  await channel.consume(q.queue, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload);
      channel.ack(msg);
    } catch (err) {
      console.error('[inventory-subscriber] Error processing message:', err.message);
      channel.nack(msg, false, false);
    }
  });
}

/**
 * Gracefully disconnect from RabbitMQ.
 */
async function disconnect() {
  if (connection) {
    await connection.close();
    connection = null;
    channel = null;
  }
}

module.exports = { connect, disconnect, subscribe, getConfig };
