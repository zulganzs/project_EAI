import axios from 'axios';

const BASE = '/api/inventory';

export const getIngredients = () => axios.get(`${BASE}/ingredients`).then(r => r.data);
export const createIngredient = (data) => axios.post(`${BASE}/ingredients`, data).then(r => r.data);
export const updateStock = (id, qty) => axios.patch(`${BASE}/ingredients/${id}`, { stock_qty: qty }).then(r => r.data);
