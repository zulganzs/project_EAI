import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/inventory';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export async function getIngredients() {
  const res = await api.get('/ingredients');
  return res.data;
}

export async function createIngredient(data) {
  const res = await api.post('/ingredients', data);
  return res.data;
}

export async function updateIngredientStock(id, stock_qty) {
  const res = await api.patch(`/ingredients/${id}`, { stock_qty });
  return res.data;
}
