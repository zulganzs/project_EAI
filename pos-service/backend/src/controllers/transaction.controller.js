const crypto = require('crypto');
const { generateTransactionId } = require('../utils/idGenerator');
const { buildCDMPayload } = require('../services/transaction.service');
const eventPublisher = require('../messaging/eventPublisher');
const crmClient = require('../services/crmClient');

/**
 * Create a new transaction, save to DB, and return the result.
 * If reservation_id is provided, marks the CRM reservation as COMPLETED after success.
 * @param {Object} pool - The database pool module
 * @param {Object} body - Request body with customer_name, items, and optional reservation_id/table_number
 * @returns {Object} Created transaction data
 */
async function createTransaction(pool, body) {
  const {
    customer_name = 'Walk-in Customer',
    currency = 'IDR',
    items,
    reservation_id = null,
    table_number = null,
  } = body;

  // Generate IDs
  const transaction_id = generateTransactionId();
  const trace_id = `trace-pos-${crypto.randomBytes(4).toString('hex')}`;

  // Calculate subtotals and total
  const enrichedItems = items.map((item) => ({
    ...item,
    subtotal: item.qty * item.price,
  }));
  const total_amount = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);

  // Save to database
  const conn = await pool.getConnection();
  try {
    // Insert transaction header (with reservation link if provided)
    await conn.query(
      `INSERT INTO transactions (transaction_id, customer_name, reservation_id, table_number, total_amount, currency, trace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transaction_id, customer_name, reservation_id, table_number, total_amount, currency, trace_id]
    );

    // Insert transaction items
    for (const item of enrichedItems) {
      await conn.query(
        `INSERT INTO transaction_items (transaction_id, menu_id, menu_name, qty, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transaction_id, item.menu_id, item.menu_name, item.qty, item.price, item.subtotal]
      );
    }

    // If linked to a reservation, mark it as COMPLETED in CRM (fire-and-forget)
    if (reservation_id) {
      try {
        await crmClient.completeReservation(reservation_id);
        console.log(`[pos] Marked reservation ${reservation_id} as COMPLETED`);
      } catch (crmErr) {
        console.warn(`[pos] Failed to update CRM reservation: ${crmErr.message}`);
        // Non-blocking — transaction is still valid even if CRM update fails
      }
    }

    return {
      transaction_id,
      customer_name,
      reservation_id,
      table_number,
      total_amount,
      currency,
      trace_id,
      items: enrichedItems,
    };
  } finally {
    conn.release();
  }
}

/**
 * Get a transaction by ID from the database.
 * @param {Object} pool - The database pool module
 * @param {string} id - Transaction ID
 * @returns {Object|null} Transaction data or null if not found
 */
async function getTransaction(pool, id) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT transaction_id, customer_name, reservation_id, table_number, total_amount, currency, trace_id, created_at FROM transactions WHERE transaction_id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const [items] = await conn.query(
      'SELECT menu_id, menu_name, qty, price, subtotal FROM transaction_items WHERE transaction_id = ?',
      [id]
    );

    return {
      ...rows[0],
      items,
    };
  } finally {
    conn.release();
  }
}

module.exports = { createTransaction, getTransaction };
