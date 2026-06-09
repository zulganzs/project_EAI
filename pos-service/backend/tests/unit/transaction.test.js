const { generateTransactionId } = require('../../src/utils/idGenerator');
const { buildCDMPayload } = require('../../src/services/transaction.service');

describe('2C. Transaction ID Generator', () => {
  test('generates ID with TXN prefix', () => {
    const id = generateTransactionId();
    expect(id).toMatch(/^TXN-/);
  });

  test('generates ID with date segment YYYYMMDD', () => {
    const id = generateTransactionId();
    const datePattern = /^TXN-\d{8}-/;
    expect(id).toMatch(datePattern);
    // Extract date part and verify it's today
    const datePart = id.split('-')[1];
    const now = new Date();
    const expected = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    expect(datePart).toBe(expected);
  });

  test('generates ID with 4-char random suffix', () => {
    const id = generateTransactionId();
    const parts = id.split('-');
    // TXN-YYYYMMDD-XXXX
    expect(parts).toHaveLength(3);
    expect(parts[2]).toMatch(/^[a-z0-9]{4}$/);
  });

  test('generates unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTransactionId()));
    expect(ids.size).toBe(100);
  });
});

describe('2C. CDM Payload Builder', () => {
  const sampleTransaction = {
    transaction_id: 'TXN-20260609-ab12',
    customer_name: 'Walk-in Customer',
    total_amount: 50000,
    currency: 'IDR',
    trace_id: 'trace-pos-ab12cd34',
    items: [
      { menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000, subtotal: 50000 },
    ],
  };

  test('builds CDM with correct event_type', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.event_type).toBe('TRANSAKSI_SELESAI');
  });

  test('builds CDM with correct source_system', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.source_system).toBe('POS');
  });

  test('builds CDM with transaction_id', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.transaction_id).toBe('TXN-20260609-ab12');
  });

  test('builds CDM with ISO timestamp', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Date.parse(cdm.timestamp)).not.toBeNaN();
  });

  test('builds CDM with customer object', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.customer).toEqual({ name: 'Walk-in Customer' });
  });

  test('builds CDM items without subtotal', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.items).toHaveLength(1);
    expect(cdm.items[0]).toEqual({
      menu_id: 'M001',
      menu_name: 'Steak',
      qty: 1,
      price: 50000,
    });
    // Ensure subtotal is NOT in CDM
    expect(cdm.items[0]).not.toHaveProperty('subtotal');
  });

  test('builds CDM with total_amount', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.total_amount).toBe(50000);
  });

  test('builds CDM with currency', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.currency).toBe('IDR');
  });

  test('builds CDM with trace_id', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    expect(cdm.trace_id).toBe('trace-pos-ab12cd34');
  });

  test('CDM payload matches the canonical contract exactly', () => {
    const cdm = buildCDMPayload(sampleTransaction);
    // Verify top-level keys
    const expectedKeys = [
      'event_type', 'transaction_id', 'source_system',
      'timestamp', 'customer', 'items', 'total_amount',
      'currency', 'trace_id',
    ];
    expect(Object.keys(cdm).sort()).toEqual(expectedKeys.sort());
  });
});
