const express = require('express');
const router = express.Router();
const pool = require('../config/pool');
const {
  createReservation,
  getReservations,
  getReservation,
  updateReservationStatus,
} = require('../controllers/reservation.controller');

const VALID_STATUSES = ['BOOKED', 'CANCELLED', 'COMPLETED'];

/**
 * Validate request body for creating a reservation.
 */
function validateReservation(body) {
  if (!body.customer_name || typeof body.customer_name !== 'string' || body.customer_name.trim() === '') {
    return 'customer_name is required';
  }
  if (body.party_size == null || typeof body.party_size !== 'number' || body.party_size < 1) {
    return 'party_size is required and must be a positive number';
  }
  if (!body.reservation_time) {
    return 'reservation_time is required';
  }
  return null;
}

// POST /api/crm/reservations
router.post('/reservations', async (req, res) => {
  const validationError = validateReservation(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await createReservation(pool, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/crm/reservations
router.get('/reservations', async (_req, res) => {
  try {
    const result = await getReservations(pool);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/crm/reservations/:id
router.get('/reservations/:id', async (req, res) => {
  try {
    const result = await getReservation(pool, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/crm/reservations/:id
router.patch('/reservations/:id', async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await updateReservationStatus(pool, req.params.id, status);
    if (!result) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
