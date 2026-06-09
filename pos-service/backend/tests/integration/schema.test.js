const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

  const schemaSQL = fs.readFileSync(
    path.join(__dirname, '../../src/config/schema.sql'),
    'utf8'
  );
  // Filter out comment-only lines, then split on semicolons
  const lines = schemaSQL.split('\n');
  const sqlLines = lines.filter(line => !line.trim().startsWith('--'));
  const cleanSQL = sqlLines.join('\n');
  const statements = cleanSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await rawConnection.execute(stmt);
  }
});

afterAll(async () => {
  if (rawConnection) {
    await rawConnection.execute('DROP TABLE IF EXISTS transaction_items');
    await rawConnection.execute('DROP TABLE IF EXISTS transactions');
    await rawConnection.end();
  }
});

describe('2B Integration: Real MySQL Schema', () => {
  test('transactions table exists after schema init', async () => {
    const [rows] = await rawConnection.execute("SHOW TABLES LIKE 'transactions'");
    expect(rows.length).toBe(1);
  });

  test('transaction_items table exists after schema init', async () => {
    const [rows] = await rawConnection.execute("SHOW TABLES LIKE 'transaction_items'");
    expect(rows.length).toBe(1);
  });

  test('transactions table has correct columns with types', async () => {
    const [columns] = await rawConnection.execute('DESCRIBE transactions');
    const colMap = {};
    columns.forEach((c) => { colMap[c.Field] = c; });

    expect(colMap.transaction_id).toBeDefined();
    expect(colMap.transaction_id.Key).toBe('UNI');
    expect(colMap.customer_name).toBeDefined();
    expect(colMap.total_amount).toBeDefined();
    expect(colMap.total_amount.Type).toMatch(/decimal/);
    expect(colMap.currency).toBeDefined();
    expect(colMap.trace_id).toBeDefined();
    expect(colMap.created_at).toBeDefined();
  });

  test('transaction_items table has correct columns with FK', async () => {
    const [columns] = await rawConnection.execute('DESCRIBE transaction_items');
    const colNames = columns.map((c) => c.Field);

    expect(colNames).toContain('transaction_id');
    expect(colNames).toContain('menu_id');
    expect(colNames).toContain('menu_name');
    expect(colNames).toContain('qty');
    expect(colNames).toContain('price');
    expect(colNames).toContain('subtotal');
  });

  test('can INSERT and SELECT a transaction row', async () => {
    await rawConnection.execute(
      `INSERT INTO transactions (transaction_id, customer_name, total_amount, currency, trace_id)
       VALUES ('TXN-SCHEMA-01', 'Schema Test', 50000, 'IDR', 'trace-schema-01')`
    );

    const [rows] = await rawConnection.execute(
      'SELECT * FROM transactions WHERE transaction_id = ?',
      ['TXN-SCHEMA-01']
    );

    expect(rows.length).toBe(1);
    expect(rows[0].customer_name).toBe('Schema Test');
    expect(Number(rows[0].total_amount)).toBe(50000);
  });

  test('can INSERT and SELECT transaction_items with FK', async () => {
    await rawConnection.execute(
      `INSERT INTO transactions (transaction_id, customer_name, total_amount, currency, trace_id)
       VALUES ('TXN-SCHEMA-02', 'Item Test', 25000, 'IDR', 'trace-schema-02')`
    );
    await rawConnection.execute(
      `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, qty, price, subtotal)
       VALUES ('TXN-SCHEMA-02', 'M001', 'Fried Rice', 1, 25000, 25000)`
    );

    const [rows] = await rawConnection.execute(
      'SELECT * FROM transaction_items WHERE transaction_id = ?',
      ['TXN-SCHEMA-02']
    );

    expect(rows.length).toBe(1);
    expect(rows[0].menu_name).toBe('Fried Rice');
    expect(Number(rows[0].subtotal)).toBe(25000);
  });

  test('duplicate transaction_id is rejected by UNIQUE constraint', async () => {
    await rawConnection.execute(
      `INSERT INTO transactions (transaction_id, customer_name, total_amount, currency, trace_id)
       VALUES ('TXN-DUP-01', 'First', 10000, 'IDR', 'trace-dup-01')`
    );

    await expect(
      rawConnection.execute(
        `INSERT INTO transactions (transaction_id, customer_name, total_amount, currency, trace_id)
         VALUES ('TXN-DUP-01', 'Second', 20000, 'IDR', 'trace-dup-02')`
      )
    ).rejects.toThrow(/Duplicate entry/);
  });
});
