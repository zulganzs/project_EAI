# FlowCA — Enterprise Application Integration (EAI)

FlowCA adalah sistem manajemen restoran yang dibangun dengan **arsitektur microservices** menggunakan koreografi RabbitMQ. Transaksi POS secara otomatis memicu pengurangan stok inventaris dan entri jurnal akuntansi. Reservasi CRM terintegrasi dengan kasir POS untuk alur pembayaran hingga pemesanan meja yang lancar.


---

## Architecture

```
                    ┌────────────────────────────────────────────┐
                    │         INTERNAL DOCKER NETWORK             │
                    │                                            │
                    │   ┌─────────────────────────┐             │
                    │   │    API Gateway :3000     │             │
                    │   │  (Content-Based Router)  │             │
                    │   │  + Rate Limiter          │             │
                    │   └─┬─────┬─────┬─────┬─────┘             │
                    │     │     │     │     │                    │
                    │  /api/  /api/ /api/ /api/                  │
                    │   pos   inv.  crm  acct.                   │
                    │     │     │     │     │                    │
                    │  ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌─────▼─────┐│
                    │  │ POS  │ │Inven-│ │ CRM  │ │Accounting ││
                    │  │:3001 │ │tory  │ │:3003 │ │(C#) :5000 ││
                    │  └──┬───┘ │:3002 │ └──┬───┘ └─────┬─────┘│
                    │     │     └──┬───┘    │           │      │
                    │  ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌────▼────┐ │
                    │  │MySQL │ │MySQL │ │MySQL │ │ SQLite  │ │
                    │  │POS DB│ │Inv DB│ │CRMDB │ │Acct. DB │ │
                    │  └──────┘ └──────┘ └──────┘ └─────────┘ │
                    │                                            │
                    │     POS publishes ──► RabbitMQ             │
                    │                      (flowca.events)       │
                    │                         │    │             │
                    │                         ▼    ▼             │
                    │                    Inventory  Accounting   │
                    │                    (deduct)   (journal)    │
                    └────────────────────────────────────────────┘

                    ┌────────────────────────────────────────────┐
                    │           EXPOSED TO HOST                   │
                    ├────────────────────────────────────────────┤
                    │  :5174  Dashboard (POS + Inventory + CRM)  │
                    │  :9083  Accounting Frontend                 │
                    │  :15672 RabbitMQ Management UI              │
                    └────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **POS Backend** | Node.js, Express, MySQL 8.0 |
| **Inventory Backend** | Node.js, Express, MySQL 8.0 |
| **Accounting Backend** | C# .NET 10.0, EF Core, SQLite |
| **CRM Backend** | Node.js, Express, MySQL 8.0 |
| **API Gateway** | Node.js, Express, http-proxy-middleware, express-rate-limit |
| **Message Broker** | RabbitMQ 3 (with Management UI) |
| **Dashboard** | React 18, Vite 5, Axios |
| **Accounting Frontend** | React 18, Vite 5, Axios |
| **Containerization** | Docker, Docker Compose |

---

## Microservices Design

### Network Isolation

All backends, databases, and the API gateway are **internal-only** — no ports exposed to the host machine. External access is limited to:

| Port | Service | Purpose |
|------|---------|---------|
| `5174` | Dashboard | Unified UI (POS + Inventory + CRM) |
| `9083` | Accounting Frontend | Journal entries + CSV export |
| `15672` | RabbitMQ Management | Admin monitoring |

### Service Communication Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| **API Gateway (Content-Based Router)** | Dashboard, Accounting Frontend | Single entry point routing by URL prefix |
| **Event-Driven (Pub/Sub via RabbitMQ)** | POS → Inventory, POS → Accounting | Asynchronous choreography |
| **Synchronous REST (via Gateway)** | POS → CRM | POS fetches reservations and completes them through the API Gateway |
| **Rate Limiting** | API Gateway | 100 req/15min global, 30 writes/15min per IP |

### POS ↔ CRM Integration Flow

```
1. CRM creates reservation (customer_name, table_number, status=BOOKED)
2. POS Dashboard shows reserved tables (fetched from CRM via API Gateway)
3. Cashier selects a reserved table → customer name auto-fills
4. Cashier adds items and submits payment
5. POS creates transaction (with reservation_id + table_number linked)
6. POS calls CRM via API Gateway → marks reservation as COMPLETED
7. POS publishes TRANSAKSI_SELESAI event to RabbitMQ (unchanged)
   └─ Inventory deducts stock
   └─ Accounting creates journal entry
```

---

## How to Run

### Prerequisites

- [Docker](https://www.docker.com/) (v20+) + Docker Compose (v2+)
- ~4 GB free disk space

### 1. Clone & Configure

```bash
git clone <repo-url>
cd project_EAI
cp .env.example .env
```

Defaults work out of the box — no editing needed.

### 2. Start Everything

```bash
docker compose up -d --build
```

This starts **12 containers**: RabbitMQ, 3 MySQL instances, 4 backends, API Gateway, Dashboard, Accounting Frontend.

> First run takes ~3-5 minutes (pulling base images + building .NET 10.0 SDK).

### 3. Verify

```bash
# Check all containers are running
docker compose ps

# Test via dashboard
open http://localhost:5174
```

### 4. Open the UIs

| UI | URL | Description |
|----|-----|-------------|
| **Unified Dashboard** | http://localhost:5174 | POS + Inventory + CRM in one page |
| **Accounting** | http://localhost:9083 | Journal entries + CSV export |
| **RabbitMQ Management** | http://localhost:15672 | Message broker UI (guest/guest) |

### 5. Stop

```bash
docker compose down        # Stop (keep data)
docker compose down -v     # Stop + delete all data (reset DBs)
```

---

## System Overview

### POS Service (Event Producer + CRM Integration)

Creates transactions and publishes `TRANSAKSI_SELESAI` events to RabbitMQ. Integrates with CRM to link transactions to reservations.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `POST` | `/api/pos/transactions` | Create a new transaction |
| `GET` | `/api/pos/transactions/:id` | Get transaction by ID |
| `GET` | `/api/pos/reserved-tables` | Get BOOKED reservations from CRM |

**POST request body (with reservation):**

```json
{
  "customer_name": "John Doe",
  "reservation_id": "RSV-20260610-a1b2",
  "table_number": 5,
  "items": [
    { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000 }
  ]
}
```

**POST request body (walk-in, no reservation):**

```json
{
  "customer_name": "Walk-in Customer",
  "items": [
    { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000 }
  ]
}
```

**POST response (201):**

```json
{
  "transaction_id": "TXN-20260609-ab12",
  "customer_name": "John Doe",
  "reservation_id": "RSV-20260610-a1b2",
  "table_number": 5,
  "total_amount": 100000,
  "currency": "IDR",
  "trace_id": "trace-pos-ab12cd34",
  "items": [
    { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000, "subtotal": 100000 }
  ]
}
```

**Menu items (seed data):**

| ID | Name | Price (IDR) |
|----|------|-------------|
| M001 | Steak | 50.000 |
| M002 | Nasi Goreng | 25.000 |
| D001 | Es Teh | 8.000 |
| D002 | Kopi | 12.000 |

---

### Inventory Service (Event Subscriber — Choreography)

Subscribes to `TRANSAKSI_SELESAI` events, resolves recipes (Bill of Materials), and automatically deducts ingredient stock.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `GET` | `/api/inventory/ingredients` | List all ingredients with stock |
| `POST` | `/api/inventory/ingredients` | Add a new ingredient |
| `PATCH` | `/api/inventory/ingredients/:id` | Update ingredient stock |

**Automatic stock deduction on transaction:**

When a POS transaction includes menu items with recipes, stock is automatically deducted:

- Steak (M001): Daging Sapi 0.5kg + Kentang 0.3kg
- Nasi Goreng (M002): Beras 0.2kg + Telur 2 butir + Minyak Goreng 0.05L + Bawang Merah 20g + Kecap Manis 30ml

Items without recipes (drinks D001, D002) are skipped.

---

### CRM Service (Reservations)

Manages table reservations with status tracking. Integrates with POS — reservations are auto-completed when payment is made.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `GET` | `/api/crm/reservations` | List all reservations |
| `POST` | `/api/crm/reservations` | Create a reservation |
| `PATCH` | `/api/crm/reservations/:id` | Update reservation status |

**POST request body:**

```json
{
  "customer_name": "John Doe",
  "phone": "081234567890",
  "party_size": 4,
  "reservation_time": "2026-06-10T19:00:00Z",
  "table_number": 5
}
```

Valid statuses: `BOOKED` → `COMPLETED` or `CANCELLED`

---

### Accounting Service (Event Subscriber — C# .NET)

Subscribes to `TRANSAKSI_SELESAI` events, transforms JSON to CSV, enforces idempotency, and writes journal entries. Failed messages go to a Dead Letter Queue (DLQ) with retry.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `GET` | `/api/accounting/journal-entries` | List all journal entries |
| `GET` | `/api/accounting/processed-transactions` | List processed transactions |

---

### API Gateway (Content-Based Router + Rate Limiter)

Single entry point for Dashboard and Accounting Frontend. Routes requests based on URL path prefix. Includes rate limiting to prevent abuse.

| Gateway Path | Routes To | Service |
|---|---|---|
| `/api/pos/*` | `http://pos-backend:3001` | POS Backend |
| `/api/inventory/*` | `http://inventory-backend:3002` | Inventory Backend |
| `/api/crm/*` | `http://crm-backend:3003` | CRM Backend |
| `/api/accounting/*` | `http://accounting-service:5000` | Accounting Backend |

**Rate Limits:**
- Global: 100 requests per IP per 15 minutes
- Writes (POST/PATCH/PUT/DELETE): 30 requests per IP per 15 minutes

---

### Event Flow (Choreography Pattern)

```
1. Cashier selects reserved table (or walk-in) and creates transaction
   └─ POST /api/pos/transactions

2. POS saves to MySQL (with reservation_id if linked)
   └─ If reservation linked: PATCH /api/crm/reservations/:id → COMPLETED

3. POS publishes event to RabbitMQ
   └─ Exchange: flowca.events | Key: transaction.completed

4a. Inventory subscriber receives event
    └─ Resolves recipe (BOM) → Deducts stock → Writes audit log

4b. Accounting subscriber receives event (with retry + DLQ)
    └─ Checks idempotency → Transforms JSON→CSV → Writes journal entry
```

**Canonical Data Model (CDM) — the event contract:**

```json
{
  "event_type": "TRANSAKSI_SELESAI",
  "transaction_id": "TXN-20260609-ab12",
  "source_system": "POS",
  "timestamp": "2026-06-09T10:30:00.000Z",
  "customer": { "name": "Walk-in Customer" },
  "items": [{ "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000 }],
  "total_amount": 100000,
  "currency": "IDR",
  "trace_id": "trace-pos-ab12cd34"
}
```

---

## EAI Patterns Implemented

| Pattern | Implementation |
|---------|---------------|
| **Content-Based Router** | API Gateway routes by URL prefix |
| **Message Broker** | RabbitMQ (topic exchange, durable queues) |
| **Publish-Subscribe** | POS publishes → Inventory + Accounting subscribe |
| **Canonical Data Model** | Standardized `TRANSAKSI_SELESAI` event schema |
| **Idempotent Receiver** | Both Inventory and Accounting check for duplicate processing |
| **Dead Letter Queue** | Accounting DLQ for failed message retry |
| **Message Translator** | Accounting transforms JSON → CSV |
| **Wire Tap** | Stock movements audit log in Inventory |
| **Rate Limiting** | API Gateway throttles requests per IP |

---

## Project Structure

```
project_EAI/
├── .env                                 # Environment configuration
├── docker-compose.yml                   # Full stack orchestration (12 containers)
├── api-gateway/                         # API Gateway (Express + Rate Limiter)
│   └── src/
│       ├── config/routes.js             # Service URL configuration
│       ├── middleware/proxy.js          # Proxy middlewares per service
│       ├── middleware/rateLimiter.js    # Rate limiting middleware
│       └── app.js                       # Route registration
├── pos-service/
│   └── backend/                         # POS Backend (Node/Express/MySQL/RabbitMQ)
│       └── src/
│           ├── services/crmClient.js    # CRM integration via API Gateway
│           └── routes/transaction.routes.js
├── inventory-service/
│   └── backend/                         # Inventory Backend (Node/Express/MySQL/RabbitMQ)
│       └── src/
│           ├── services/deduction.service.js  # Stock deduction logic
│           └── services/recipe.service.js     # Recipe/BOM resolver
├── accounting-service/
│   ├── src/Accounting.Service/          # Accounting Backend (C# .NET 10.0/SQLite/RabbitMQ)
│   └── frontend/                        # Accounting Dashboard UI
├── crm-service/
│   └── backend/                         # CRM Backend (Node/Express/MySQL)
└── dashboard/                           # Unified Dashboard (POS + Inventory + CRM)
```

---

## Running Tests

### Unit Tests (no Docker needed)

```bash
cd pos-service/backend && npm test
cd inventory-service/backend && npm test
cd api-gateway && npm test
cd crm-service/backend && npm test
```

### .NET Tests

```bash
cd accounting-service/tests/Accounting.Service.Tests && dotnet test
```

---

## Troubleshooting

### Services can't connect to RabbitMQ

Both Inventory and Accounting services have built-in retry logic (10 attempts, 3s delay). If they still fail:

```bash
docker compose restart inventory-backend accounting-service
```

### Reset all data

```bash
docker compose down -v
docker compose up -d --build
```

### Check service logs

```bash
docker compose logs pos-backend --tail 20
docker compose logs inventory-backend --tail 20
docker compose logs accounting-service --tail 20
```

---

## License

This project is for educational purposes (Tugas Besar EAI — Semester 4 - Kelompok 1).
