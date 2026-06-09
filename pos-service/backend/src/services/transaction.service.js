/**
 * Build the Canonical Data Model (CDM) payload for TRANSAKSI_SELESAI events.
 * This is the contract that Inventory and Accounting services depend on.
 *
 * @param {Object} transaction - The transaction record from DB
 * @returns {Object} CDM payload conforming to the event schema
 */
function buildCDMPayload(transaction) {
  return {
    event_type: 'TRANSAKSI_SELESAI',
    transaction_id: transaction.transaction_id,
    source_system: 'POS',
    timestamp: new Date().toISOString(),
    customer: { name: transaction.customer_name },
    items: transaction.items.map((item) => ({
      menu_id: item.menu_id,
      menu_name: item.menu_name,
      qty: item.qty,
      price: item.price,
    })),
    total_amount: transaction.total_amount,
    currency: transaction.currency,
    trace_id: transaction.trace_id,
  };
}

module.exports = { buildCDMPayload };
