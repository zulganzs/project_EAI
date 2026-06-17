const express = require('express');
const router = express.Router();
const pool = require('../config/pool');
const { createTransaction, getTransaction } = require('../controllers/transaction.controller');
const { buildCDMPayload } = require('../services/transaction.service');
const crmClient = require('../services/crmClient');
const eventPublisher = require('../messaging/eventPublisher');

/**
 * Validate request body for creating a transaction.
 */
function validateTransaction(body) {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'items array is required and must not be empty';
  }
  for (const item of body.items) {
    if (!item.menu_id || !item.menu_name || item.qty == null || item.price == null) {
      return 'each item must have menu_id, menu_name, qty, and price';
    }
  }
  return null;
}

// GET /api/pos/reserved-tables — fetch BOOKED reservations from CRM via API Gateway
router.get('/reserved-tables', async (_req, res) => {
  try {
    const reservations = await crmClient.getBookedReservations();
    return res.status(200).json(reservations);
  } catch (err) {
    console.error(`[pos] Failed to fetch reserved tables: ${err.message}`);
    return res.status(502).json({ error: 'Failed to fetch reservations from CRM' });
  }
});

// POST /api/pos/transactions
router.post('/transactions', async (req, res) => {
  const validationError = validateTransaction(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await createTransaction(pool, req.body);

    // Publish TRANSAKSI_SELESAI event to RabbitMQ (fire-and-forget)
    try {
      const cdmPayload = buildCDMPayload(result);
      await eventPublisher.publishEvent(cdmPayload);
      console.log(`[pos] Published TRANSAKSI_SELESAI for ${result.transaction_id}`);
    } catch (pubErr) {
      console.warn(`[pos] Failed to publish event: ${pubErr.message}`);
    }

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/pos/transactions/:id
router.get('/transactions/:id', async (req, res) => {
  try {
    const result = await getTransaction(pool, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
