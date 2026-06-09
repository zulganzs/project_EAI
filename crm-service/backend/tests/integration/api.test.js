const request = require('supertest');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Override pool to use test database
process.env.CRM_DB_HOST = process.env.CRM_DB_HOST || '127.0.0.1';
process.env.CRM_DB_PORT = process.env.CRM_DB_PORT || '3307';
process.env.CRM_DB_NAME = process.env.CRM_DB_NAME || 'crm_test_db';
process.env.CRM_DB_USER = process.env.CRM_DB_USER || 'root';
process.env.CRM_DB_PASSWORD = process.env.CRM_DB_PASSWORD || 'secret';

const { app } = require('../../src/app');
const pool = require('../../src/config/pool');

describe('5C. CRM Integration - API Round-Trip', () => {
  let connection;

  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: process.env.CRM_DB_HOST,
      port: Number(process.env.CRM_DB_PORT),
      user: process.env.CRM_DB_USER,
      password: process.env.CRM_DB_PASSWORD,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.CRM_DB_NAME}`);
    await connection.changeUser({ database: process.env.CRM_DB_NAME });
    const schema = fs.readFileSync(path.join(__dirname, '../../src/config/schema.sql'), 'utf8');
    await connection.query(schema);

    // Initialize the app's pool
    pool.initPool();

    // Clean table before API tests
    const testConn = await pool.getConnection();
    await testConn.query('TRUNCATE TABLE reservations');
    testConn.release();
  });

  afterAll(async () => {
    await pool.closePool();
    if (connection) await connection.end();
  });

  test('POST /api/crm/reservations persists to real DB', async () => {
    const res = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'Integration Test',
        phone: '081299887766',
        party_size: 3,
        reservation_time: '2026-06-20T18:30:00.000Z',
        table_number: 7,
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation_id).toMatch(/^RSV-\d{8}-[a-z0-9]{4}$/);
    expect(res.body.customer_name).toBe('Integration Test');
  });

  test('GET /api/crm/reservations retrieves from real DB', async () => {
    const res = await request(app).get('/api/crm/reservations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST then GET round-trip consistency', async () => {
    const createRes = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'Round Trip Test',
        party_size: 2,
        reservation_time: '2026-06-22T19:00:00.000Z',
      });

    expect(createRes.status).toBe(201);
    const rsvId = createRes.body.reservation_id;

    const getRes = await request(app).get(`/api/crm/reservations/${rsvId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.reservation_id).toBe(rsvId);
    expect(getRes.body.customer_name).toBe('Round Trip Test');
    expect(getRes.body.party_size).toBe(2);
  });

  test('GET /api/crm/reservations/:id returns 404 for non-existent', async () => {
    const res = await request(app).get('/api/crm/reservations/RSV-NONEXIST');
    expect(res.status).toBe(404);
  });

  test('PATCH /api/crm/reservations/:id updates status', async () => {
    const createRes = await request(app)
      .post('/api/crm/reservations')
      .send({
        customer_name: 'Patch Test',
        party_size: 6,
        reservation_time: '2026-06-25T20:00:00.000Z',
      });

    const rsvId = createRes.body.reservation_id;

    const patchRes = await request(app)
      .patch(`/api/crm/reservations/${rsvId}`)
      .send({ status: 'CANCELLED' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('CANCELLED');
  });

  test('pool lifecycle works (init + close)', async () => {
    await pool.closePool();
    pool.initPool();
    const conn = await pool.getConnection();
    expect(conn).toBeDefined();
    conn.release();
  });
});
