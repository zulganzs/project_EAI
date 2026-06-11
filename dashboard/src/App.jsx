import { useState } from 'react';
import POSTab from './components/POSTab';
import InventoryTab from './components/InventoryTab';
import CRMTab from './components/CRMTab';

const TABS = [
  { key: 'pos', label: 'POS Cashier', color: '#1a73e8' },
  { key: 'inventory', label: 'Inventory', color: '#ff6d00' },
  { key: 'crm', label: 'CRM Reservations', color: '#7b1fa2' },
];

export default function App() {
  const [active, setActive] = useState('pos');
  const current = TABS.find((t) => t.key === active);

  return (
    <div style={s.container}>
      <header style={{ ...s.header, backgroundColor: current.color }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>FlowCA Management Dashboard</h1>
        <div style={s.tabBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                ...s.tab,
                backgroundColor: active === t.key ? 'rgba(255,255,255,0.3)' : 'transparent',
                fontWeight: active === t.key ? 700 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div style={s.body}>
        {active === 'pos' && <POSTab />}
        {active === 'inventory' && <InventoryTab />}
        {active === 'crm' && <CRMTab />}
      </div>
    </div>
  );
}

const s = {
  container: { fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", minHeight: '100vh', backgroundColor: '#f0f2f5' },
  header: { color: 'white', padding: '12px 24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s' },
  tabBar: { display: 'flex', gap: 6, marginTop: 10 },
  tab: { padding: '6px 16px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: '0.85rem' },
  body: { padding: 20, maxWidth: 1200, margin: '0 auto' },
};
