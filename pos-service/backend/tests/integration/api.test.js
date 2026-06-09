const request = require('supertest');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { app } = require('../../src/app');
const pool = require('../../src/config/pool');

const TEST_DB_CONFIG = {
  host: process.env.POS_DB_HOST || 'localhost',
  port: Number(process.env.POS_DB_PORT) || 3307,
  user: process.env.POS_DB_USER || 'root',
  password: process.env.POS_DB_PASSWORD || 'secret',
  database: process.env.POS_DB_NAME || 'pos_test_db',
};

let rawConnection;

beforeAll(async () => {
  rawConnection = await mysql.createConnection(TEST_DB_CONFIG);
  process.env.POS_DB_HOST = TEST_DB_CONFIG.host;
  process.env.POS_DB_PORT = String(TEST_DB_CONFIG.port);
  process.env.POS_DB_NAME = TEST_DB_CONFIG.database;
  process.env.POS_DB_USER = TEST_DB_CONFIG.user;
  process.env.POS_DB_PASSWORD = TEST_DB_CONFIG.password;

  const schemaSQL = fs.readFileSync(
    path.join(__dirname, '../../src/config/schema.sql'), 'utf8'
  );
  // Filter out comment-only lines, then split on semicolons
  const sqlLines = schemaSQL.split('\n').filter(line => !line.trim().startsWith('--'));
  const cleanSQL = sqlLines.join('\n');
  const statements = cleanSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await rawConnection.execute(stmt);
  }
});

afterAll(async () => {
  if (rawConnection) {
    await rawConnection.execute('DELETE FROM transaction_items');
    await rawConnection.execute('DELETE FROM transactions');
    await rawConnection.end();
  }
  await pool.closePool();
});

beforeEach(async () => {
  await rawConnection.execute('DELETE FROM transaction_items');
  await rawConnection.execute('DELETE FROM transactions');
});

describe('2D Integration: POST persists to real MySQL', () => {
  test('POST persists transaction header and items', async () => {
    const res = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'Integration Customer',
        items: [
          { menu_id: 'M001', menu_name: 'Steak', qty: 2, price: 50000 },
          { menu_id: 'D001', menu_name: 'Ice Tea', qty: 1, price: 10000 },
        ],
      });

    expect(res.status).toBe(201);
    const txnId = res.body.transaction_id;

    const [txnRows] = await rawConnection.execute(
      'SELECT * FROM transactions WHERE transaction_id = ?', [txnId]
    );
    expect(txnRows.length).toBe(1);
    expect(Number(txnRows[0].total_amount)).toBe(110000);
    expect(txnRows[0].customer_name).toBe('Integration Customer');

    const [itemRows] = await rawConnection.execute(
      'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY menu_id', [txnId]
    );
    expect(itemRows.length).toBe(2);
    expect(Number(itemRows[0].subtotal)).toBe(10000);
    expect(Number(itemRows[1].subtotal)).toBe(100000);
  });
});

describe('2D Integration: GET retrieves from real MySQL', () => {
  test('GET retrieves a directly-inserted transaction', async () => {
    await rawConnection.execute(
      `INSERT INTO transactions (transaction_id, customer_name, total_amount, currency, trace_id)
       VALUES ('TXN-GET-01', 'Direct Insert', 75000, 'IDR', 'trace-get-01')`
    );
    await rawConnection.execute(
      `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, qty, price, subtotal)
       VALUES ('TXN-GET-01', 'M003', 'Burger', 1, 75000, 75000)`
    );

    const res = await request(app).get('/api/pos/transactions/TXN-GET-01');
    expect(res.status).toBe(200);
    expect(res.body.transaction_id).toBe('TXN-GET-01');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].menu_name).toBe('Burger');
  });

  test('GET returns 404 for non-existent transaction', async () => {
    const res = await request(app).get('/api/pos/transactions/TXN-NONEXIST');
    expect(res.status).toBe(404);
  });
});

describe('2D Integration: POST then GET round-trip', () => {
  test('round-trip returns consistent data', async () => {
    const postRes = await request(app)
      .post('/api/pos/transactions')
      .send({
        customer_name: 'Round Trip',
        items: [{ menu_id: 'M002', menu_name: 'Fried Rice', qty: 3, price: 25000 }],
      });

    expect(postRes.status).toBe(201);
    const txnId = postRes.body.transaction_id;

    const getRes = await request(app).get(`/api/pos/transactions/${txnId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.transaction_id).toBe(txnId);
    expect(getRes.body.customer_name).toBe('Round Trip');
    expect(Number(getRes.body.total_amount)).toBe(75000);
    expect(getRes.body.items[0].menu_name).toBe('Fried Rice');
    expect(Number(getRes.body.items[0].qty)).toBe(3);
    expect(Number(getRes.body.items[0].subtotal)).toBe(75000);
  });
});

describe('2B Integration: Pool lifecycle', () => {
  test('getConnection returns a working connection', async () => {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1 AS val');
    expect(rows[0].val).toBe(1);
    conn.release();
  });
});

describe('2C Integration: ID uniqueness under concurrent writes', () => {
  test('100 rapid POSTs produce 100 unique IDs in DB', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      request(app).post('/api/pos/transactions').send({
        customer_name: `Stress ${i}`,
        items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
      })
    );

    const results = await Promise.all(promises);
    const failed = results.filter(r => r.status !== 201);
    expect(failed.length).toBe(0);

    const [rows] = await rawConnection.execute(
      'SELECT COUNT(DISTINCT transaction_id) AS cnt FROM transactions'
    );
    expect(Number(rows[0].cnt)).toBe(100);
  });
});

