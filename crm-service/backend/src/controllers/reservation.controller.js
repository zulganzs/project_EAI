const { generateReservationId } = require('../utils/idGenerator');

/**
 * Create a new reservation and save to DB.
 * @param {Object} pool - The database pool module
 * @param {Object} body - Request body with customer_name, phone, party_size, reservation_time, table_number
 * @returns {Object} Created reservation data
 */
async function createReservation(pool, body) {
  const {
    customer_name,
    phone = null,
    party_size,
    reservation_time,
    table_number = null,
  } = body;

  const reservation_id = generateReservationId();
  const status = 'BOOKED';

  const conn = await pool.getConnection();
  try {
    await conn.query(
      `INSERT INTO reservations (reservation_id, customer_name, phone, party_size, reservation_time, table_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reservation_id, customer_name, phone, party_size, reservation_time, table_number, status]
    );

    return {
      reservation_id,
      customer_name,
      phone,
      party_size,
      reservation_time,
      table_number,
      status,
    };
  } finally {
    conn.release();
  }
}

/**
 * Get all reservations from the database.
 * @param {Object} pool - The database pool module
 * @returns {Array} List of reservations
 */
async function getReservations(pool) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT reservation_id, customer_name, phone, party_size, reservation_time, table_number, status, created_at FROM reservations ORDER BY created_at DESC'
    );
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Get a single reservation by ID.
 * @param {Object} pool - The database pool module
 * @param {string} id - Reservation ID
 * @returns {Object|null} Reservation data or null
 */
async function getReservation(pool, id) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT reservation_id, customer_name, phone, party_size, reservation_time, table_number, status, created_at FROM reservations WHERE reservation_id = ?',
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0];
  } finally {
    conn.release();
  }
}

/**
 * Update the status of a reservation.
 * @param {Object} pool - The database pool module
 * @param {string} id - Reservation ID
 * @param {string} status - New status (BOOKED, CANCELLED, COMPLETED)
 * @returns {Object|null} Updated reservation data or null if not found
 */
async function updateReservationStatus(pool, id, status) {
  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query(
      'SELECT reservation_id FROM reservations WHERE reservation_id = ?',
      [id]
    );
    if (existing.length === 0) return null;

    await conn.query(
      'UPDATE reservations SET status = ? WHERE reservation_id = ?',
      [status, id]
    );

    return { reservation_id: id, status };
  } finally {
    conn.release();
  }
}

module.exports = { createReservation, getReservations, getReservation, updateReservationStatus };
