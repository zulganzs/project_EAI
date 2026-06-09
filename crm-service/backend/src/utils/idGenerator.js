const crypto = require('crypto');

/**
 * Generate a unique reservation ID in the format:
 * RSV-YYYYMMDD-XXXX
 * where XXXX is a 4-char random hex suffix.
 */
function generateReservationId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;
  const suffix = crypto.randomBytes(2).toString('hex'); // 4 hex chars
  return `RSV-${datePart}-${suffix}`;
}

module.exports = { generateReservationId };
