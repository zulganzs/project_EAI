describe('3D. RabbitMQ Subscriber Module', () => {
  const subscriber = require('../../src/messaging/subscriber');

  test('exports a subscribe function', () => {
    expect(subscriber).toHaveProperty('subscribe');
    expect(typeof subscriber.subscribe).toBe('function');
  });

  test('exports a connect function', () => {
    expect(subscriber).toHaveProperty('connect');
    expect(typeof subscriber.connect).toBe('function');
  });

  test('exports a disconnect function', () => {
    expect(subscriber).toHaveProperty('disconnect');
    expect(typeof subscriber.disconnect).toBe('function');
  });

  test('exports config from env vars', () => {
    const config = subscriber.getConfig();
    expect(config).toHaveProperty('host');
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('exchange');
    expect(config).toHaveProperty('routingKey');
    expect(config).toHaveProperty('queue');
  });

  test('config uses RABBITMQ env vars with defaults', () => {
    const config = subscriber.getConfig();
    expect(config.host).toBe(process.env.RABBITMQ_HOST || 'localhost');
    expect(config.port).toBe(Number(process.env.RABBITMQ_PORT) || 5672);
    expect(config.exchange).toBe(process.env.RABBITMQ_EXCHANGE || 'flowca.events');
    expect(config.routingKey).toBe(process.env.RABBITMQ_ROUTING_KEY || 'transaction.completed');
    expect(config.queue).toBe(process.env.INVENTORY_QUEUE || 'inventory_queue');
  });
});

describe('3D. RabbitMQ Subscriber with mocked amqplib', () => {
  let mockChannel;
  let mockConnection;

  beforeEach(() => {
    jest.resetModules();

    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'inventory_queue' }),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('subscribe creates queue, binds to exchange, and starts consuming', async () => {
    jest.doMock('amqplib', () => ({
      connect: jest.fn().mockResolvedValue(mockConnection),
    }));

    const { connect, subscribe } = require('../../src/messaging/subscriber');
    await connect();

    const handler = jest.fn();
    await subscribe(handler);

    // Should assert the exchange exists
    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      expect.any(String),
      'topic',
      { durable: true },
    );

    // Should assert the queue exists
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(
      expect.any(String),
      { durable: true },
    );

    // Should bind queue to exchange with routing key
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );

    // Should start consuming
    expect(mockChannel.consume).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
    );
  });

  test('subscriber calls handler with parsed CDM message', async () => {
    jest.doMock('amqplib', () => ({
      connect: jest.fn().mockResolvedValue(mockConnection),
    }));

    const { connect, subscribe } = require('../../src/messaging/subscriber');
    await connect();

    const handler = jest.fn();
    await subscribe(handler);

    // Extract the message callback from consume
    const consumeCallback = mockChannel.consume.mock.calls[0][1];

    // Simulate a message arriving
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ab12',
      items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
    };

    const mockMsg = {
      content: Buffer.from(JSON.stringify(cdmPayload)),
      fields: { routingKey: 'transaction.completed' },
    };

    await consumeCallback(mockMsg);

    // Handler should be called with the parsed CDM payload
    expect(handler).toHaveBeenCalledWith(cdmPayload);
    // Message should be acknowledged
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
  });

  test('subscriber nacks message when handler throws error', async () => {
    jest.doMock('amqplib', () => ({
      connect: jest.fn().mockResolvedValue(mockConnection),
    }));

    const { connect, subscribe } = require('../../src/messaging/subscriber');
    await connect();

    const failingHandler = jest.fn().mockRejectedValue(new Error('Processing failed'));
    await subscribe(failingHandler);

    const consumeCallback = mockChannel.consume.mock.calls[0][1];

    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ab12',
      items: [],
    };

    const mockMsg = {
      content: Buffer.from(JSON.stringify(cdmPayload)),
      fields: { routingKey: 'transaction.completed' },
    };

    await consumeCallback(mockMsg);

    // Message should be nacked (not requeued)
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    // Message should NOT be acked
    expect(mockChannel.ack).not.toHaveBeenCalled();
  });
});
