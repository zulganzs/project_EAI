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

describe('3B. Ingredient API - GET /api/inventory/ingredients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with list of ingredients', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [
        { id: 1, name: 'Daging Sapi', unit: 'kg', stock_qty: 10, updated_at: '2026-06-09T10:00:00.000Z' },
        { id: 2, name: 'Kentang', unit: 'kg', stock_qty: 5, updated_at: '2026-06-09T10:00:00.000Z' },
      ],
    ]);

    const res = await request(app).get('/api/inventory/ingredients');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('name', 'Daging Sapi');
    expect(res.body[0]).toHaveProperty('stock_qty', 10);
  });

  test('returns 200 with empty array when no ingredients', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/inventory/ingredients');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 500 when database fails', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/inventory/ingredients');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('3B. Ingredient API - POST /api/inventory/ingredients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 201 with created ingredient', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Daging Sapi', unit: 'kg', stock_qty: 10 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('name', 'Daging Sapi');
    expect(res.body).toHaveProperty('unit', 'kg');
    expect(res.body).toHaveProperty('stock_qty', 10);
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ unit: 'kg', stock_qty: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when unit is missing', async () => {
    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Daging Sapi', stock_qty: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('defaults stock_qty to 0 when not provided', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 3 }]);

    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Garam', unit: 'gram' });

    expect(res.status).toBe(201);
    expect(res.body.stock_qty).toBe(0);
  });

  test('returns 500 when database fails', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Daging Sapi', unit: 'kg', stock_qty: 10 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('3B. Ingredient API - PATCH /api/inventory/ingredients/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with updated ingredient', async () => {
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockConnection.query.mockResolvedValueOnce([
      [{ id: 1, name: 'Daging Sapi', unit: 'kg', stock_qty: 20, updated_at: '2026-06-09T10:00:00.000Z' }],
    ]);

    const res = await request(app)
      .patch('/api/inventory/ingredients/1')
      .send({ stock_qty: 20 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stock_qty', 20);
  });

  test('returns 404 when ingredient not found', async () => {
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app)
      .patch('/api/inventory/ingredients/999')
      .send({ stock_qty: 20 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when stock_qty is negative', async () => {
    const res = await request(app)
      .patch('/api/inventory/ingredients/1')
      .send({ stock_qty: -5 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 500 when database fails', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .patch('/api/inventory/ingredients/1')
      .send({ stock_qty: 20 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
