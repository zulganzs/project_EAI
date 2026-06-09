const { processTransactionEvent } = require('../../src/services/deduction.service');

// Mock pool for DB operations
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

// Mock recipe service
jest.mock('../../src/services/recipe.service', () => ({
  resolveRecipe: jest.fn(),
}));

const pool = require('../../src/config/pool');
const mockConnection = pool.__mockConnection;
const { resolveRecipe } = require('../../src/services/recipe.service');

describe('3E. Stock Deduction Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processTransactionEvent deducts stock for single item', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ab12',
      items: [{ menu_id: 'M001', menu_name: 'Steak', qty: 2, price: 50000 }],
    };

    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 1, ingredient_name: 'Daging Sapi', qty_per_menu: 0.5, unit: 'kg' },
      { ingredient_id: 2, ingredient_name: 'Kentang', qty_per_menu: 0.3, unit: 'kg' },
    ]);

    mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(2);
    expect(result.deductions[0]).toEqual({
      ingredient_id: 1,
      ingredient_name: 'Daging Sapi',
      qty_deducted: 1,    // 0.5 * 2
      unit: 'kg',
    });
    expect(result.deductions[1]).toEqual({
      ingredient_id: 2,
      ingredient_name: 'Kentang',
      qty_deducted: 0.6,  // 0.3 * 2
      unit: 'kg',
    });
  });

  test('processTransactionEvent deducts stock for multiple menu items', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-cd34',
      items: [
        { menu_id: 'M001', menu_name: 'Steak', qty: 1, price: 50000 },
        { menu_id: 'M002', menu_name: 'Nasi Goreng', qty: 2, price: 25000 },
      ],
    };

    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 1, ingredient_name: 'Daging Sapi', qty_per_menu: 0.5, unit: 'kg' },
    ]);
    resolveRecipe.mockResolvedValueOnce([
      { ingredient_id: 3, ingredient_name: 'Beras', qty_per_menu: 0.2, unit: 'kg' },
      { ingredient_id: 4, ingredient_name: 'Telur', qty_per_menu: 2, unit: 'butir' },
    ]);

    mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(3);
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ingredient_name: 'Daging Sapi', qty_deducted: 0.5 }),
        expect.objectContaining({ ingredient_name: 'Beras', qty_deducted: 0.4 }),
        expect.objectContaining({ ingredient_name: 'Telur', qty_deducted: 4 }),
      ]),
    );
  });

  test('processTransactionEvent skips items with no recipe', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-ef56',
      items: [{ menu_id: 'M999', menu_name: 'Unknown', qty: 1, price: 10000 }],
    };

    resolveRecipe.mockResolvedValueOnce([]);

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(0);
    expect(result.skipped).toEqual([{ menu_id: 'M999', reason: 'No recipe found' }]);
  });

  test('processTransactionEvent handles empty items array', async () => {
    const cdmPayload = {
      event_type: 'TRANSAKSI_SELESAI',
      transaction_id: 'TXN-20260609-gh78',
      items: [],
    };

    const result = await processTransactionEvent(cdmPayload);

    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(0);
  });
});
