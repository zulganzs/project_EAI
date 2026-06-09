const amqplib = require('amqplib');

/**
 * RabbitMQ configuration from environment variables.
 */
const config = {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: Number(process.env.RABBITMQ_PORT) || 5672,
  user: process.env.RABBITMQ_USER || 'guest',
  password: process.env.RABBITMQ_PASSWORD || 'guest',
  exchange: process.env.RABBITMQ_EXCHANGE || 'flowca.events',
  routingKey: process.env.RABBITMQ_ROUTING_KEY || 'transaction.completed',
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
 * Publish a CDM event to the configured exchange with the routing key.
 * @param {Object} cdmPayload - The Canonical Data Model payload
 */
async function publishEvent(cdmPayload) {
  if (!channel) {
    await connect();
  }

  const buffer = Buffer.from(JSON.stringify(cdmPayload));
  const published = channel.publish(
    config.exchange,
    config.routingKey,
    buffer,
    { contentType: 'application/json', persistent: true }
  );

  if (!published) {
    throw new Error('Failed to publish event — channel buffer full');
  }

  return published;
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

module.exports = { connect, disconnect, publishEvent, getConfig };
