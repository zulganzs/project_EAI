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

describe('5C. CRM API - POST /api/crm/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 201 with reservation on valid request', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'John Doe',
        phone: '081234567890',
        party_size: 4,
        reservation_time: '2026-06-15T19:00:00.000Z',
        table_number: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reservation_id');
    expect(res.body.customer_name).toBe('John Doe');
    expect(res.body.party_size).toBe(4);
    expect(res.body.status).toBe('BOOKED');
  });

  test('returns 400 when customer_name is missing', async () => {
    const res = await request(app)
      .post('/api/crm/reservations')
      .send({ party_size: 4, reservation_time: '2026-06-15T19:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when party_size is missing', async () => {
    const res = await request(app)
      .post('/api/crm/reservations')
      .send({ customer_name: 'John Doe', reservation_time: '2026-06-15T19:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when reservation_time is missing', async () => {
    const res = await request(app)
      .post('/api/crm/reservations')
      .send({ customer_name: 'John Doe', party_size: 4 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('defaults status to BOOKED when not provided', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'Jane Doe',
        party_size: 2,
        reservation_time: '2026-06-15T19:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('BOOKED');
  });

  test('phone and table_number are optional', async () => {
    mockConnection.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'Jane Doe',
        party_size: 2,
        reservation_time: '2026-06-15T19:00:00.000Z',
      });

    expect(res.status).toBe(201);
  });

  test('returns 500 when database fails', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'John Doe',
        party_size: 4,
        reservation_time: '2026-06-15T19:00:00.000Z',
      });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
