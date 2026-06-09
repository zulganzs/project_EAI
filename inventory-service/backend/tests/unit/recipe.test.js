const { resolveRecipe } = require('../../src/services/recipe.service');

// Mock the pool for recipe resolver tests
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

const pool = require('../../src/config/pool');
const mockConnection = pool.__mockConnection;

describe('3C. Recipe Resolver Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveRecipe returns ingredient list for a known menu_id', async () => {
    // First query: get recipe_id for menu_id
    mockConnection.query.mockResolvedValueOnce([
      [{ id: 1, menu_id: 'M001', menu_name: 'Steak' }],
    ]);
    // Second query: get recipe items with ingredient details
    mockConnection.query.mockResolvedValueOnce([
      [
        { ingredient_id: 1, ingredient_name: 'Daging Sapi', qty_per_menu: 0.5, unit: 'kg' },
        { ingredient_id: 2, ingredient_name: 'Kentang', qty_per_menu: 0.3, unit: 'kg' },
      ],
    ]);

    const result = await resolveRecipe('M001');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      ingredient_id: 1,
      ingredient_name: 'Daging Sapi',
      qty_per_menu: 0.5,
      unit: 'kg',
    });
    expect(result[1]).toEqual({
      ingredient_id: 2,
      ingredient_name: 'Kentang',
      qty_per_menu: 0.3,
      unit: 'kg',
    });
  });

  test('resolveRecipe returns empty array for unknown menu_id', async () => {
    mockConnection.query.mockResolvedValueOnce([[]]);

    const result = await resolveRecipe('M999');
    expect(result).toEqual([]);
  });

  test('resolveRecipe returns empty array when recipe has no items', async () => {
    mockConnection.query.mockResolvedValueOnce([
      [{ id: 2, menu_id: 'M002', menu_name: 'Nasi Goreng' }],
    ]);
    mockConnection.query.mockResolvedValueOnce([[]]);

    const result = await resolveRecipe('M002');
    expect(result).toEqual([]);
  });
});

describe('3C. Seed Data Validation', () => {
  const fs = require('fs');
  const path = require('path');

  test('seed.sql file exists', () => {
    const seedPath = path.join(__dirname, '../../src/seed/seed.sql');
    expect(fs.existsSync(seedPath)).toBe(true);
  });

  test('seed.sql inserts ingredients', () => {
    const seedPath = path.join(__dirname, '../../src/seed/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    expect(sql).toMatch(/INSERT.*INTO.*ingredients/i);
  });

  test('seed.sql inserts recipes for Steak (M001)', () => {
    const seedPath = path.join(__dirname, '../../src/seed/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    expect(sql).toMatch(/M001/);
    expect(sql).toMatch(/Steak/i);
  });

  test('seed.sql inserts recipes for Nasi Goreng (M002)', () => {
    const seedPath = path.join(__dirname, '../../src/seed/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    expect(sql).toMatch(/M002/);
    expect(sql).toMatch(/Nasi Goreng/i);
  });

  test('seed.sql inserts recipe_items linking ingredients to recipes', () => {
    const seedPath = path.join(__dirname, '../../src/seed/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    expect(sql).toMatch(/INSERT.*INTO.*recipe_items/i);
  });
});
