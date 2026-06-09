const request = require('supertest');
const { app } = require('../../src/app');

// Mock the pool module so we don't need a real MySQL connection
jest.mock('../../src/config/pool', () => {
  const mockConnection = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    initPool: jest.fn(),
    closePool: jest.fn(),
    __mockConnection: mockConnection,
  };
});

const pool = require('../../src/config/pool');
const mockConnection = pool.__mockConnection;

describe('2D. API Endpoints - POST /api/pos/transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 201 with transaction_id on valid request', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'John Doe',
        items: [
          { menu_id: 'M001', menu_name: 'Steak', qty: 2, price: 50000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('transaction_id');
    expect(res.body.transaction_id).toMatch(/^TXN-\d{8}-[a-z0-9]{4}$/);
    expect(res.body).toHaveProperty('trace_id');
    expect(res.body).toHaveProperty('total_amount');
    expect(res.body.items).toHaveLength(1);
  });

  test('returns 400 when items array is missing', async () => {
    const res = await request(app)
      .post('/api/pos/transactions')
      .send({ customer_name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when items array is empty', async () => {
    const res = await request(app)
      .post('/api/pos/transactions')
      .send({ customer_name: 'Test', items: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when item is missing required fields', async () => {
    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'Test',
        items: [{ menu_id: 'M001' }],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('calculates total_amount correctly', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'Jane',
        items: [
          { menu_id: 'M001', menu_name: 'Steak', qty: 2, price: 50000 },
          { menu_id: 'M002', menu_name: 'Juice', qty: 1, price: 15000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.total_amount).toBe(115000);
  });

  test('calculates subtotal per item correctly', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'Jane',
        items: [
          { menu_id: 'M001', menu_name: 'Steak', qty: 3, price: 50000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.items[0].subtotal).toBe(150000);
  });

  test('defaults customer_name to "Walk-in Customer"', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.customer_name).toBe('Walk-in Customer');
  });

  test('uses default currency IDR', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.currency).toBe('IDR');
  });

  test('generates a trace_id in the response', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.trace_id).toMatch(/^trace-pos-/);
  });

  test('returns 500 when database fails', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('2D. API Endpoints - GET /api/pos/transactions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with transaction for valid ID', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{
        transaction_id: 'TXN-20260609-ab12',
        customer_name: 'Walk-in Customer',
        total_amount: 50000,
        currency: 'IDR',
        trace_id: 'trace-pos-ab12cd34',
        created_at: '2026-06-09T10:30:00.000Z',
      }],
    ]);
    mockConnection.query.mockResolvedValueOnce([
      [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000, subtotal: 50000 }],
    ]);

    const res = await request(app).get('/api/pos/transactions/TXN-20260609-ab12');
    expect(res.status).toBe(200);
    expect(res.body.transaction_id).toBe('TXN-20260609-ab12');
    expect(res.body.items).toHaveLength(1);
  });

  test('returns 404 for non-existent transaction', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/pos/transactions/TXN-NONEXIST');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
