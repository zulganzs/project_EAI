import { useState, useEffect } from 'react';
import { getReservations, createReservation, updateReservationStatus } from '../services/api';

const STATUS_CONFIG = {
  BOOKED: { label: 'Booked', color: '#1565c0', bg: '#e3f2fd' },
  CANCELLED: { label: 'Cancelled', color: '#c62828', bg: '#ffebee' },
  COMPLETED: { label: 'Completed', color: '#2e7d32', bg: '#e8f5e9' },
};

export default function CRMReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', phone: '', party_size: 2, reservation_time: '', table_number: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getReservations();
      setReservations(data);
      setError('');
    } catch (err) {
      setError('Gagal memuat reservasi: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setStatusMsg('Nama pelanggan wajib diisi.'); return; }
    if (!form.reservation_time) { setStatusMsg('Waktu reservasi wajib diisi.'); return; }
    try {
      await createReservation({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || undefined,
        party_size: Number(form.party_size) || 2,
        reservation_time: form.reservation_time,
        table_number: form.table_number ? Number(form.table_number) : undefined,
      });
      setForm({ customer_name: '', phone: '', party_size: 2, reservation_time: '', table_number: '' });
      setShowForm(false);
      setStatusMsg('Reservasi berhasil dibuat!');
      fetchData();
    } catch (err) {
      setStatusMsg('Gagal membuat reservasi: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateReservationStatus(id, newStatus);
      setStatusMsg('Status reservasi diperbarui!');
      fetchData();
    } catch (err) {
      setStatusMsg('Gagal update status: ' + (err.response?.data?.error || err.message));
    }
  };

  const renderStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || { label: status, color: '#666', bg: '#eee' };
    return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('id-ID') : '-';

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>FlowCA CRM</h1>
        <span style={s.badge}>Reservasi Meja</span>
      </header>
      <div style={s.main}>
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.title}>Daftar Reservasi</h2>
            <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Batal' : '+ Reservasi Baru'}
            </button>
          </div>
          {statusMsg && <div style={s.statusBox}>{statusMsg}</div>}
          {error && <div style={s.errorBox}>{error}</div>}
          {showForm && (
            <form style={s.form} onSubmit={handleCreate}>
              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Nama Pelanggan *</label>
                  <input style={s.input} value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Telepon</label>
                  <input style={s.input} value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div style={s.formRow}>
                <div style={s.formGroup}>
                  <label style={s.label}>Jumlah Tamu *</label>
                  <input style={s.input} type="number" min="1" value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Waktu Reservasi *</label>
                  <input style={s.input} type="datetime-local" value={form.reservation_time}
                    onChange={(e) => setForm({ ...form, reservation_time: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Nomor Meja</label>
                  <input style={s.input} type="number" value={form.table_number}
                    onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
                </div>
              </div>
              <button type="submit" style={s.submitBtn}>Buat Reservasi</button>
            </form>
          )}
          {loading ? (
            <div style={s.empty}>Memuat data...</div>
          ) : reservations.length === 0 ? (
            <div style={s.empty}>Belum ada reservasi.</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>ID</th><th style={s.th}>Pelanggan</th><th style={s.th}>Telepon</th>
                  <th style={s.th}>Tamu</th><th style={s.th}>Waktu</th><th style={s.th}>Meja</th>
                  <th style={s.th}>Status</th><th style={s.th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.reservation_id} style={s.tr}>
                    <td style={s.td}><code style={{ fontSize: '0.8rem' }}>{r.reservation_id}</code></td>
                    <td style={s.td}>{r.customer_name}</td>
                    <td style={s.td}>{r.phone || '-'}</td>
                    <td style={s.td}>{r.party_size}</td>
                    <td style={s.td}>{formatDate(r.reservation_time)}</td>
                    <td style={s.td}>{r.table_number || '-'}</td>
                    <td style={s.td}>{renderStatusBadge(r.status)}</td>
                    <td style={s.td}>
                      {r.status === 'BOOKED' && (
                        <>
                          <button style={s.completeBtn} onClick={() => handleStatusChange(r.reservation_id, 'COMPLETED')}>Selesai</button>
                          <button style={s.cancelBtn} onClick={() => handleStatusChange(r.reservation_id, 'CANCELLED')}>Batal</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button style={s.refreshBtn} onClick={fetchData}>Refresh Data</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: { fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", minHeight: '100vh', backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#7b1fa2', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 12, fontSize: '0.85rem' },
  main: { display: 'flex', gap: 20, padding: 20, maxWidth: 1200, margin: '0 auto' },
  panel: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: '1.15rem', borderBottom: '1px solid #eee', paddingBottom: 8 },
  addBtn: { padding: '8px 16px', backgroundColor: '#7b1fa2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  form: { marginBottom: 16, padding: 16, backgroundColor: '#f3e5f5', borderRadius: 8 },
  formRow: { display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  formGroup: { flex: 1, minWidth: 150 },
  label: { display: 'block', fontSize: '0.8rem', marginBottom: 4, color: '#555', fontWeight: 500 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' },
  submitBtn: { padding: '10px 24px', backgroundColor: '#7b1fa2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #7b1fa2', color: '#333', fontWeight: 600 },
  tr: { borderBottom: '1px solid #eee' },
  td: { padding: '10px 8px', verticalAlign: 'middle' },
  completeBtn: { padding: '4px 10px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', marginRight: 4 },
  cancelBtn: { padding: '4px 10px', backgroundColor: '#c62828', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  empty: { textAlign: 'center', color: '#999', padding: 24, fontStyle: 'italic' },
  statusBox: { marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#d4edda', color: '#155724' },
  errorBox: { marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#f8d7da', color: '#721c24' },
  refreshBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' },
};
