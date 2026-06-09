import { useState, useEffect } from 'react';
import { getIngredients, createIngredient, updateIngredientStock } from '../services/api';

export default function InventoryDashboard() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', unit: '', stock_qty: 0 });
  const [editId, setEditId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data);
      setError('');
    } catch (err) {
      setError('Gagal memuat data bahan: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIngredients(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newIngredient.name.trim() || !newIngredient.unit.trim()) {
      setStatusMsg('Nama dan satuan wajib diisi.'); return;
    }
    try {
      await createIngredient({
        name: newIngredient.name.trim(),
        unit: newIngredient.unit.trim(),
        stock_qty: Number(newIngredient.stock_qty) || 0,
      });
      setNewIngredient({ name: '', unit: '', stock_qty: 0 });
      setShowAddForm(false);
      setStatusMsg('Bahan berhasil ditambahkan!');
      fetchIngredients();
    } catch (err) {
      setStatusMsg('Gagal menambah: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStock = async (id) => {
    const qty = Number(editQty);
    if (isNaN(qty)) { setStatusMsg('Jumlah tidak valid.'); return; }
    try {
      await updateIngredientStock(id, qty);
      setEditId(null);
      setEditQty('');
      setStatusMsg('Stok berhasil diperbarui!');
      fetchIngredients();
    } catch (err) {
      setStatusMsg('Gagal update: ' + (err.response?.data?.error || err.message));
    }
  };

  const startEdit = (ing) => { setEditId(ing.id); setEditQty(String(ing.stock_qty)); };
  const cancelEdit = () => { setEditId(null); setEditQty(''); };

  const getStockColor = (qty) => {
    if (qty <= 0) return '#d32f2f';
    if (qty <= 5) return '#f57c00';
    return '#388e3c';
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>FlowCA Inventory</h1>
        <span style={s.badge}>Stock Management</span>
      </header>
      <div style={s.main}>
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.title}>Daftar Bahan Baku</h2>
            <button style={s.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Batal' : '+ Tambah Bahan'}
            </button>
          </div>
          {statusMsg && <div style={s.statusBox}>{statusMsg}</div>}
          {error && <div style={s.errorBox}>{error}</div>}
          {showAddForm && (
            <form style={s.form} onSubmit={handleAdd}>
              <input style={s.input} placeholder="Nama bahan" value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })} />
              <input style={s.input} placeholder="Satuan (kg, liter, butir...)" value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })} />
              <input style={s.input} type="number" placeholder="Stok awal" value={newIngredient.stock_qty}
                onChange={(e) => setNewIngredient({ ...newIngredient, stock_qty: e.target.value })} />
              <button type="submit" style={s.submitBtn}>Simpan</button>
            </form>
          )}
          {loading ? (
            <div style={s.empty}>Memuat data...</div>
          ) : ingredients.length === 0 ? (
            <div style={s.empty}>Belum ada bahan terdaftar.</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr><th style={s.th}>ID</th><th style={s.th}>Nama</th><th style={s.th}>Satuan</th>
                  <th style={s.th}>Stok</th><th style={s.th}>Terakhir Update</th><th style={s.th}>Aksi</th></tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => (
                  <tr key={ing.id} style={s.tr}>
                    <td style={s.td}>{ing.id}</td>
                    <td style={s.td}>{ing.name}</td>
                    <td style={s.td}>{ing.unit}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: getStockColor(Number(ing.stock_qty)) }}>
                      {editId === ing.id ? (
                        <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                          style={{ ...s.input, width: 80, display: 'inline-block', marginRight: 4 }} />
                      ) : (
                        Number(ing.stock_qty)
                      )}
                    </td>
                    <td style={s.td}>{ing.updated_at ? new Date(ing.updated_at).toLocaleString('id-ID') : '-'}</td>
                    <td style={s.td}>
                      {editId === ing.id ? (
                        <>
                          <button style={s.saveBtn} onClick={() => handleUpdateStock(ing.id)}>Simpan</button>
                          <button style={s.cancelBtn} onClick={cancelEdit}>Batal</button>
                        </>
                      ) : (
                        <button style={s.editBtn} onClick={() => startEdit(ing)}>Ubah Stok</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button style={s.refreshBtn} onClick={fetchIngredients}>Refresh Data</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: { fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", minHeight: '100vh', backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#ff6d00', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 12, fontSize: '0.85rem' },
  main: { display: 'flex', gap: 20, padding: 20, maxWidth: 1200, margin: '0 auto' },
  panel: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: '1.15rem', borderBottom: '1px solid #eee', paddingBottom: 8 },
  addBtn: { padding: '8px 16px', backgroundColor: '#ff6d00', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  form: { display: 'flex', gap: 8, marginBottom: 16, padding: 12, backgroundColor: '#fff3e0', borderRadius: 8, flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' },
  submitBtn: { padding: '8px 20px', backgroundColor: '#ff6d00', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #ff6d00', color: '#333', fontWeight: 600 },
  tr: { borderBottom: '1px solid #eee' },
  td: { padding: '10px 8px', verticalAlign: 'middle' },
  editBtn: { padding: '4px 12px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  saveBtn: { padding: '4px 12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', marginRight: 4 },
  cancelBtn: { padding: '4px 12px', backgroundColor: '#757575', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  empty: { textAlign: 'center', color: '#999', padding: 24, fontStyle: 'italic' },
  statusBox: { marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#d4edda', color: '#155724' },
  errorBox: { marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#f8d7da', color: '#721c24' },
  refreshBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' },
};
