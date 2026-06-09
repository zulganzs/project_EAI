# Master Plan — FlowCA EAI End-to-End Implementation

> **Approach:** Test-Driven Development (TDD). Each phase: **write test first -> verify it fails -> implement code -> verify test passes -> commit -> stop for review.**
>
> **Rule:** After every phase completes (tests green + feature working), I will **stop and tell you** so you can review. You must approve before I move to the next phase.

---

## Architecture Overview

```
                    ┌──────────────────────┐
                    │   API Gateway :3000   │  <- Phase 5
                    │  (Content-Based Router)│
                    └──┬───────┬───────┬────┘
                       │       │       │
              /api/pos │       │ /api/ │ /api/crm
                       v       │inventory│       v
              ┌────────────┐   │  ┌──────────────┐
              │ POS Backend│   │  │  CRM Backend  │
              │   :3001    │   │  │    :3003      │
              └─────┬──────┘   │  └──────┬───────┘
                    │          │         │
               ┌────v────┐    │    ┌────v─────┐
               │  MySQL  │    │    │  MySQL   │
               │ (POS DB)│    │    │ (CRM DB) │
               └─────────┘    │    └──────────┘
                    │          │
              Publishes        │
              TRANSAKSI_       │
              SELESAI          │
                    v          │
            ┌──────────────────┴──────────────────┐
            │         RabbitMQ (flowca.events)     │
            │    exchange / topic / routing_key    │
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

## Dependency Graph & Build Order

```
Phase 1: Shared Foundation (no dependencies)
  ├── 1A. Shared .env.example + folder structure
  └── 1B. Shared docker-compose.yml skeleton

Phase 2: POS Service (foundation - event producer)
  ├── 2A. Backend skeleton + health check (TDD)
  ├── 2B. Database config + schema (TDD)
  ├── 2C. Transaction service + ID generator + CDM (TDD)
  ├── 2D. API endpoints (TDD)
  └── 2E. RabbitMQ publisher + wiring (TDD)

Phase 3: Inventory Service (depends on POS CDM contract from Phase 2)
  ├── 3A. Backend skeleton + health check (TDD)
  ├── 3B. Database schema + CRUD ingredients (TDD)
  ├── 3C. Recipe/BOM model + seed data (TDD)
  ├── 3D. RabbitMQ subscriber (TDD)
  └── 3E. Stock deduction choreography logic (TDD)

Phase 4: Accounting Service (depends on POS CDM contract from Phase 2)
  ├── 4A. Project setup + configuration (TDD)
  ├── 4B. Domain models + EF context (TDD)
  ├── 4C. JSON to CSV message transformer (TDD)
  ├── 4D. Idempotency service + journal repository (TDD)
  └── 4E. RabbitMQ consumer with retry + DLQ (TDD)

Phase 5: API Gateway + CRM (depends on POS/Inventory/Accounting endpoints)
  ├── 5A. Gateway skeleton + health check (TDD)
  ├── 5B. Content-Based Router proxy (TDD)
  ├── 5C. CRM backend + DB (TDD)
  └── 5D. Gateway to CRM wiring (TDD)

Phase 6: React Frontends
  ├── 6A. POS Cashier UI
  ├── 6B. Inventory UI
  └── 6C. CRM Reservations UI

Phase 7: Dockerization & Integration
  ├── 7A. Dockerfiles for all services
  ├── 7B. Full docker-compose.yml
  └── 7C. End-to-end integration test
```

---

## Phase Details

### Phase 1 - Shared Foundation

**Goal:** Create the shared project skeleton and configuration that all services depend on.

**Files created:**
- `.env.example` (root - shared environment variables)
- `docker-compose.yml` (skeleton with RabbitMQ + placeholder services)
- Top-level folder structure

**Test:** Verify folder structure exists and docker-compose.yml is valid YAML.

---

### Phase 2 - POS Service (Event Producer)

**Goal:** Build the POS service that creates transactions and publishes TRANSAKSI_SELESAI events to RabbitMQ. This is built first because it defines the Canonical Data Model (CDM) that Inventory and Accounting depend on.

**Unit Tests (mocked DB/RabbitMQ — fast, no external deps):**

| Sub-phase | Test First | Implement | Verify |
|-----------|-----------|-----------|--------|
| 2A. Skeleton + /health | Test: GET /health returns 200 | Express app with /health | 2 tests pass |
| 2B. DB config + schema | Test: config reads env vars, pool exports functions, schema.sql validates | MySQL pool + transaction tables | 10 tests pass |
| 2C. Service + ID gen + CDM | Test: ID format + CDM payload shape | idGenerator.js + transaction.service.js | 14 tests pass |
| 2D. API endpoints | Test: POST /api/pos/transactions returns 201 (mocked DB) | Controller + routes | 12 tests pass |
| 2E. RabbitMQ publisher | Test: publishEvent() with mocked amqplib | eventPublisher.js + wire to service | 7 tests pass |

**Integration Tests (real MySQL on port 3307 — no mocks):**

| Test File | Tests | What it verifies |
|-----------|-------|-----------------|
| `tests/integration/schema.test.js` | 7 tests | Schema SQL creates tables, correct column types, UNIQUE constraint, FK constraint, INSERT/SELECT round-trip, duplicate rejection |
| `tests/integration/api.test.js` | 6 tests | POST persists to real DB, GET retrieves from real DB, POST→GET round-trip consistency, 404 handling, pool lifecycle, 100 concurrent POSTs with unique IDs |

**Run commands:**
```bash
# Unit tests only (no MySQL needed)
cd pos-service/backend && npm test

# Integration tests (requires MySQL on port 3307)
docker run -d --name pos-test-mysql -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=pos_test_db -p 3307:3306 mysql:8.0
cd pos-service/backend && POS_DB_PORT=3307 POS_DB_NAME=pos_test_db npm run test:integration

# All tests combined
cd pos-service/backend && POS_DB_PORT=3307 POS_DB_NAME=pos_test_db npm run test:all
```

**Files created:**
```
pos-service/backend/
├── package.json
├── src/
│   ├── app.js                        # Express app with /health + /api/pos routes
│   ├── server.js                     # Entry point: init pool, connect RabbitMQ, start server
│   ├── config/
│   │   ├── database.js               # DB config from env vars
│   │   ├── pool.js                   # MySQL connection pool (initPool, getConnection, closePool)
│   │   └── schema.sql                # transactions + transaction_items DDL
│   ├── controllers/
│   │   └── transaction.controller.js # createTransaction, getTransaction
│   ├── services/
│   │   └── transaction.service.js    # buildCDMPayload()
│   ├── routes/
│   │   └── transaction.routes.js     # POST/GET /transactions with validation
│   ├── utils/
│   │   └── idGenerator.js            # generateTransactionId() → TXN-YYYYMMDD-XXXX
│   └── messaging/
│       └── eventPublisher.js         # RabbitMQ publisher (connect, publishEvent, disconnect)
└── tests/
    ├── unit/                         # 45 tests (mocked DB/RabbitMQ)
    │   ├── health.test.js            # 2A
    │   ├── database.test.js          # 2B
    │   ├── transaction.test.js       # 2C
    │   ├── api.test.js               # 2D
    │   └── publisher.test.js         # 2E
    └── integration/                  # 13 tests (real MySQL, no mocks)
        ├── schema.test.js            # Schema validation against real DB
        └── api.test.js               # Full API round-trip against real DB
```

**Key CDM output (the contract other services depend on):**
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

### Phase 3 - Inventory Service (Event Subscriber - Choreography)

**Goal:** Build the Inventory service that subscribes to TRANSAKSI_SELESAI events and automatically deducts stock based on recipes/BOM.

| Sub-phase | Test First | Implement | Verify |
|-----------|-----------|-----------|--------|
| 3A. Skeleton + /health | Test: GET /health returns 200 | Express app | Test passes |
| 3B. DB schema + CRUD | Test: GET/POST /api/inventory/ingredients with mock DB | Schema + model + routes | Test passes |
| 3C. Recipe/BOM + seed | Test: recipe resolver returns ingredient list for menu_id | Recipe model + seed data | Test passes |
| 3D. RabbitMQ subscriber | Test: subscriber parses CDM payload and calls handler (mock) | subscriber.js | Test passes |
| 3E. Stock deduction | Test: given CDM items, stock decreases + audit log written | Deduction service + audit | Test passes |

**Unit Tests (mocked DB/RabbitMQ — fast, no external deps):**

| Sub-phase | Tests | What it verifies |
|-----------|-------|-----------------|
| 3A. Skeleton + /health | 2 tests | GET /health returns 200, valid ISO timestamp |
| 3B. DB config + schema | 13 tests | Config env vars, pool exports, schema tables/columns |
| 3B. Ingredient API | 12 tests | GET list, POST create, PATCH update, validation, error handling |
| 3C. Recipe resolver | 3 tests | Resolve menu→ingredients, unknown menu, empty recipe |
| 3C. Seed data | 5 tests | seed.sql exists, inserts ingredients, recipes, recipe_items |
| 3D. RabbitMQ subscriber | 5 tests | Exports, config from env vars |
| 3D. Subscriber mocked | 3 tests | Queue bind + consume, handler gets parsed CDM, nack on error |
| 3E. Stock deduction | 4 tests | Single item, multi item, skip no recipe, empty items |
| 3E. Deduction advanced | 3 tests | Aggregate same ingredient, audit log written, DB failure |

**Integration Tests (real MySQL on port 3307 — no mocks):**

| Test File | Tests | What it verifies |
|-----------|-------|-----------------|
| `tests/integration/schema.test.js` | 6 tests | Schema creates tables, INSERT/SELECT, FK constraints, stock decrement, seed.sql execution |
| `tests/integration/api.test.js` | 6 tests | POST persists, GET retrieves, PATCH updates, round-trip consistency, 404 handling, pool lifecycle |

**Run commands:**
```bash
# Unit tests only (no MySQL needed)
cd inventory-service/backend && npm test

# Integration tests (requires MySQL on port 3307)
docker run -d --name inventory-test-mysql -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=inventory_test_db -p 3307:3306 mysql:8.0
cd inventory-service/backend && INVENTORY_DB_PORT=3307 INVENTORY_DB_NAME=inventory_test_db npm run test:integration

# All tests combined
cd inventory-service/backend && INVENTORY_DB_PORT=3307 INVENTORY_DB_NAME=inventory_test_db npm run test:all
```

**Files created:**
```
inventory-service/backend/
├── package.json
├── src/
│   ├── app.js                        # Express app with /health + /api/inventory routes
│   ├── server.js                     # Entry point: init pool, connect RabbitMQ, subscribe, start server
│   ├── config/
│   │   ├── database.js               # DB config from env vars
│   │   ├── pool.js                   # MySQL connection pool (initPool, getConnection, closePool)
│   │   └── schema.sql                # ingredients + recipes + recipe_items + stock_movements DDL
│   ├── routes/
│   │   └── ingredient.routes.js      # GET/POST/PATCH /ingredients
│   ├── services/
│   │   ├── recipe.service.js         # resolveRecipe(menu_id) → ingredient list
│   │   └── deduction.service.js      # processTransactionEvent(cdm) → stock deduction + audit
│   ├── seed/
│   │   └── seed.sql                  # Demo data: Steak (M001), Nasi Goreng (M002) with BOM
│   └── messaging/
│       └── subscriber.js             # RabbitMQ subscriber (connect, subscribe, disconnect)
└── tests/
    ├── unit/                         # 50 tests (mocked DB/RabbitMQ)
    │   ├── health.test.js            # 3A
    │   ├── database.test.js          # 3B
    │   ├── ingredient-api.test.js    # 3B
    │   ├── recipe.test.js            # 3C
    │   ├── subscriber.test.js        # 3D
    │   ├── deduction.test.js         # 3E
    │   └── deduction-advanced.test.js # 3E
    └── integration/                  # 12 tests (real MySQL, no mocks)
        ├── schema.test.js            # Schema validation + seed data against real DB
        └── api.test.js               # Full API round-trip against real DB
```

---

### Phase 4 - Accounting Service (Event Subscriber - Resilience)

**Goal:** Build the Accounting service in C# that subscribes to events, transforms JSON to CSV, applies idempotency, and handles retries with DLQ.

| Sub-phase | Test First | Implement | Verify |
|-----------|-----------|-----------|--------|
| 4A. Project setup | Test: project restores + builds | .csproj + config | Build passes |
| 4B. Domain models + EF | Test: TransactionEvent deserializes CDM JSON correctly | Models + AccountingDbContext | Test passes |
| 4C. JSON to CSV transformer | Test: TransformToCsv() produces correct CSV | MessageTransformer.cs | Test passes |
| 4D. Idempotency + repo | Test: HasBeenProcessedAsync false -> MarkAsProcessedAsync -> true | Services + repository | Test passes |
| 4E. RabbitMQ consumer | Test: compilation (consumer needs live RabbitMQ) | RabbitMqConsumer.cs + Program.cs | Build passes |

---

### Phase 5 - API Gateway + CRM Service

**Goal:** Build the API Gateway (Content-Based Router) and CRM reservation service.

| Sub-phase | Test First | Implement | Verify |
|-----------|-----------|-----------|--------|
| 5A. Gateway skeleton + /health | Test: GET /health returns 200 | Express app with proxy middleware | Test passes |
| 5B. Content-Based Router | Test: /api/pos/* proxies to mock POS, /api/crm/* to mock CRM | http-proxy-middleware routes | Test passes |
| 5C. CRM backend + DB | Test: POST/GET /api/crm/reservations with mock DB | Schema + model + routes | Test passes |
| 5D. Gateway to CRM wiring | Test: Gateway /api/crm/reservations reaches CRM | Full proxy chain | Test passes |

---

### Phase 6 - React Frontends

**Goal:** Build simple React UIs for POS, Inventory, and CRM.

| Sub-phase | Description |
|-----------|-------------|
| 6A. POS Cashier UI | Menu list -> cart -> submit -> shows transaction ID |
| 6B. Inventory UI | View ingredients + stock -> update stock |
| 6C. CRM UI | List reservations -> create -> update status |

---

### Phase 7 - Dockerization & Integration

**Goal:** Containerize everything and verify end-to-end flow.

| Sub-phase | Description |
|-----------|-------------|
| 7A. Dockerfiles | Backend Dockerfile per service + frontend Dockerfiles |
| 7B. Full docker-compose | RabbitMQ + MySQL instances + all services + volumes |
| 7C. End-to-end test | POST via Gateway -> POS saves -> RabbitMQ -> Inventory deducts + Accounting journals |

---

## Execution Rules

1. **TDD Discipline:** Every sub-phase starts with writing a test. I verify it fails (red), then implement, then verify it passes (green), then commit.
2. **Stop & Review:** After each **Phase** (not sub-phase), I stop and report to you. You review and approve before I continue.
3. **No Hardcoding:** All configuration via environment variables.
4. **CDM Contract:** Phase 2 (POS) must complete first since it defines the event schema that Phase 3 and 4 depend on.
5. **Working Directory:** All code is created in `/Users/user/Desktop/project_EAI/` on `main` branch.
6. **Two-Tier Testing:** Each service phase has **unit tests** (mocked DB/RabbitMQ in `tests/unit/`) AND **integration tests** (real MySQL/containers in `tests/integration/`). Unit tests run without external deps. Integration tests require Docker MySQL on port 3307 (`npm run test:integration`).

---

## Current Status

- [x] Phase 1: Shared Foundation ✅ (51 tests passing, committed 06692d2)
- [x] Phase 2: POS Service ✅ (45 unit + 13 integration = 58 tests, committed 61abaa2 + c76b6ff)
- [x] Phase 3: Inventory Service ✅ (50 unit + 12 integration tests, TDD)
- [ ] Phase 4: Accounting Service
- [ ] Phase 5: API Gateway + CRM
- [ ] Phase 6: React Frontends
- [ ] Phase 7: Dockerization & Integration
