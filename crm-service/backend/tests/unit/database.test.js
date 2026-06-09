describe('5C. CRM Database config + schema', () => {
  const dbConfig = require('../../src/config/database');

  test('database config reads env vars with defaults', () => {
    expect(dbConfig).toHaveProperty('host');
    expect(dbConfig).toHaveProperty('port');
    expect(dbConfig).toHaveProperty('user');
    expect(dbConfig).toHaveProperty('password');
    expect(dbConfig).toHaveProperty('database');
  });

  test('database config defaults are correct', () => {
    expect(dbConfig.host).toBe(process.env.CRM_DB_HOST || 'localhost');
    expect(dbConfig.port).toBe(Number(process.env.CRM_DB_PORT) || 3306);
    expect(dbConfig.database).toBe(process.env.CRM_DB_NAME || 'crm_db');
  });
});

describe('5C. CRM Database pool module', () => {
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

describe('5C. CRM Schema SQL', () => {
  const fs = require('fs');
  const path = require('path');

  test('schema.sql file exists', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  test('schema.sql creates reservations table', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*reservations/i);
  });

  test('reservations table has required columns', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/reservation_id/);
    expect(sql).toMatch(/customer_name/);
    expect(sql).toMatch(/phone/);
    expect(sql).toMatch(/party_size/);
    expect(sql).toMatch(/reservation_time/);
    expect(sql).toMatch(/table_number/);
    expect(sql).toMatch(/status/);
    expect(sql).toMatch(/created_at/);
  });

  test('status column has valid enum values', () => {
    const schemaPath = path.join(__dirname, '../../src/config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toMatch(/BOOKED/);
    expect(sql).toMatch(/CANCELLED/);
    expect(sql).toMatch(/COMPLETED/);
  });
});
