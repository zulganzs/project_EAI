describe('3B. Database config + schema', () => {
  const dbConfig = require('../../src/config/database');

  test('database config reads env vars with defaults', () => {
    expect(dbConfig).toHaveProperty('host');
    expect(dbConfig).toHaveProperty('port');
    expect(dbConfig).toHaveProperty('user');
    expect(dbConfig).toHaveProperty('password');
    expect(dbConfig).toHaveProperty('database');
  });

  test('database config defaults are correct', () => {
    expect(dbConfig.host).toBe(process.env.INVENTORY_DB_HOST || 'localhost');
    expect(dbConfig.port).toBe(Number(process.env.INVENTORY_DB_PORT) || 3306);
    expect(dbConfig.database).toBe(process.env.INVENTORY_DB_NAME || 'inventory_db');
  });
});

describe('3B. Database pool module', () => {
  test('pool module exports a getConnection function', () => {
    const pool = require('../../src/config/pool');
    expect(pool).toHaveProperty('getConnection');
    expect(typeof pool.getConnection).toBe('function');
  });

  test('pool module exports an initPool function', () => {
    const pool = require('../../src/config/pool');
    expect(pool).toHaveProperty('initPool');
    expect(typeof pool.initPool).toBe('function');
  });

  test('pool module exports a closePool function', () => {
    const pool = require('../../src/config/pool');
    expect(pool).toHaveProperty('closePool');
    expect(typeof pool.closePool).toBe('function');
  });
});

describe('3B. Schema SQL', () => {
  const fs = require('fs');
  const path = require('path');

  let sql;
  beforeAll(() => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    sql = fs.readFileSync(schemaPath, 'utf8');
  });

  test('schema.sql file exists', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  test('schema.sql creates ingredients table', () => {
    expect(sql).toMatch(/CREATE TABLE.*ingredients/i);
  });

  test('schema.sql creates recipes table', () => {
    expect(sql).toMatch(/CREATE TABLE.*recipes/i);
  });

  test('schema.sql creates recipe_items table', () => {
    expect(sql).toMatch(/CREATE TABLE.*recipe_items/i);
  });

  test('schema.sql creates stock_movements table', () => {
    expect(sql).toMatch(/CREATE TABLE.*stock_movements/i);
  });

  test('ingredients table has required columns', () => {
    expect(sql).toMatch(/name/);
    expect(sql).toMatch(/unit/);
    expect(sql).toMatch(/stock_qty/);
    expect(sql).toMatch(/updated_at/);
  });

  test('recipe_items has qty_per_menu column', () => {
    expect(sql).toMatch(/qty_per_menu/);
  });

  test('stock_movements has transaction_id and reason columns', () => {
    expect(sql).toMatch(/transaction_id/);
    expect(sql).toMatch(/reason/);
  });
});
