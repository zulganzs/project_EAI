import { useState, useEffect } from 'react';
import { createTransaction, getTransaction, getReservedTables } from '../services/posApi';

const MENU_ITEMS = [
  { menu_id: 'M001', menu_name: 'Steak', price: 50000 },
  { menu_id: 'M002', menu_name: 'Nasi Goreng', price: 25000 },
  { menu_id: 'D001', menu_name: 'Es Teh', price: 8000 },
  { menu_id: 'D002', menu_name: 'Kopi', price: 12000 },
];

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

export default function POSTab() {
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [lastTransaction, setLastTransaction] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reservation integration
  const [reservedTables, setReservedTables] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // Fetch reserved tables from CRM via POS backend
  const fetchReservedTables = async () => {
    setLoadingReservations(true);
    try {
      const data = await getReservedTables();
      setReservedTables(data);
    } catch (err) {
      console.warn('Failed to fetch reserved tables:', err.message);
      setReservedTables([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => { fetchReservedTables(); }, []);

  const handleSelectReservation = (reservation) => {
    setSelectedReservation(reservation);
    setCustomerName(reservation.customer_name);
  };

  const handleClearReservation = () => {
    setSelectedReservation(null);
    setCustomerName('');
  };

  const addToCart = (menuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_id === menuItem.menu_id);
      if (existing) {
        return prev.map((c) =>
          c.menu_id === menuItem.menu_id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { ...menuItem, qty: 1 }];
    });
  };

  const updateQty = (menuId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => c.menu_id === menuId ? { ...c, qty: Math.max(0, c.qty + delta) } : c)
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (menuId) => {
    setCart((prev) => prev.filter((c) => c.menu_id !== menuId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      setStatus({ type: 'error', message: 'Keranjang kosong!' });
      return;
    }
    setSubmitting(true);
    setStatus({ type: '', message: 'Memproses...' });
    try {
      const payload = {
        customer_name: customerName.trim() || 'Walk-in Customer',
        items: cart.map(({ menu_id, menu_name, qty, price }) => ({ menu_id, menu_name, qty, price })),
      };

      // Link reservation if selected
      if (selectedReservation) {
        payload.reservation_id = selectedReservation.reservation_id;
        payload.table_number = selectedReservation.table_number;
      }

      const result = await createTransaction(payload);
      const detail = await getTransaction(result.transaction_id);
      setLastTransaction(detail);

      const msg = selectedReservation
        ? `Berhasil! ID: ${result.transaction_id} — Reservasi meja ${selectedReservation.table_number} selesai`
        : `Berhasil! ID: ${result.transaction_id}`;
      setStatus({ type: 'success', message: msg });

      setCart([]);
      setCustomerName('');
      setSelectedReservation(null);

      // Refresh reserved tables (the completed one should disappear)
      fetchReservedTables();
    } catch (err) {
      setStatus({ type: 'error', message: 'Gagal: ' + (err.response?.data?.error || err.message) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setCart([]);
    setCustomerName('');
    setSelectedReservation(null);
    setStatus({ type: '', message: '' });
  };

  return (
    <div style={s.wrapper}>
      {/* Left column: Menu + Reserved Tables */}
      <div style={{ ...s.panel, flex: 1 }}>
        {/* Reserved Tables Section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={s.title}>Meja Reservasi</h2>
            <button style={s.refreshBtn} onClick={fetchReservedTables} disabled={loadingReservations}>
              {loadingReservations ? '...' : '↻'}
            </button>
          </div>
          {reservedTables.length === 0 ? (
            <div style={s.emptySmall}>Tidak ada meja yang direservasi saat ini.</div>
          ) : (
            <div style={s.tableGrid}>
              {reservedTables.map((r) => (
                <div
                  key={r.reservation_id}
                  onClick={() => handleSelectReservation(r)}
                  style={{
                    ...s.tableCard,
                    borderColor: selectedReservation?.reservation_id === r.reservation_id ? '#1a73e8' : '#e8e8e8',
                    backgroundColor: selectedReservation?.reservation_id === r.reservation_id ? '#e8f0fe' : '#fafafa',
                  }}
                >
                  <div style={s.tableNumber}>Meja {r.table_number}</div>
                  <div style={s.tableCustomer}>{r.customer_name}</div>
                  <div style={s.tableParty}>{r.party_size} orang</div>
                </div>
              ))}
            </div>
          )}
          {selectedReservation && (
            <div style={s.selectedBanner}>
              <span>Melayani: <strong>{selectedReservation.customer_name}</strong> — Meja {selectedReservation.table_number}</span>
              <button style={s.clearSelBtn} onClick={handleClearReservation}>✕</button>
            </div>
          )}
        </div>

        {/* Menu Section */}
        <h2 style={s.title}>Menu</h2>
        <div style={s.menuGrid}>
          {MENU_ITEMS.map((item) => (
            <div key={item.menu_id} style={s.menuCard}>
              <div>
                <div style={s.menuName}>{item.menu_name}</div>
                <div style={s.menuPrice}>{formatRupiah(item.price)}</div>
              </div>
              <button style={s.addBtn} onClick={() => addToCart(item)}>+ Tambah</button>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: Order */}
      <div style={{ ...s.panel, flex: 1 }}>
        <h2 style={s.title}>Pesanan</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Nama Pelanggan:</label>
          <input type="text" placeholder="Walk-in Customer" value={customerName}
            onChange={(e) => { setCustomerName(e.target.value); if (selectedReservation) setSelectedReservation(null); }}
            style={s.input} />
        </div>
        {selectedReservation && (
          <div style={s.reservationTag}>
            🪑 Meja {selectedReservation.table_number} (Reservasi)
          </div>
        )}
        {cart.length === 0 ? (
          <div style={s.empty}>Belum ada item.</div>
        ) : (
          <div style={s.cartList}>
            {cart.map((item) => (
              <div key={item.menu_id} style={s.cartItem}>
                <div>
                  <strong>{item.menu_name}</strong>
                  <div style={{ color: '#666' }}>{formatRupiah(item.price)} x {item.qty} = <b>{formatRupiah(item.price * item.qty)}</b></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button style={s.qtyBtn} onClick={() => updateQty(item.menu_id, -1)}>-</button>
                  <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button style={s.qtyBtn} onClick={() => updateQty(item.menu_id, 1)}>+</button>
                  <button style={s.delBtn} onClick={() => removeFromCart(item.menu_id)}>x</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={s.totalRow}>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total:</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a73e8' }}>{formatRupiah(totalAmount)}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button style={{ ...s.submitBtn, opacity: cart.length === 0 || submitting ? 0.5 : 1 }}
            onClick={handleSubmit} disabled={cart.length === 0 || submitting}>
            {submitting ? 'Memproses...' : 'Bayar & Proses'}
          </button>
          <button style={s.clearBtn} onClick={handleClear}>Bersihkan</button>
        </div>
        {status.message && (
          <div style={{
            ...s.statusBox,
            backgroundColor: status.type === 'success' ? '#d4edda' : status.type === 'error' ? '#f8d7da' : '#fff3cd',
            color: status.type === 'success' ? '#155724' : status.type === 'error' ? '#721c24' : '#856404',
          }}>
            {status.message}
          </div>
        )}
        {lastTransaction && (
          <div style={s.lastBox}>
            <h4 style={{ margin: '0 0 8px 0' }}>Transaksi Terakhir</h4>
            <div style={s.lastRow}><span>ID:</span><strong>{lastTransaction.transaction_id}</strong></div>
            <div style={s.lastRow}><span>Pelanggan:</span><span>{lastTransaction.customer_name}</span></div>
            {lastTransaction.table_number && (
              <div style={s.lastRow}><span>Meja:</span><span>{lastTransaction.table_number}</span></div>
            )}
            <div style={s.lastRow}><span>Total:</span><strong>{formatRupiah(lastTransaction.total_amount)}</strong></div>
            <div style={s.lastRow}><span>Item:</span><span>{lastTransaction.items?.map((i) => i.menu_name + ' x' + i.qty).join(', ')}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper: { display: 'flex', gap: 20 },
  panel: { backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 16px 0', fontSize: '1.15rem', borderBottom: '1px solid #eee', paddingBottom: 8 },
  menuGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  menuCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8' },
  menuName: { fontWeight: 600, fontSize: '0.95rem' },
  menuPrice: { color: '#1a73e8', fontWeight: 500 },
  addBtn: { padding: '6px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' },
  label: { display: 'block', fontSize: '0.85rem', marginBottom: 4, color: '#555' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' },
  empty: { textAlign: 'center', color: '#999', padding: 24, fontStyle: 'italic' },
  emptySmall: { textAlign: 'center', color: '#999', padding: 12, fontStyle: 'italic', fontSize: '0.85rem' },
  cartList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #e8e8e8' },
  qtyBtn: { width: 28, height: 28, border: '1px solid #ddd', borderRadius: 4, backgroundColor: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  delBtn: { width: 28, height: 28, border: '1px solid #f44336', borderRadius: 4, backgroundColor: '#fff', color: '#f44336', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid #1a73e8', marginTop: 8 },
  submitBtn: { flex: 2, padding: 12, backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  clearBtn: { flex: 1, padding: 12, backgroundColor: 'white', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.9rem', cursor: 'pointer' },
  statusBox: { marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500 },
  lastBox: { marginTop: 16, padding: 12, backgroundColor: '#e8f0fe', borderRadius: 8, border: '1px solid #c5d8f0' },
  lastRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 },
  // Reserved table styles
  tableGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  tableCard: { padding: 10, borderRadius: 8, border: '2px solid', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
  tableNumber: { fontWeight: 700, fontSize: '1rem', color: '#1a73e8' },
  tableCustomer: { fontSize: '0.8rem', color: '#333', marginTop: 2 },
  tableParty: { fontSize: '0.75rem', color: '#666' },
  selectedBanner: { marginTop: 8, padding: '8px 12px', backgroundColor: '#e8f0fe', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', border: '1px solid #c5d8f0' },
  clearSelBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#666' },
  reservationTag: { marginBottom: 12, padding: '6px 12px', backgroundColor: '#fff3e0', borderRadius: 6, fontSize: '0.85rem', color: '#e65100', fontWeight: 500 },
  refreshBtn: { width: 30, height: 30, border: '1px solid #ddd', borderRadius: 6, backgroundColor: 'white', cursor: 'pointer', fontSize: '1rem' },
};
