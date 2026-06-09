const crypto = require('crypto');

/**
 * Generate a unique transaction ID in the format:
 * TXN-YYYYMMDD-XXXX
 * where XXXX is a 4-char random alphanumeric suffix.
 */
function generateTransactionId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;
  const suffix = crypto.randomBytes(2).toString('hex'); // 4 hex chars
  return `TXN-${datePart}-${suffix}`;
}

module.exports = { generateTransactionId };
