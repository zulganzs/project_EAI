import axios from 'axios';

// In production (Docker), the API URL comes from env var.
// In dev mode, Vite proxy forwards /api to localhost:3000.
const API_BASE = import.meta.env.VITE_API_URL || '/api/pos';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Create a new transaction.
 * @param {Object} data - { customer_name, items: [{menu_id, menu_name, qty, price}] }
 * @returns {Object} Created transaction with transaction_id
 */
export async function createTransaction(data) {
  const res = await api.post('/transactions', data);
  return res.data;
}

/**
 * Get a transaction by ID.
 * @param {string} id - Transaction ID
 * @returns {Object} Transaction data
 */
export async function getTransaction(id) {
  const res = await api.get(`/transactions/${id}`);
  return res.data;
}
