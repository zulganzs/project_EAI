import axios from 'axios';

const BASE = '/api/accounting';

export const getJournalEntries = () => axios.get(`${BASE}/journal-entries`).then(r => r.data);
export const getProcessedTransactions = () => axios.get(`${BASE}/processed-transactions`).then(r => r.data);
