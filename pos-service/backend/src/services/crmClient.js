const http = require('http');

/**
 * CRM Client — POS backend communicates with CRM via the API Gateway.
 * This maintains proper microservices boundaries (no direct DB access across services).
 */

const GATEWAY_BASE = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

/**
 * Get all BOOKED reservations from CRM via the API Gateway.
 * @returns {Promise<Array>} List of booked reservations
 */
async function getBookedReservations() {
  const url = `${GATEWAY_BASE}/api/crm/reservations`;
  const data = await httpGet(url);
  // Filter only BOOKED reservations with a table_number assigned
  return data.filter((r) => r.status === 'BOOKED' && r.table_number != null);
}

/**
 * Mark a reservation as COMPLETED in CRM via the API Gateway.
 * @param {string} reservationId - The reservation ID to complete
 * @returns {Promise<Object>} Updated reservation
 */
async function completeReservation(reservationId) {
  const url = `${GATEWAY_BASE}/api/crm/reservations/${reservationId}`;
  return httpPatch(url, { status: 'COMPLETED' });
}

/**
 * Simple HTTP GET helper (no external deps needed).
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`CRM GET ${url} responded ${res.statusCode}: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Simple HTTP PATCH helper (no external deps needed).
 */
function httpPatch(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`CRM PATCH ${url} responded ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { getBookedReservations, completeReservation };
