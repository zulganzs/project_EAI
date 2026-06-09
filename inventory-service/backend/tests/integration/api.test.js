const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app } = require('../../src/app');
const { initPool, closePool } = require('../../src/config/pool');

const DB_CONFIG = {
  host: process.env.INVENTORY_DB_HOST || '127.0.0.1',
  port: Number(process.env.INVENTORY_DB_PORT) || 3307,
  user: process.env.INVENTORY_DB_USER || 'root',
  password: process.env.INVENTORY_DB_PASSWORD || 'secret',
  database: process.env.INVENTORY_DB_NAME || 'inventory_test_db',
};

let db;

beforeAll(async () => {
  const adminConn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });

  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\``);
  await adminConn.end();

  db = await mysql.createConnection(DB_CONFIG);
  const schema = fs.readFileSync(path.join(__dirname, '../../src/config/schema.sql'), 'utf8');
  const statements = schema.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }

  process.env.INVENTORY_DB_HOST = DB_CONFIG.host;
  process.env.INVENTORY_DB_PORT = String(DB_CONFIG.port);
  process.env.INVENTORY_DB_NAME = DB_CONFIG.database;
  process.env.INVENTORY_DB_USER = DB_CONFIG.user;
  process.env.INVENTORY_DB_PASSWORD = DB_CONFIG.password;
  initPool();
});

afterAll(async () => {
  await closePool();
  if (db) await db.end();
});

beforeEach(async () => {
  await db.execute('DELETE FROM stock_movements');
  await db.execute('DELETE FROM recipe_items');
  await db.execute('DELETE FROM recipes');
  await db.execute('DELETE FROM ingredients');
});

describe('3B Integration. Ingredient API against real DB', () => {
  test('POST /api/inventory/ingredients persists to DB', async () => {
    const res = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Daging Sapi', unit: 'kg', stock_qty: 10 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const [rows] = await db.execute('SELECT * FROM ingredients WHERE id = ?', [res.body.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Daging Sapi');
    expect(Number(rows[0].stock_qty)).toBe(10);
  });

  test('GET /api/inventory/ingredients retrieves from DB', async () => {
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Kentang', 'kg', 5)");
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Beras', 'kg', 20)");

    const res = await request(app).get('/api/inventory/ingredients');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('PATCH /api/inventory/ingredients/:id updates stock in DB', async () => {
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Telur', 'butir', 50)");
    const [[row]] = await db.execute('SELECT id FROM ingredients WHERE name = ?', ['Telur']);

    const res = await request(app)
      .patch(`/api/inventory/ingredients/${row.id}`)
      .send({ stock_qty: 45 });

    expect(res.status).toBe(200);
    expect(Number(res.body.stock_qty)).toBe(45);

    const [[updated]] = await db.execute('SELECT stock_qty FROM ingredients WHERE id = ?', [row.id]);
    expect(Number(updated.stock_qty)).toBe(45);
  });

  test('POST → GET round-trip consistency', async () => {
    const postRes = await request(app)
      .post('/api/inventory/ingredients')
      .send({ name: 'Garam', unit: 'gram', stock_qty: 100 });

    expect(postRes.status).toBe(201);

    const getRes = await request(app).get('/api/inventory/ingredients');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].name).toBe('Garam');
    expect(Number(getRes.body[0].stock_qty)).toBe(100);
  });

  test('GET returns 404 for non-existent ingredient on PATCH', async () => {
    const res = await request(app)
      .patch('/api/inventory/ingredients/99999')
      .send({ stock_qty: 10 });

    expect(res.status).toBe(404);
  });

  test('pool lifecycle (init + close) does not throw', async () => {
    // Pool is already initialized; just verify closePool works
    await expect(closePool()).resolves.not.toThrow();
    // Re-init for remaining tests
    initPool();
  });
});
