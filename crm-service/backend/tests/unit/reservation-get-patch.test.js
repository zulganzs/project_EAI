const request = require('supertest');
const { app } = require('../../src/app');

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

describe('5C. CRM API - GET /api/crm/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with list of reservations', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{
        reservation_id: 'RSV-20260609-ab12',
        customer_name: 'John Doe',
        phone: '081234567890',
        party_size: 4,
        reservation_time: '2026-06-15T19:00:00.000Z',
        table_number: 5,
        status: 'BOOKED',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    ]);

    const res = await request(app).get('/api/crm/reservations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reservation_id).toBe('RSV-20260609-ab12');
  });

  test('returns empty array when no reservations', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/crm/reservations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('5C. CRM API - GET /api/crm/reservations/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with reservation for valid ID', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{
        reservation_id: 'RSV-20260609-ab12',
        customer_name: 'John Doe',
        phone: '081234567890',
        party_size: 4,
        reservation_time: '2026-06-15T19:00:00.000Z',
        table_number: 5,
        status: 'BOOKED',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    ]);

    const res = await request(app).get('/api/crm/reservations/RSV-20260609-ab12');
    expect(res.status).toBe(200);
    expect(res.body.reservation_id).toBe('RSV-20260609-ab12');
    expect(res.body.customer_name).toBe('John Doe');
  });

  test('returns 404 for non-existent reservation', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/crm/reservations/RSV-NONEXIST');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('5C. CRM API - PATCH /api/crm/reservations/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 when status updated to CANCELLED', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{ reservation_id: 'RSV-20260609-ab12', status: 'BOOKED' }],
    ]);
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/crm/reservations/RSV-20260609-ab12')
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('returns 200 when status updated to COMPLETED', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{ reservation_id: 'RSV-20260609-ab12', status: 'BOOKED' }],
    ]);
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/crm/reservations/RSV-20260609-ab12')
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  test('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch('/api/crm/reservations/RSV-20260609-ab12')
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when status is missing', async () => {
    const res = await request(app)
      .patch('/api/crm/reservations/RSV-20260609-ab12')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 404 for non-existent reservation', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .patch('/api/crm/reservations/RSV-NONEXIST')
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
