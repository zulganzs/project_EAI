import axios from 'axios';

const BASE = '/api/crm';

export const getReservations = () => axios.get(`${BASE}/reservations`).then(r => r.data);
export const createReservation = (data) => axios.post(`${BASE}/reservations`, data).then(r => r.data);
export const updateStatus = (id, status) => axios.patch(`${BASE}/reservations/${id}`, { status }).then(r => r.data);
