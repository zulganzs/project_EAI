const pool = require('../config/pool');
const { resolveRecipe } = require('./recipe.service');

/**
 * Process a TRANSAKSI_SELESAI CDM event and deduct stock from inventory.
 *
 * For each item in the CDM payload:
 *   1. Resolve the recipe (menu_id → list of ingredients with qty_per_menu)
 *   2. Calculate total qty to deduct per ingredient (qty_per_menu * menu_qty)
 *   3. Aggregate deductions if the same ingredient appears in multiple recipes
 *   4. Update stock_qty in the ingredients table
 *   5. Write an audit record to stock_movements
 *
 * @param {Object} cdmPayload - The CDM event from RabbitMQ
 * @returns {Object} Result with success, deductions, and skipped items
 */
async function processTransactionEvent(cdmPayload) {
  const { transaction_id, items } = cdmPayload;

  if (!items || items.length === 0) {
    return { success: true, deductions: [], skipped: [], transaction_id };
  }

  const conn = await pool.getConnection();

  try {
    // Step 1: Collect all ingredient requirements across all menu items
    const ingredientMap = new Map(); // ingredient_id -> { ingredient_name, total_qty, unit }
    const skipped = [];

    for (const item of items) {
      const recipeIngredients = await resolveRecipe(item.menu_id);

      if (recipeIngredients.length === 0) {
        skipped.push({ menu_id: item.menu_id, reason: 'No recipe found' });
        continue;
      }

      for (const ri of recipeIngredients) {
        const qtyNeeded = ri.qty_per_menu * item.qty;
        const existing = ingredientMap.get(ri.ingredient_id);

        if (existing) {
          existing.total_qty += qtyNeeded;
        } else {
          ingredientMap.set(ri.ingredient_id, {
            ingredient_id: ri.ingredient_id,
            ingredient_name: ri.ingredient_name,
            total_qty: qtyNeeded,
            unit: ri.unit,
          });
        }
      }
    }

    // Step 2: Deduct stock and write audit logs
    const deductions = [];

    for (const [, ing] of ingredientMap) {
      // Deduct from stock
      await conn.query(
        'UPDATE ingredients SET stock_qty = stock_qty - ? WHERE id = ?',
        [ing.total_qty, ing.ingredient_id],
      );

      // Write audit log
      await conn.query(
        'INSERT INTO stock_movements (ingredient_id, change_qty, reason, transaction_id) VALUES (?, ?, ?, ?)',
        [
          ing.ingredient_id,
          -ing.total_qty,
          `TRANSAKSI_SELESAI: ${transaction_id}`,
          transaction_id,
        ],
      );

      deductions.push({
        ingredient_id: ing.ingredient_id,
        ingredient_name: ing.ingredient_name,
        qty_deducted: ing.total_qty,
        unit: ing.unit,
      });
    }

    return { success: true, deductions, skipped, transaction_id };
  } catch (err) {
    return { success: false, error: err.message, transaction_id };
  } finally {
    conn.release();
  }
}

module.exports = { processTransactionEvent };
