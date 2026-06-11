import { useState, useEffect } from 'react';
import { getJournalEntries } from '../services/accountingApi';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS_ID[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mmm} ${yyyy} ${hh}:${mm}`;
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_ID[Number(m) - 1]} ${y}`;
}

function exportCsv(filteredEntries, monthLabel) {
  const header = 'transaction_id,timestamp,total_amount,currency,type';
  const rows = filteredEntries.map((e) => {
    if (e.csvPayload) {
      const lines = e.csvPayload.split('\n').filter((l) => l.trim());
      return lines.length > 1 ? lines[1] : lines[0];
    }
    return `${e.transactionId || ''},${e.timestamp || ''},${e.amount || 0},${e.currency || 'IDR'},${e.type || ''}`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accounting-report-${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountingTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getJournalEntries();
      const list = Array.isArray(data) ? data : data.entries || data.data || [];
      setEntries(list);
      setError('');
    } catch (err) {
      setError('Gagal memuat journal entries: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const monthKeys = [...new Set(entries.map((e) => getMonthKey(e.timestamp || e.createdAt)).filter(Boolean))].sort().reverse();

  const filtered = selectedMonth
    ? entries.filter((e) => getMonthKey(e.timestamp || e.createdAt) === selectedMonth)
    : entries;

  const totalRevenue = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const displayMonth = selectedMonth ? getMonthLabel(selectedMonth) : 'Semua';

  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <h2 style={s.title}>Journal Entries</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={s.select} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="">Semua Bulan</option>
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>{getMonthLabel(mk)}</option>
            ))}
          </select>
          <button style={s.exportBtn} onClick={() => exportCsv(filtered, selectedMonth || 'all')} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
      <div style={s.summary}>
        <span>Periode: <strong>{displayMonth}</strong></span>
        <span>Transaksi: <strong>{filtered.length}</strong></span>
        <span>Total Revenue: <strong>{formatRupiah(totalRevenue)}</strong></span>
      </div>
      {error && <div style={s.errorBox}>{error}</div>}
      {loading ? (
        <div style={s.empty}>Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>Belum ada journal entries.</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Transaction ID</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Currency</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Account Code</th>
              <th style={s.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={e.id || i} style={s.tr}>
                <td style={s.td}>{e.id || i + 1}</td>
                <td style={s.td}><code style={{ fontSize: '0.8rem' }}>{e.transactionId || '-'}</code></td>
                <td style={{ ...s.td, fontWeight: 600 }}>{formatRupiah(Number(e.amount) || 0)}</td>
                <td style={s.td}>{e.currency || 'IDR'}</td>
                <td style={s.td}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                    color: e.type === 'DEBIT' ? '#2e7d32' : '#c62828',
                    backgroundColor: e.type === 'DEBIT' ? '#e8f5e9' : '#ffebee',
                  }}>
                    {e.type || '-'}
                  </span>
                </td>
                <td style={s.td}><code>{e.accountCode || '-'}</code></td>
                <td style={s.td}>{formatDate(e.timestamp || e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button style={s.refreshBtn} onClick={fetchData}>Refresh Data</button>
    </div>
  );
}

const s = {
  panel: { backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { margin: 0, fontSize: '1.15rem', borderBottom: '1px solid #eee', paddingBottom: 8 },
  select: { padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.85rem' },
  exportBtn: { padding: '8px 16px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  summary: { display: 'flex', gap: 24, padding: '10px 14px', backgroundColor: '#e8f5e9', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', flexWrap: 'wrap' },
  errorBox: { marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#f8d7da', color: '#721c24' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #2e7d32', color: '#333', fontWeight: 600 },
  tr: { borderBottom: '1px solid #eee' },
  td: { padding: '10px 8px', verticalAlign: 'middle' },
  empty: { textAlign: 'center', color: '#999', padding: 24, fontStyle: 'italic' },
  refreshBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' },
};
