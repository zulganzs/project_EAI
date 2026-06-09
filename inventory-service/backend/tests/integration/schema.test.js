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
  // Create test database and run schema
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

  // Initialize pool pointing to test DB
  process.env.INVENTORY_DB_HOST = DB_CONFIG.host;
  process.env.INVENTORY_DB_PORT = String(DB_CONFIG.port);
  process.env.INVENTORY_DB_NAME = DB_CONFIG.database;
  process.env.INVENTORY_DB_USER = DB_CONFIG.user;
  process.env.INVENTORY_DB_PASSWORD = DB_CONFIG.password;
  initPool();
});

afterAll(async () => {
  await closePool();
  if (db) {
    await db.end();
  }
});

beforeEach(async () => {
  // Clean tables before each test
  await db.execute('DELETE FROM stock_movements');
  await db.execute('DELETE FROM recipe_items');
  await db.execute('DELETE FROM recipes');
  await db.execute('DELETE FROM ingredients');
});

describe('3B Integration. Schema validation against real DB', () => {
  test('ingredients table accepts valid INSERT', async () => {
    await db.execute(
      "INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Daging Sapi', 'kg', 10)",
    );
    const [rows] = await db.execute('SELECT * FROM ingredients WHERE name = ?', ['Daging Sapi']);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].stock_qty)).toBe(10);
  });

  test('recipes table accepts valid INSERT with UNIQUE menu_id', async () => {
    await db.execute("INSERT INTO recipes (menu_id, menu_name) VALUES ('M001', 'Steak')");
    const [rows] = await db.execute('SELECT * FROM recipes WHERE menu_id = ?', ['M001']);
    expect(rows).toHaveLength(1);

    // Duplicate should fail
    await expect(
      db.execute("INSERT INTO recipes (menu_id, menu_name) VALUES ('M001', 'Steak Duplicate')"),
    ).rejects.toThrow();
  });

  test('recipe_items FK constraints work', async () => {
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Test Ing', 'g', 5)");
    await db.execute("INSERT INTO recipes (menu_id, menu_name) VALUES ('M099', 'Test Menu')");
    const [[ing]] = await db.execute('SELECT id FROM ingredients WHERE name = ?', ['Test Ing']);
    const [[rec]] = await db.execute('SELECT id FROM recipes WHERE menu_id = ?', ['M099']);

    await db.execute(
      'INSERT INTO recipe_items (recipe_id, ingredient_id, qty_per_menu) VALUES (?, ?, ?)',
      [rec.id, ing.id, 1.5],
    );

    const [items] = await db.execute('SELECT * FROM recipe_items WHERE recipe_id = ?', [rec.id]);
    expect(items).toHaveLength(1);
    expect(Number(items[0].qty_per_menu)).toBe(1.5);
  });

  test('stock_movements records can be inserted', async () => {
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Garam', 'g', 100)");
    const [[ing]] = await db.execute('SELECT id FROM ingredients WHERE name = ?', ['Garam']);

    await db.execute(
      'INSERT INTO stock_movements (ingredient_id, change_qty, reason, transaction_id) VALUES (?, ?, ?, ?)',
      [ing.id, -5, 'TRANSAKSI_SELESAI: TXN-test', 'TXN-test'],
    );

    const [movements] = await db.execute('SELECT * FROM stock_movements');
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].change_qty)).toBe(-5);
  });

  test('stock_qty updates correctly (decrement)', async () => {
    await db.execute("INSERT INTO ingredients (name, unit, stock_qty) VALUES ('Merica', 'g', 20)");
    await db.execute('UPDATE ingredients SET stock_qty = stock_qty - ? WHERE name = ?', [5, 'Merica']);
    const [[row]] = await db.execute('SELECT stock_qty FROM ingredients WHERE name = ?', ['Merica']);
    expect(Number(row.stock_qty)).toBe(15);
  });

  test('seed.sql executes without error', async () => {
    const seed = fs.readFileSync(path.join(__dirname, '../../src/seed/seed.sql'), 'utf8');
    const statements = seed.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.query(stmt);
    }

    const [ings] = await db.execute('SELECT COUNT(*) as cnt FROM ingredients');
    expect(ings[0].cnt).toBeGreaterThanOrEqual(5);

    const [recs] = await db.execute('SELECT COUNT(*) as cnt FROM recipes');
    expect(recs[0].cnt).toBeGreaterThanOrEqual(2);
  });
});
