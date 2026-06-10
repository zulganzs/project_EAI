# FlowCA EAI — End-to-End Implementation

FlowCA is an Enterprise Application Integration (EAI) system that demonstrates **event-driven choreography** across multiple microservices using RabbitMQ as the message broker. Built with a **Test-Driven Development (TDD)** approach across 7 phases.

---

## Architecture Overview

```
                    ┌──────────────────────┐
                    │   API Gateway :3000   │  <- Content-Based Router
                    └──┬───────┬───────┬────┘
                       │       │       │
               /api/pos│       │/api/  │/api/crm
                       │       │inventory│
                       v       │       v
               ┌────────────┐  │  ┌──────────────┐
               │ POS Backend│  │  │  CRM Backend  │
               │   :3001    │  │  │    :3003      │
               └─────┬──────┘  │  └──────┬───────┘
                     │         │         │
                ┌────v────┐   │    ┌────v─────┐
                │  MySQL  │   │    │  MySQL   │
                │ (POS DB)│   │    │ (CRM DB) │
                └─────────┘   │    └──────────┘
                     │         │
               Publishes       │
               TRANSAKSI_      │
               SELESAI         │
                     v         │
           ┌──────────────────┴──────────────────┐
           │       RabbitMQ (flowca.events)       │
           │   exchange / topic / routing_key     │
           └─────────┬───────────────┬────────────┘
                     │               │
                     v               v
           ┌──────────────┐  ┌──────────────┐
           │ Accounting   │  │  Inventory   │
           │  (C# :5000)  │  │  (Node :3002)│
           └──────┬───────┘  └──────┬───────┘
                  │                 │
             ┌────v────┐     ┌─────v──────┐
             │ SQLite  │     │   MySQL    │
             │(Account)│     │(Inventory) │
             └─────────┘     └────────────┘
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
| **Frontends** | React 18, Vite 5, Axios |
| **Containerization** | Docker, Docker Compose |

---

## Prerequisites

- [Docker](https://www.docker.com/) (v20+ recommended)
- [Docker Compose](https://docs.docker.com/compose/) (v2+ recommended)
- ~4 GB free disk space (for Docker images)

---

## Getting Started

### 1. Create your `.env` file

```bash
cp .env.example .env
```

The defaults work out of the box for local development — no editing needed.

### 2. Build & Start Everything

```bash
docker compose up -d --build
```

This will:
1. Pull **RabbitMQ** (message broker) + **MySQL 8.0** (3 instances)
2. Build **8 Docker images** (backends, frontends, gateway, accounting)
3. Start **12 containers** with health checks and dependency ordering

> ⏱️ **First run** takes ~3-5 minutes (pulling base images + building .NET 10.0 SDK).

### 3. Wait for All Services to Be Healthy

```bash
docker compose ps
```

Wait until all services show `healthy` or `running`. The databases and RabbitMQ must pass health checks before backends start.

You can also verify the **RabbitMQ Management UI** at http://localhost:15672 (login: `guest` / `guest`) to confirm queues are bound.

### 4. Test the System

#### Web UIs

| What | URL |
|------|-----|
| **API Gateway** (main entry) | http://localhost:3000 |
| **RabbitMQ Management** | http://localhost:15672 (guest/guest) |
| **POS Frontend** (Cashier UI) | http://localhost:9080 |
| **Inventory Frontend** (Dashboard) | http://localhost:9081 |
| **CRM Frontend** (Reservations) | http://localhost:9082 |

#### Quick API Tests

```bash
# Health check via Gateway
curl http://localhost:3000/health

# Create a POS transaction (Steak M001)
curl -X POST http://localhost:3000/api/pos/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "items": [
      { "menu_id": "M001", "menu_name": "Steak", "qty": 2, "price": 50000 }
    ],
    "total_amount": 100000
  }'

# Get all ingredients (Inventory)
curl http://localhost:3000/api/inventory/ingredients

# Create a CRM reservation
curl -X POST http://localhost:3000/api/crm/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "party_size": 4,
    "reservation_time": "2026-06-10T19:00:00Z"
  }'
```

### 5. Run End-to-End Integration Tests

```bash
npm run test:e2e
```

This tests the full flow: **Gateway → POS saves → RabbitMQ → Inventory deducts stock + Accounting writes journal**.

---

## Running Tests Per Service

Each service has **unit tests** (no external deps) and **integration tests** (require a real database).

### Unit Tests (no Docker needed)

```bash
# POS Backend (45 tests)
cd pos-service/backend && npm test

# Inventory Backend (50 tests)
cd inventory-service/backend && npm test

# API Gateway (18 tests)
cd api-gateway && npm test

# CRM Backend (27 tests)
cd crm-service/backend && npm test

# Accounting Service (34 tests) — requires .NET 10.0 SDK
cd accounting-service/src/Accounting.Service && dotnet test
```

### Integration Tests (require MySQL on port 3307)

```bash
# Start a temporary MySQL container
docker run -d --name test-mysql -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=test_db -p 3307:3306 mysql:8.0

# POS integration tests (13 tests)
cd pos-service/backend && POS_DB_PORT=3307 POS_DB_NAME=pos_test_db npm run test:integration

# Inventory integration tests (12 tests)
cd inventory-service/backend && INVENTORY_DB_PORT=3307 INVENTORY_DB_NAME=inventory_test_db npm run test:integration

# CRM integration tests (12 tests)
cd crm-service/backend && CRM_DB_PORT=3307 CRM_DB_NAME=crm_test_db npm run test:integration

# Cleanup
docker rm -f test-mysql
```

---

## Stopping the System

```bash
docker compose down          # Stop containers (keep data volumes)
docker compose down -v       # Stop containers AND delete all data volumes
```

---

## Project Structure

```
project_EAI/
├── .env.example                    # Shared environment configuration
├── docker-compose.yml              # Full stack orchestration (12 containers)
├── pos-service/
│   ├── backend/                    # POS Backend (Node/Express/MySQL/RabbitMQ publisher)
│   └── frontend/                   # POS Cashier UI (React + Vite)
├── inventory-service/
│   ├── backend/                    # Inventory Backend (Node/Express/MySQL/RabbitMQ subscriber)
│   └── frontend/                   # Inventory Dashboard UI (React + Vite)
├── accounting-service/
│   └── src/Accounting.Service/     # Accounting Service (C# .NET 10.0/SQLite/RabbitMQ subscriber)
├── api-gateway/                    # API Gateway (Express, Content-Based Router)
├── crm-service/
│   ├── backend/                    # CRM Backend (Node/Express/MySQL)
│   └── frontend/                   # CRM Reservations UI (React + Vite)
├── tests/                          # E2E + Docker validation tests
└── docs/
    └── superpowers/plans/          # Master plan & design documents
```

---

## Event Flow (Choreography Pattern)

1. **POS** creates a transaction and publishes a `TRANSAKSI_SELESAI` event to RabbitMQ exchange `flowca.events`
2. **Inventory** subscribes to the event, resolves recipes (Bill of Materials), and deducts stock quantities
3. **Accounting** subscribes to the event, transforms JSON → CSV, applies idempotency checks, and writes journal entries (with DLQ for failed messages)

### Canonical Data Model (CDM) — the event contract:

```json
{
  "event_type": "TRANSAKSI_SELESAI",
  "transaction_id": "TXN-20260609-ab12",
  "source_system": "POS",
  "timestamp": "2026-06-09T10:30:00.000Z",
  "customer": { "name": "Walk-in Customer" },
  "items": [{ "menu_id": "M001", "menu_name": "Steak", "qty": 1, "price": 50000 }],
  "total_amount": 50000,
  "currency": "IDR",
  "trace_id": "trace-pos-ab12cd34"
}
```

---

## Ports Reference

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 3000 | http://localhost:3000 |
| POS Backend | 3001 | http://localhost:3001 |
| Inventory Backend | 3002 | http://localhost:3002 |
| CRM Backend | 3003 | http://localhost:3003 |
| Accounting Service | 5001 | (internal, no HTTP API) |
| RabbitMQ | 5672 | amqp://localhost:5672 |
| RabbitMQ Management | 15672 | http://localhost:15672 |
| POS MySQL | 3306 | localhost:3306 |
| Inventory MySQL | 3307 | localhost:3307 |
| CRM MySQL | 3308 | localhost:3308 |
| POS Frontend | 9080 | http://localhost:9080 |
| Inventory Frontend | 9081 | http://localhost:9081 |
| CRM Frontend | 9082 | http://localhost:9082 |

---

## License

This project is for educational purposes.
