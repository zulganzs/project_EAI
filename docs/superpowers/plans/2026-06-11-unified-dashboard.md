# Unified Dashboard — FlowCA All-in-One Management UI

> **Approach:** Test-Driven Development (TDD). Each phase: **write test first → verify it fails → implement code → verify test passes → commit → stop for review.**
>
> **Rule:** After every phase completes (tests green + feature working), I will **stop and tell you** so you can review. You must approve before I move to the next phase.
>
> **Constraint:** All backend traffic routes **exclusively through the API Gateway (:3000)**. The dashboard never calls `:3001`, `:3002`, `:3003`, or `:5000` directly.
>
> **Existing frontends:** The 3 per-service frontends (`pos-service/frontend`, `inventory-service/frontend`, `crm-service/frontend`) are kept as-is and not modified.

---

## Architecture Overview

```
Browser (dashboard on :5174)
        │
        │  all /api/* requests
        v
  ┌─────────────────────┐
  │  API Gateway :3000   │  ← single entry point (no direct backend calls)
  │  Content-Based Router│
  └──┬──────┬──────┬──────┬───┘
     │      │      │      │
  /api/ /api/  /api/ /api/
  pos/  inven- crm/  accoun-
        tory/        ting/
     │      │      │      │
  :3001  :3002  :3003  :5000
  (POS) (Inv.) (CRM) (C#)
```

The only structural change to existing services is **adding one new proxy entry to the API Gateway** for the accounting service (which currently has no gateway route).

---

## Dependency Graph & Build Order

```
Phase A: Gateway — Add Accounting Proxy  (no frontend deps)
  └── A1. routes.js + proxy.js + app.js + unit tests

Phase B: Unified Dashboard Frontend
  ├── B1. Project scaffold + tab shell + /health smoke test
  ├── B2. POS Tab  (cashier UI via gateway)
  ├── B3. Inventory Tab  (ingredients UI via gateway)
  ├── B4. CRM Tab  (reservations UI via gateway)
  └── B5. Accounting Tab  (journal entries + monthly CSV export)

Phase C: Dockerization
  ├── C1. Dockerfile for dashboard
  └── C2. docker-compose.yml additions
```

---

## Phase Details

---

### Phase A — API Gateway: Add Accounting Proxy

**Goal:** Expose the accounting service through the gateway so every client (including the new dashboard) uses a single origin.

**Why this is needed first:** The accounting service (`Accounting.Service/Program.cs`) already exposes HTTP endpoints (`/api/journal-entries`, `/api/processed-transactions`, `/health`) on port `5000`, but the gateway has no proxy for it. Without this phase the dashboard would be forced to call `:5000` directly — violating the architecture constraint.

#### A1. Gateway changes (TDD)

**Test first (`tests/unit/router.test.js` — existing file, extend it):**

```
New tests added:
  - config exports accountingBaseUrl
  - config default is http://localhost:5000
  - GET /api/accounting/health proxies to accounting service (200/404/502/504)
  - GET /api/accounting/journal-entries proxies (200/502)
  - /api/accounting/* does NOT match /api/pos/* or /api/crm/*
  - proxy module exports accountingProxy
```

Total new tests: **6** (existing 8 tests retained → new total: **14 tests**)

**Implement:**

| File | Change |
|---|---|
| `api-gateway/src/config/routes.js` | Add `accountingBaseUrl: process.env.ACCOUNTING_BASE_URL \|\| 'http://localhost:5000'` |
| `api-gateway/src/middleware/proxy.js` | Add `accountingProxy` — `/api/accounting/*` → `ACCOUNTING_BASE_URL`, with path rewrite stripping `/api/accounting` prefix so accounting receives `/api/journal-entries` etc. |
| `api-gateway/src/app.js` | Mount `app.use('/api/accounting', accountingProxy)` before the catch-all 404 |

**Path rewrite detail:**
The accounting service uses paths like `/api/journal-entries` (not `/api/accounting/journal-entries`). The proxy must rewrite:
```
/api/accounting/journal-entries  →  /api/journal-entries
/api/accounting/health           →  /health
```
This is done with `http-proxy-middleware`'s `pathRewrite` option:
```js
pathRewrite: { '^/api/accounting': '' }
```

**Effective gateway routes after Phase A:**

| Gateway path | Rewrites to | Service |
|---|---|---|
| `GET /api/accounting/journal-entries` | `/api/journal-entries` | Accounting :5000 |
| `GET /api/accounting/journal-entries/:id` | `/api/journal-entries/:id` | Accounting :5000 |
| `GET /api/accounting/journal-entries/transaction/:txId` | `/api/journal-entries/transaction/:txId` | Accounting :5000 |
| `GET /api/accounting/processed-transactions` | `/api/processed-transactions` | Accounting :5000 |
| `GET /api/accounting/health` | `/health` | Accounting :5000 |

**.env.example addition:**
```
ACCOUNTING_BASE_URL=http://localhost:5000
```

**Verify:**
```bash
cd api-gateway && npm test   # 14 tests pass
```

---

### Phase B — Unified Dashboard Frontend

**Location:** `/Users/user/Desktop/project_EAI/dashboard/`

**Stack:** React 18 + Vite 5 + Axios (identical to existing per-service frontends)

**Dev port:** `:5174` (avoids conflict with per-service frontends on `:5173`)

**Architecture rule enforced in `vite.config.js`:**
```js
server: {
  port: 5174,
  proxy: { '/api': 'http://localhost:3000' }  // ALL requests go through gateway
}
```

---

#### B1. Project scaffold + tab shell

**Test first:** No unit test framework for React (Vite default). Verification is build success + manual smoke.

**Implement:**

```
dashboard/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx            ← tab switcher (4 tabs)
    ├── components/
    │   ├── POSTab.jsx
    │   ├── InventoryTab.jsx
    │   ├── CRMTab.jsx
    │   └── AccountingTab.jsx
    └── services/
        ├── posApi.js
        ├── inventoryApi.js
        ├── crmApi.js
        └── accountingApi.js
```

**`App.jsx` tab bar:**

```
┌─────────────────────────────────────────────────────┐
│  FlowCA Management Dashboard                        │
│  [POS Cashier] [Inventory] [CRM Reservations] [Accounting] │
└─────────────────────────────────────────────────────┘
│                  <active tab content>               │
```

Tab header color theme (consistent with existing frontends):
- **POS** — blue `#1a73e8`
- **Inventory** — orange `#ff6d00`
- **CRM** — purple `#7b1fa2`
- **Accounting** — green `#2e7d32`

**Verify:** `npm run build` succeeds (no errors).

---

#### B2. POS Tab

**Goal:** Full cashier flow — same functionality as `pos-service/frontend/src/components/CashierPOS.jsx` but calling exclusively through gateway.

**API calls (all via `/api/pos/*` → gateway → `:3001`):**
```
POST /api/pos/transactions   { items: [{menu_id, menu_name, qty, price}] }
GET  /api/pos/transactions/:id
```

**`services/posApi.js`:**
```js
import axios from 'axios';
const BASE = '/api/pos';
export const createTransaction = (items) => axios.post(`${BASE}/transactions`, { items });
export const getTransaction    = (id)    => axios.get(`${BASE}/transactions/${id}`);
```

**`components/POSTab.jsx` features:**
- Hardcoded menu grid: M001 Steak (Rp 50.000), M002 Nasi Goreng (Rp 25.000), D001 Es Teh (Rp 8.000), D002 Kopi (Rp 12.000) — matching inventory seed data
- Cart with qty controls and line totals
- "Checkout" button → POST → shows transaction ID + total
- Last transaction detail panel (GET by ID)
- IDR currency via `Intl.NumberFormat('id-ID')`

**Verify:** `npm run build` succeeds.

---

#### B3. Inventory Tab

**Goal:** Full ingredient management — same as `inventory-service/frontend/src/components/InventoryDashboard.jsx` via gateway.

**API calls (all via `/api/inventory/*` → gateway → `:3002`):**
```
GET   /api/inventory/ingredients
POST  /api/inventory/ingredients    { name, unit, stock_qty }
PATCH /api/inventory/ingredients/:id  { stock_qty }
```

**`services/inventoryApi.js`:**
```js
import axios from 'axios';
const BASE = '/api/inventory';
export const getIngredients    = ()       => axios.get(`${BASE}/ingredients`);
export const createIngredient  = (data)   => axios.post(`${BASE}/ingredients`, data);
export const updateStock       = (id, qty) => axios.patch(`${BASE}/ingredients/${id}`, { stock_qty: qty });
```

**`components/InventoryTab.jsx` features:**
- Table: name, unit, stock_qty, last updated, actions
- Stock color-coding: red (≤ 0), orange (≤ 5), green (> 5) — matching existing frontend
- Inline stock edit (click to edit → PATCH)
- Add ingredient form (POST)
- Auto-refresh after any mutation

**Verify:** `npm run build` succeeds.

---

#### B4. CRM Tab

**Goal:** Full reservation management — same as `crm-service/frontend/src/components/CRMReservations.jsx` via gateway.

**API calls (all via `/api/crm/*` → gateway → `:3003`):**
```
GET   /api/crm/reservations
POST  /api/crm/reservations    { customer_name, party_size, reservation_time, phone?, table_number? }
PATCH /api/crm/reservations/:id  { status }
```

**`services/crmApi.js`:**
```js
import axios from 'axios';
const BASE = '/api/crm';
export const getReservations    = ()         => axios.get(`${BASE}/reservations`);
export const createReservation  = (data)     => axios.post(`${BASE}/reservations`, data);
export const updateStatus       = (id, status) => axios.patch(`${BASE}/reservations/${id}`, { status });
```

**`components/CRMTab.jsx` features:**
- Reservation table: ID, customer name, phone, party size, time, table, status, created
- Status badges: Booked (blue), Completed (green), Cancelled (red) — matching existing frontend
- Status update buttons: mark Completed / Cancelled
- Create reservation form (POST)

**Verify:** `npm run build` succeeds.

---

#### B5. Accounting Tab ← New capability

**Goal:** View all journal entries with month filter and one-click CSV export of monthly transaction reports.

**API calls (all via `/api/accounting/*` → gateway → `:5000`):**
```
GET /api/accounting/journal-entries
GET /api/accounting/processed-transactions
```

**`services/accountingApi.js`:**
```js
import axios from 'axios';
const BASE = '/api/accounting';
export const getJournalEntries       = () => axios.get(`${BASE}/journal-entries`);
export const getProcessedTransactions = () => axios.get(`${BASE}/processed-transactions`);
```

**`components/AccountingTab.jsx` features:**

1. **Journal entries table** — columns:
   - `#` (Id)
   - Transaction ID (e.g., `TXN-20260609-ab12`)
   - Amount (IDR formatted)
   - Currency
   - Type (`DEBIT` / `CREDIT`)
   - Account Code
   - Date (formatted `DD MMM YYYY HH:mm`)

2. **Month filter** — a `<select>` dropdown auto-populated from distinct months found in the loaded data. Selecting a month filters the table rows in-memory (no additional API call needed).

3. **Summary bar** (updates when month filter changes):
   ```
   Filtered period: June 2026 | Transactions: 12 | Total Revenue: Rp 1.250.000
   ```

4. **"Export CSV" button** — generates and downloads a CSV file client-side:
   - Uses the `csvPayload` field already stored on each `JournalEntry` by `MessageTransformer.cs`
   - `csvPayload` format per entry (already built by C# service):
     ```
     transaction_id,timestamp,total_amount,currency,type
     TXN-20260609-ab12,2026-06-09T10:30:00.000Z,50000,IDR,SALES_REVENUE
     ```
   - The export assembles all filtered entries' `csvPayload` into one file:
     - Write the header row once (from the first entry's `csvPayload`)
     - Append only the data row (second line) from each entry's `csvPayload`
   - File name: `accounting-report-YYYY-MM.csv`
   - Trigger via `URL.createObjectURL(blob)` + programmatic anchor click — no backend endpoint needed

**CSV export logic (pseudocode):**
```js
function exportCsv(filteredEntries, monthLabel) {
  const header = 'transaction_id,timestamp,total_amount,currency,type';
  const rows = filteredEntries.map(e => e.csvPayload.split('\n')[1]); // data line only
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accounting-report-${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Verify:** `npm run build` succeeds.

---

### Phase C — Dockerization

#### C1. Dashboard Dockerfile

```dockerfile
# dashboard/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`dashboard/nginx.conf` — same pattern as existing frontends: SPA fallback + `/api` proxy to gateway:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api-gateway:3000;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

#### C2. docker-compose.yml additions

**New service block:**
```yaml
dashboard:
  build: ./dashboard
  ports:
    - "5174:80"
  environment:
    - VITE_API_URL=http://api-gateway:3000
  depends_on:
    - api-gateway
  networks:
    - flowca-network
```

**Modified `api-gateway` service block (add env var):**
```yaml
api-gateway:
  # ...existing config...
  environment:
    - POS_BASE_URL=http://pos-backend:3001
    - INVENTORY_BASE_URL=http://inventory-backend:3002
    - CRM_BASE_URL=http://crm-backend:3003
    - ACCOUNTING_BASE_URL=http://accounting-service:5000   # ← new
```

**Verify:**
```bash
docker compose build dashboard
docker compose up -d
curl http://localhost:5174          # Dashboard loads
curl http://localhost:3000/api/accounting/journal-entries  # Proxy works
```

---

## File Summary

### New files created

```
api-gateway/
└── src/
    ├── config/routes.js          MODIFIED — add accountingBaseUrl
    ├── middleware/proxy.js       MODIFIED — add accountingProxy + pathRewrite
    └── app.js                   MODIFIED — mount accountingProxy
    tests/unit/router.test.js    MODIFIED — 6 new tests (total 14)

dashboard/                       NEW DIRECTORY
├── package.json
├── vite.config.js
├── index.html
├── Dockerfile
├── nginx.conf
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── components/
    │   ├── POSTab.jsx
    │   ├── InventoryTab.jsx
    │   ├── CRMTab.jsx
    │   └── AccountingTab.jsx
    └── services/
        ├── posApi.js
        ├── inventoryApi.js
        ├── crmApi.js
        └── accountingApi.js

docker-compose.yml               MODIFIED — add dashboard service + ACCOUNTING_BASE_URL to gateway
.env.example                     MODIFIED — add ACCOUNTING_BASE_URL=http://localhost:5000
```

### Files NOT modified

```
pos-service/frontend/        ← kept as-is
inventory-service/frontend/  ← kept as-is
crm-service/frontend/        ← kept as-is
accounting-service/          ← kept as-is (no C# changes)
pos-service/backend/         ← kept as-is
inventory-service/backend/   ← kept as-is
crm-service/backend/         ← kept as-is
```

---

## Test Summary

| Phase | Test type | Count | Command |
|---|---|---|---|
| A1 Gateway | Unit (Jest) | 14 total (6 new) | `cd api-gateway && npm test` |
| B1–B5 Dashboard | Build verification | — | `cd dashboard && npm run build` |
| C Docker | Container smoke | manual | `docker compose up -d` |

---

## Run Commands (development)

```bash
# 1. Start gateway with accounting proxy (after Phase A)
cd api-gateway && node src/server.js   # port 3000

# 2. Start dashboard dev server (after Phase B)
cd dashboard && npm install && npm run dev  # port 5174

# 3. Full stack (after Phase C)
docker compose up -d
# Dashboard → http://localhost:5174
# Gateway   → http://localhost:3000
```

---

## Current Status

- [ ] Phase A: API Gateway — Add Accounting Proxy
- [ ] Phase B: Unified Dashboard Frontend
  - [ ] B1. Scaffold + tab shell
  - [ ] B2. POS Tab
  - [ ] B3. Inventory Tab
  - [ ] B4. CRM Tab
  - [ ] B5. Accounting Tab (journal entries + month filter + CSV export)
- [ ] Phase C: Dockerization
