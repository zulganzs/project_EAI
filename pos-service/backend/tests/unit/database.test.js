describe('2B. Database config + schema', () => {
  const dbConfig = require('../../src/config/database');

  test('database config reads env vars with defaults', () => {
    // Should export a config object with the right keys
    expect(dbConfig).toHaveProperty('host');
    expect(dbConfig).toHaveProperty('port');
    expect(dbConfig).toHaveProperty('user');
    expect(dbConfig).toHaveProperty('password');
    expect(dbConfig).toHaveProperty('database');
  });

  test('database config defaults are correct', () => {
    expect(dbConfig.host).toBe(process.env.POS_DB_HOST || 'localhost');
    expect(dbConfig.port).toBe(Number(process.env.POS_DB_PORT) || 3306);
    expect(dbConfig.database).toBe(process.env.POS_DB_NAME || 'pos_db');
  });
});

describe('2B. Database pool module', () => {
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

describe('2B. Schema SQL', () => {
  const fs = require('fs');
  const path = require('path');

  test('schema.sql file exists', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  test('schema.sql creates transactions table', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*transactions/i);
  });

  test('schema.sql creates transaction_items table', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*transaction_items/i);
  });

  test('transactions table has required columns', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/transaction_id/);
    expect(sql).toMatch(/customer_name/);
    expect(sql).toMatch(/total_amount/);
    expect(sql).toMatch(/currency/);
    expect(sql).toMatch(/trace_id/);
    expect(sql).toMatch(/created_at/);
  });

  test('transaction_items table has required columns', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/menu_id/);
    expect(sql).toMatch(/menu_name/);
    expect(sql).toMatch(/qty/);
    expect(sql).toMatch(/price/);
  });
});
