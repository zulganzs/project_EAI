const pool = require('../config/pool');

/**
 * Resolve a menu_id to its list of required ingredients with quantities.
 * Used to determine which ingredients to deduct when a TRANSAKSI_SELESAI event is received.
 *
 * @param {string} menuId - The menu_id from the CDM event (e.g., 'M001')
 * @returns {Array<{ingredient_id: number, ingredient_name: string, qty_per_menu: number, unit: string}>}
 */
async function resolveRecipe(menuId) {
  const conn = await pool.getConnection();
  try {
    // Find the recipe for this menu_id
    const [recipes] = await conn.query(
      'SELECT id, menu_id, menu_name FROM recipes WHERE menu_id = ?',
      [menuId],
    );

    if (recipes.length === 0) {
      return [];
    }

    const recipe = recipes[0];

    // Get all recipe items with ingredient details
    const [items] = await conn.query(
      `SELECT ri.ingredient_id, i.name AS ingredient_name, ri.qty_per_menu, i.unit
       FROM recipe_items ri
       JOIN ingredients i ON ri.ingredient_id = i.id
       WHERE ri.recipe_id = ?`,
      [recipe.id],
    );

    return items;
  } finally {
    conn.release();
  }
}

module.exports = { resolveRecipe };
