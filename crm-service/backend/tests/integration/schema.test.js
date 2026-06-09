const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.CRM_DB_HOST || '127.0.0.1',
  port: Number(process.env.CRM_DB_PORT) || 3307,
  user: process.env.CRM_DB_USER || 'root',
  password: process.env.CRM_DB_PASSWORD || 'secret',
  database: process.env.CRM_DB_NAME || 'crm_test_db',
};

describe('5C. CRM Integration - Schema Validation', () => {
  let connection;

  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.changeUser({ database: dbConfig.database });
    const schema = fs.readFileSync(path.join(__dirname, '../../src/config/schema.sql'), 'utf8');
    await connection.query(schema);
    // Clean table before schema tests
    await connection.query('TRUNCATE TABLE reservations');
  });

  afterAll(async () => {
    if (connection) await connection.end();
  });

  test('reservations table exists after schema execution', async () => {
    const [rows] = await connection.query("SHOW TABLES LIKE 'reservations'");
    expect(rows.length).toBe(1);
  });

  test('reservations table has correct columns', async () => {
    const [columns] = await connection.query("DESCRIBE reservations");
    const columnNames = columns.map((c) => c.Field);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('reservation_id');
    expect(columnNames).toContain('customer_name');
    expect(columnNames).toContain('phone');
    expect(columnNames).toContain('party_size');
    expect(columnNames).toContain('reservation_time');
    expect(columnNames).toContain('table_number');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('created_at');
  });

  test('reservation_id has UNIQUE constraint', async () => {
    const [columns] = await connection.query("SHOW COLUMNS FROM reservations WHERE Field = 'reservation_id'");
    expect(columns[0].Key).toBe('UNI');
  });

  test('INSERT and SELECT round-trip works', async () => {
    const rsvId = 'RSV-TEST-0001';
    await connection.query(
      `INSERT INTO reservations (reservation_id, customer_name, phone, party_size, reservation_time, table_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rsvId, 'Test Customer', '081234567890', 4, '2026-06-15 19:00:00', 5, 'BOOKED']
    );

    const [rows] = await connection.query(
      'SELECT * FROM reservations WHERE reservation_id = ?',
      [rsvId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].customer_name).toBe('Test Customer');
    expect(rows[0].party_size).toBe(4);
    expect(rows[0].status).toBe('BOOKED');
  });

  test('duplicate reservation_id is rejected', async () => {
    await expect(
      connection.query(
        `INSERT INTO reservations (reservation_id, customer_name, party_size, reservation_time, status)
         VALUES (?, ?, ?, ?, ?)`,
        ['RSV-TEST-0001', 'Duplicate', 2, '2026-06-15 19:00:00', 'BOOKED']
      )
    ).rejects.toThrow();
  });

  test('status column accepts valid enum values', async () => {
    for (const status of ['BOOKED', 'CANCELLED', 'COMPLETED']) {
      const rsvId = `RSV-TEST-${status}`;
      await connection.query(
        `INSERT INTO reservations (reservation_id, customer_name, party_size, reservation_time, status)
         VALUES (?, ?, ?, ?, ?)`,
        [rsvId, 'Enum Test', 2, '2026-06-16 19:00:00', status]
      );
      const [rows] = await connection.query(
        'SELECT status FROM reservations WHERE reservation_id = ?',
        [rsvId]
      );
      expect(rows[0].status).toBe(status);
    }
  });

  test('status update works (PATCH simulation)', async () => {
    await connection.query(
      "UPDATE reservations SET status = 'CANCELLED' WHERE reservation_id = 'RSV-TEST-BOOKED'"
    );
    const [rows] = await connection.query(
      "SELECT status FROM reservations WHERE reservation_id = 'RSV-TEST-BOOKED'"
    );
    expect(rows[0].status).toBe('CANCELLED');
  });
});
