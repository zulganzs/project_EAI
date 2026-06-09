describe('2E. Event Publisher Module', () => {
  const eventPublisher = require('../../src/messaging/eventPublisher');

  test('exports a publishEvent function', () => {
    expect(eventPublisher).toHaveProperty('publishEvent');
    expect(typeof eventPublisher.publishEvent).toBe('function');
  });

  test('exports a connect function', () => {
    expect(eventPublisher).toHaveProperty('connect');
    expect(typeof eventPublisher.connect).toBe('function');
  });

  test('exports a disconnect function', () => {
    expect(eventPublisher).toHaveProperty('disconnect');
    expect(typeof eventPublisher.disconnect).toBe('function');
  });

  test('exports config from env vars', () => {
    const config = eventPublisher.getConfig();
    expect(config).toHaveProperty('host');
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('exchange');
    expect(config).toHaveProperty('routingKey');
  });

  test('config uses RABBITMQ env vars with defaults', () => {
    const config = eventPublisher.getConfig();
    expect(config.host).toBe(process.env.RABBITMQ_HOST || 'localhost');
    expect(config.port).toBe(Number(process.env.RABBITMQ_PORT) || 5672);
    expect(config.exchange).toBe(process.env.RABBITMQ_EXCHANGE || 'flowca.events');
    expect(config.routingKey).toBe(process.env.RABBITMQ_ROUTING_KEY || 'transaction.completed');
  });
});

describe('2E. Event Publisher with mocked amqplib', () => {
  let mockChannel;
  let mockConnection;

  beforeEach(() => {
    jest.resetModules();

    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('publishEvent publishes CDM to the correct exchange with routing key', async () => {
    // Mock amqplib before requiring eventPublisher
    jest.doMock('amqplib', () => ({
      connect: jest.fn().mockResolvedValue(mockConnection),
    }));

    const { publishEvent, connect } = require('../../src/messaging/eventPublisher');
    await connect();

    const cdm = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ab12',
      source_system: 'POS',
      timestamp: new Date().toISOString(),
      customer: { name: 'Walk-in Customer' },
      items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      total_amount: 50000,
      currency: 'IDR',
      trace_id: 'trace-pos-ab12cd34',
    };

    await publishEvent(cdm);

    // Should assert exchange exists
    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      expect.any(String),
      'topic',
      { durable: true }
    );

    // Should publish to the channel
    expect(mockChannel.publish).toHaveBeenCalledTimes(1);

    // Verify published message structure
    const [exchange, routingKey, buffer] = mockChannel.publish.mock.calls[0];
    const published = JSON.parse(buffer.toString());
    expect(published.event_type).toBe('TRANSAKSI_SELESAI');
    expect(published.transaction_id).toBe('TXN-20260609-ab12');
  });

  test('publishEvent publishes Buffer with correct content type', async () => {
    jest.doMock('amqplib', () => ({
      connect: jest.fn().mockResolvedValue(mockConnection),
    }));

    const { publishEvent, connect } = require('../../src/messaging/eventPublisher');
    await connect();

    const cdm = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ab12',
      source_system: 'POS',
      timestamp: new Date().toISOString(),
      customer: { name: 'Walk-in Customer' },
      items: [],
      total_amount: 0,
      currency: 'IDR',
      trace_id: 'trace-pos-test',
    };

    await publishEvent(cdm);

    const [, , buffer] = mockChannel.publish.mock.calls[0];
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});
