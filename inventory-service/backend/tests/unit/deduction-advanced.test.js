const { processTransactionEvent } = require('../../src/services/deduction.service');

jest.mock('../../src/config/pool', () => {
  const mockConnection = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    initPool: jest.fn(),
    closePool: jest.fn(),
    __mockConnection: mockConnection,
  };
});

jest.mock('../../src/services/recipe.service', () => ({
  resolveRecipe: jest.fn(),
}));

const pool = require('../../src/config/pool');
const mockConnection = pool.__mockConnection;
const { resolveRecipe } = require('../../src/services/recipe.service');

describe('3E. Stock Deduction — Advanced', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aggregates qty when same ingredient used in multiple recipes', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ij90',
      items: [
        { menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 },
        { menu_id: 'M003', menu_name: 'Steak Fries', qty: 1, price: 55000 },
      ],
    };

    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 2, ingredient_name: 'Kentang', qty_per_menu: 0.3, unit: 'kg' },
    ]);
    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 2, ingredient_name: 'Kentang', qty_per_menu: 0.5, unit: 'kg' },
    ]);

    // First query: idempotency SELECT (no existing record)
    // Subsequent queries: UPDATE + INSERT
    mockConnection.query
      .mockResolvedValueOnce([[], []]) // SELECT: not processed yet
      .mockResolvedValue([{ affectedRows: 1 }]); // UPDATE + INSERT calls

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(true);
    const kentangDeduction = result.deductions.find((d) => d.ingredient_id === 2);
    expect(kentangDeduction).toBeDefined();
    expect(kentangDeduction.qty_deducted).toBe(0.8);
  });

  test('writes audit log (stock_movements)', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-audit',
      items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
    };

    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 1, ingredient_name: 'Daging Sapi', qty_per_menu: 0.5, unit: 'kg' },
    ]);

    // First query: idempotency SELECT (no existing record)
    // Subsequent queries: UPDATE + INSERT
    mockConnection.query
      .mockResolvedValueOnce([[], []]) // SELECT: not processed yet
      .mockResolvedValue([{ affectedRows: 1 }]); // UPDATE + INSERT

    await processTransactionEvent(cdmPayload);

    const auditCalls = mockConnection.query.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('stock_movements') && !call[0].trim().toUpperCase().startsWith('SELECT'),
    );
    expect(auditCalls.length).toBe(1);
    expect(auditCalls[0][1]).toEqual(
      expect.arrayContaining([
        1,
        -0.5,
        'TRANSAKSI_SELESAI: TXN-20260609-audit',
        'TXN-20260609-audit',
      ]),
    );
  });

  test('returns error result on DB failure', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-fail',
      items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 }],
    };

    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 1, ingredient_name: 'Daging Sapi', qty_per_menu: 0.5, unit: 'kg' },
    ]);

    // First query: idempotency SELECT (no existing record)
    // Second query: UPDATE fails
    mockConnection.query
      .mockResolvedValueOnce([[], []]) // SELECT: not processed yet
      .mockRejectedValueOnce(new Error('DB connection lost'));

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
