import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/crm';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export async function getReservations() {
  const res = await api.get('/reservations');
  return res.data;
}

export async function createReservation(data) {
  const res = await api.post('/reservations', data);
  return res.data;
}

export async function updateReservationStatus(id, status) {
  const res = await api.patch(`/reservations/${id}`, { status });
  return res.data;
}
