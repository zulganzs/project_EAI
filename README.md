# FlowCA — Enterprise Application Integration (EAI)

FlowCA is a restaurant management system built with **event-driven microservices** using RabbitMQ choreography. POS transactions automatically trigger inventory stock deductions and accounting journal entries — no direct service-to-service calls needed.

Built with **Test-Driven Development (TDD)** — 306+ tests across all services.

---

## Architecture

```
                          ┌─────────────────────────┐
                          │    API Gateway :3000     │
                          │  (Content-Based Router)  │
                          └─┬─────┬─────┬─────┬─────┘
                            │     │     │     │
                         /api/pos /api/ /api/ /api/
                          │     inv.  crm  acct.
                            │     │     │     │
                   ┌────────▼──┐  │  ┌──▼────────┐  ┌──────────────┐
                   │POS Backend│  │  │CRM Backend │  │Accounting    │
                   │  :3001    │  │  │  :3003     │  │(C# .NET):5000│
                   └─────┬─────┘  │  └─────┬─────┘  └──────┬───────┘
                         │        │        │                │
                    ┌────▼────┐   │   ┌────▼─────┐   ┌─────▼──────┐
                    │ MySQL   │   │   │  MySQL   │   │  SQLite    │
                    │(POS DB) │   │   │(CRM DB)  │   │(Accounting)│
                    └─────────┘   │   └──────────┘   └────────────┘
                         │        │
                  Publishes       │
                  TRANSAKSI_      │
                  SELESAI         ▼
                  ──────> RabbitMQ (flowca.events)
                            │     │
                            ▼     ▼
                   ┌──────────────┐  ┌──────────────┐
                   │  Inventory   │  │  Accounting  │
                   │  (Node :3002)│  │  (C# :5000)  │
                   └──────┬───────┘  └──────────────┘
                          │
                    ┌─────▼──────┐
                    │   MySQL    │
                    │(Inventory) │
                    └────────────┘

  Frontends (React 18 + Vite 5):
  ┌─────────────┐ ┌──────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐
  │POS Cashier  │ │Inventory Dash│ │CRM Reserv.│ │Accounting │ │  Dashboard   │
  │  :9080      │ │  :9081       │ │  :9082    │ │  :9083    │ │  :5174       │
  └─────────────┘ └──────────────┘ └───────────┘ └───────────┘ └──────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **POS Backend** | Node.js, Express, MySQL 8.0 |
| **Inventory Backend** | Node.js, Express, MySQL 8.0 |
| **Accounting Backend** | C# .NET 10.0, EF Core, SQLite |
| **CRM Backend** | Node.js, Express, MySQL 8.0 |
| **API Gateway** | Node.js, Express, http-proxy-middleware |
| **Message Broker** | RabbitMQ 3 (with Management UI) |
| **All Frontends** | React 18, Vite 5, Axios |
| **Containerization** | Docker, Docker Compose |

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

This starts **15 containers**: RabbitMQ, 3 MySQL instances, 4 backends, 5 frontends, API Gateway.

> First run takes ~3-5 minutes (pulling base images + building .NET 10.0 SDK).

### 3. Verify

```bash
# Check all containers are running
docker compose ps

# Test gateway health
curl http://localhost:3000/health
```

### 4. Open the UIs

| UI | URL | Description |
|----|-----|-------------|
| **Unified Dashboard** | http://localhost:5174 | POS + Inventory + CRM in one page |
| **POS Cashier** | http://localhost:9080 | Standalone cashier terminal |
| **Inventory Dashboard** | http://localhost:9081 | Stock management |
| **CRM Reservations** | http://localhost:9082 | Table reservations |
| **Accounting** | http://localhost:9083 | Journal entries + CSV export |
| **RabbitMQ Management** | http://localhost:15672 | Message broker UI (guest/guest) |

### 5. Stop

```bash
docker compose down        # Stop (keep data)
docker compose down -v     # Stop + delete all data
```

---

## System Overview

### POS Service (Event Producer)

Creates transactions and publishes `TRANSAKSI_SELESAI` events to RabbitMQ.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `POST` | `/api/pos/transactions` | Create a new transaction |
| `GET` | `/api/pos/transactions/:id` | Get transaction by ID |
| `GET` | `/health` | POS backend health check |

**POST request body:**

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
  "customer_name": "Walk-in Customer",
  "total_amount": 100000,
  "currency": "IDR",
  "trace_id": "trace-pos-ab12cd34",
  "items": [
    { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000, "subtotal": 100000 }
  ]
}
```

**GET response:**

```json
{
  "transaction_id": "TXN-20260609-ab12",
  "customer_name": "Walk-in Customer",
  "total_amount": 100000,
  "currency": "IDR",
  "trace_id": "trace-pos-ab12cd34",
  "created_at": "2026-06-09T10:30:00.000Z",
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
| `GET` | `/health` | Inventory backend health check |

**GET response — list of ingredients:**

```json
[
  {
    "id": 1,
    "name": "Daging Sapi",
    "unit": "gram",
    "stock_qty": 5000,
    "updated_at": "2026-06-09T10:30:00.000Z"
  }
]
```

**POST request body:**

```json
{
  "name": "Garam",
  "unit": "gram",
  "stock_qty": 1000
}
```

**POST response (201):**

```json
{
  "id": 10,
  "name": "Garam",
  "unit": "gram",
  "stock_qty": 1000
}
```

**PATCH request body:**

```json
{ "stock_qty": 500 }
```

**PATCH response:**

```json
{
  "id": 10,
  "name": "Garam",
  "unit": "gram",
  "stock_qty": 500,
  "updated_at": "2026-06-09T12:00:00.000Z"
}
```

---

### CRM Service (Reservations)

Manages table reservations with status tracking.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `GET` | `/api/crm/reservations` | List all reservations |
| `POST` | `/api/crm/reservations` | Create a reservation |
| `PATCH` | `/api/crm/reservations/:id` | Update reservation status |
| `GET` | `/health` | CRM backend health check |

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

**POST response (201):**

```json
{
  "reservation_id": "RSV-20260610-a1b2",
  "customer_name": "John Doe",
  "phone": "081234567890",
  "party_size": 4,
  "reservation_time": "2026-06-10T19:00:00Z",
  "table_number": 5,
  "status": "BOOKED"
}
```

**PATCH request body:**

```json
{ "status": "COMPLETED" }
```

Valid statuses: `BOOKED` → `COMPLETED` or `CANCELLED`

**GET response — list of reservations:**

```json
[
  {
    "reservation_id": "RSV-20260610-a1b2",
    "customer_name": "John Doe",
    "phone": "081234567890",
    "party_size": 4,
    "reservation_time": "2026-06-10T19:00:00.000Z",
    "table_number": 5,
    "status": "BOOKED",
    "created_at": "2026-06-10T18:00:00.000Z"
  }
]
```

---

### Accounting Service (Event Subscriber — C# .NET)

Subscribes to `TRANSAKSI_SELESAI` events, transforms JSON to CSV, enforces idempotency, and writes double-entry journal entries. Failed messages go to a Dead Letter Queue (DLQ) with retry.

| Method | Gateway Endpoint | Description |
|--------|-----------------|-------------|
| `GET` | `/api/accounting/journal-entries` | List all journal entries |
| `GET` | `/api/accounting/journal-entries/:id` | Get journal entry by ID |
| `GET` | `/api/accounting/journal-entries/transaction/:txId` | Get entries by transaction ID |
| `GET` | `/api/accounting/processed-transactions` | List all processed (idempotent) transactions |
| `GET` | `/api/accounting/health` | Accounting service health check |

**GET `/api/accounting/journal-entries` response:**

```json
[
  {
    "id": 1,
    "transactionId": "TXN-20260609-ab12",
    "amount": 100000.0,
    "currency": "IDR",
    "type": "SALES_REVENUE",
    "accountCode": "REV-100",
    "createdAt": "2026-06-09T10:30:00.000Z",
    "csvPayload": "transaction_id,timestamp,total_amount,currency,type\nTXN-20260609-ab12,2026-06-09T10:30:00.000Z,100000,IDR,SALES_REVENUE"
  }
]
```

The `csvPayload` field is used by the Accounting Frontend for one-click CSV export.

---

### API Gateway (Content-Based Router)

Single entry point for all clients. Routes requests based on URL path prefix.

| Gateway Path | Routes To | Service |
|---|---|---|
| `/api/pos/*` | `POS_BASE_URL` (`:3001`) | POS Backend |
| `/api/inventory/*` | `INVENTORY_BASE_URL` (`:3002`) | Inventory Backend |
| `/api/crm/*` | `CRM_BASE_URL` (`:3003`) | CRM Backend |
| `/api/accounting/*` | `ACCOUNTING_BASE_URL` (`:5000`) | Accounting Backend |
| `/health` | — | Gateway itself |
| `/api/*` (other) | — | 404 Not Found |

> Accounting path rewrite: `/api/accounting/journal-entries` → `/api/journal-entries`

---

### Event Flow (Choreography Pattern)

```
1. Cashier creates transaction via POS
   └─ POST /api/pos/transactions

2. POS saves to MySQL, publishes event to RabbitMQ
   └─ Exchange: flowca.events | Key: transaction.completed

3a. Inventory subscriber receives event
    └─ Resolves recipe (BOM) → Deducts stock → Writes audit log

3b. Accounting subscriber receives event
    └─ Checks idempotency → Transforms JSON→CSV → Writes journal entry
    └─ On failure: retries via DLQ
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

## Quick API Tests

```bash
# Gateway health
curl http://localhost:3000/health

# Create a POS transaction (triggers inventory + accounting)
curl -X POST http://localhost:3000/api/pos/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "items": [
      { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000 }
    ]
  }'

# Check ingredients (stock deducted automatically)
curl http://localhost:3000/api/inventory/ingredients

# Check journal entries (accounted automatically)
curl http://localhost:3000/api/accounting/journal-entries

# Create a CRM reservation
curl -X POST http://localhost:3000/api/crm/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "party_size": 4,
    "reservation_time": "2026-06-10T19:00:00Z"
  }'
```

---

## Ports Reference

| Service | Port | URL |
|---------|------|-----|
| **API Gateway** | 3000 | http://localhost:3000 |
| POS Backend | 3001 | http://localhost:3001 |
| Inventory Backend | 3002 | http://localhost:3002 |
| CRM Backend | 3003 | http://localhost:3003 |
| Accounting Backend | 5001 | http://localhost:5001 |
| RabbitMQ AMQP | 5672 | amqp://localhost:5672 |
| RabbitMQ Management | 15672 | http://localhost:15672 |
| POS MySQL | 3306 | localhost:3306 |
| Inventory MySQL | 3307 | localhost:3307 |
| CRM MySQL | 3308 | localhost:3308 |
| **Unified Dashboard** | 5174 | http://localhost:5174 |
| POS Frontend | 9080 | http://localhost:9080 |
| Inventory Frontend | 9081 | http://localhost:9081 |
| CRM Frontend | 9082 | http://localhost:9082 |
| Accounting Frontend | 9083 | http://localhost:9083 |

---

## Project Structure

```
project_EAI/
├── .env.example                         # Shared environment configuration
├── docker-compose.yml                   # Full stack orchestration (15 containers)
├── api-gateway/                         # API Gateway (Express, Content-Based Router)
│   └── src/
├── pos-service/
│   ├── backend/                         # POS Backend (Node/Express/MySQL/RabbitMQ publisher)
│   └── frontend/                        # POS Cashier UI (React + Vite)
├── inventory-service/
│   ├── backend/                         # Inventory Backend (Node/Express/MySQL/RabbitMQ subscriber)
│   └── frontend/                        # Inventory Dashboard UI (React + Vite)
├── accounting-service/
│   ├── src/Accounting.Service/          # Accounting Backend (C# .NET 10.0/SQLite/RabbitMQ subscriber)
│   └── frontend/                        # Accounting Dashboard UI (React + Vite)
├── crm-service/
│   ├── backend/                         # CRM Backend (Node/Express/MySQL)
│   └── frontend/                        # CRM Reservations UI (React + Vite)
├── dashboard/                           # Unified Dashboard (POS + Inventory + CRM tabs)
└── tests/                               # E2E + Docker validation tests
```

---

## Running Tests

### Unit Tests (no Docker needed)

```bash
cd pos-service/backend && npm test           # 45 tests
cd inventory-service/backend && npm test     # 50 tests
cd api-gateway && npm test                   # 24 tests
cd crm-service/backend && npm test           # 27 tests
cd accounting-service/src/Accounting.Service && dotnet test  # 34 tests
```

### Integration Tests (require MySQL on port 3307)

```bash
docker run -d --name test-mysql -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=test_db -p 3307:3306 mysql:8.0

cd pos-service/backend && POS_DB_PORT=3307 POS_DB_NAME=pos_test_db npm run test:integration
cd inventory-service/backend && INVENTORY_DB_PORT=3307 INVENTORY_DB_NAME=inventory_test_db npm run test:integration
cd crm-service/backend && CRM_DB_PORT=3307 CRM_DB_NAME=crm_test_db npm run test:integration

docker rm -f test-mysql
```

### E2E Tests

```bash
npm run test:e2e
```

---

## License

This project is for educational purposes.
