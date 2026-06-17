import axios from 'axios';

const BASE = '/api/pos';

export const createTransaction = (data) => axios.post(`${BASE}/transactions`, data).then(r => r.data);
export const getTransaction = (id) => axios.get(`${BASE}/transactions/${id}`).then(r => r.data);
export const getReservedTables = () => axios.get(`${BASE}/reserved-tables`).then(r => r.data);
