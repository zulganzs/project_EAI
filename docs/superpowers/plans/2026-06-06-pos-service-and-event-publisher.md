# POS Service & Transaction Event Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js/React Point of Sales (POS) service that records customer transactions, generates unique transaction IDs, saves to MySQL, and reliably publishes Canonical Data Model (CDM) events to RabbitMQ.

**Architecture:** A monolithic-style full-stack service within a microservices ecosystem. It consists of a React frontend for the cashier, an Express.js backend API, a MySQL database for local persistence, and an amqplib-based RabbitMQ publisher. Transaction persistence and event publishing must be sequenced (save first, then publish). 

**Tech Stack:** 
- Backend: Node.js, Express, MySQL2, amqplib, uuid
- Frontend: React (Vite), Axios
- Testing: Jest, Supertest
- DevOps: Docker, Docker Compose

---

## Project Structure

This plan creates the following structure:

```
pos-service/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── rabbitmq.js
│   │   ├── controllers/
│   │   │   └── transaction.controller.js
│   │   ├── services/
│   │   │   └── transaction.service.js
│   │   ├── routes/
│   │   │   └── transaction.routes.js
│   │   ├── models/
│   │   │   └── transaction.model.js
│   │   ├── messaging/
│   │   │   └── eventPublisher.js
│   │   ├── utils/
│   │   │   └── idGenerator.js
│   │   └── app.js
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── CashierPOS.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.jsx
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

---

## Task 1: Backend Foundation Setup

**Files:**
- Create: `pos-service/backend/package.json`
- Create: `pos-service/backend/.env.example`
- Create: `pos-service/backend/src/app.js`
- Create: `pos-service/backend/tests/unit/app.test.js`

- [ ] **Step 1: Initialize Backend Project and Install Dependencies**

```bash
mkdir -p pos-service/backend/src/{config,controllers,services,routes,models,messaging,utils}
mkdir -p pos-service/backend/tests/{unit,integration}
cd pos-service/backend
npm init -y
npm install express cors dotenv mysql2 amqplib uuid
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 2: Create .env.example file**

Create `pos-service/backend/.env.example`:

```bash
PORT=3001
POS_DB_HOST=localhost
POS_DB_PORT=3306
POS_DB_NAME=pos_db
POS_DB_USER=root
POS_DB_PASSWORD=secret
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_EXCHANGE=flowca.events
RABBITMQ_ROUTING_KEY=transaction.completed
```

- [ ] **Step 3: Setup Jest Configuration**

Update `pos-service/backend/package.json` to add test scripts:

```json
{
  "name": "pos-service-backend",
  "version": "1.0.0",
  "description": "POS Service Backend",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest"
  },
  "dependencies": {
    "amqplib": "^0.10.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mysql2": "^3.6.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.1",
    "supertest": "^6.3.3"
  }
}
```

- [ ] **Step 4: Write Health Check Test**

Create `pos-service/backend/tests/unit/app.test.js`:

```javascript
const request = require('supertest');
const app = require('../../src/app');

describe('App Health Check', () => {
  it('should return 200 OK on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'UP');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd pos-service/backend && npm test`
Expected: FAIL due to missing app module

- [ ] **Step 6: Implement App and Health Check**

Create `pos-service/backend/src/app.js`:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

module.exports = app;
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd pos-service/backend && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add pos-service/backend/
git commit -m "feat(pos): initialize backend with health check"
```

---

## Task 2: Database Configuration and Schema

**Files:**
- Create: `pos-service/backend/src/config/database.js`
- Create: `pos-service/backend/src/models/transaction.model.js`
- Create: `pos-service/backend/tests/integration/db.test.js`

- [ ] **Step 1: Write Database Connection Mock Test**

Create `pos-service/backend/tests/integration/db.test.js`:

```javascript
const db = require('../../src/config/database');

jest.mock('mysql2/promise', () => {
  return {
    createPool: jest.fn(() => ({
      query: jest.fn().mockResolvedValue([[{ '1': 1 }]]),
      end: jest.fn()
    }))
  };
});

describe('Database Configuration', () => {
  it('should be able to execute a query', async () => {
    const [rows] = await db.query('SELECT 1');
    expect(rows).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pos-service/backend && npm test`
Expected: FAIL due to missing config/database

- [ ] **Step 3: Implement Database Config**

Create `pos-service/backend/src/config/database.js`:

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.POS_DB_HOST || 'localhost',
  port: process.env.POS_DB_PORT || 3306,
  user: process.env.POS_DB_USER || 'root',
  password: process.env.POS_DB_PASSWORD || 'secret',
  database: process.env.POS_DB_NAME || 'pos_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pos-service/backend && npm test`
Expected: PASS

- [ ] **Step 5: Implement Transaction Schema Management**

Create `pos-service/backend/src/models/transaction.model.js`:

```javascript
const db = require('../config/database');

class TransactionModel {
  static async initTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(100),
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const itemsQuery = `
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(50) NOT NULL,
        menu_id VARCHAR(50) NOT NULL,
        menu_name VARCHAR(100) NOT NULL,
        qty INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
      )
    `;
    
    try {
      await db.query(query);
      await db.query(itemsQuery);
      console.log('Database tables initialized');
    } catch (err) {
      console.error('Error initializing tables', err);
    }
  }

  static async save(transactionData, items) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      const [txnResult] = await connection.query(
        'INSERT INTO transactions (transaction_id, customer_name, total_amount) VALUES (?, ?, ?)',
        [transactionData.transaction_id, transactionData.customer_name, transactionData.total_amount]
      );

      for (const item of items) {
        await connection.query(
          'INSERT INTO transaction_items (transaction_id, menu_id, menu_name, qty, price) VALUES (?, ?, ?, ?, ?)',
          [transactionData.transaction_id, item.menu_id, item.menu_name, item.qty, item.price]
        );
      }

      await connection.commit();
      return txnResult;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = TransactionModel;
```

- [ ] **Step 6: Commit**

```bash
git add pos-service/backend/src/config pos-service/backend/src/models pos-service/backend/tests
git commit -m "feat(pos): setup mysql database connection and schema"
```

---

## Task 3: Transaction Service & ID Generator

**Files:**
- Create: `pos-service/backend/src/utils/idGenerator.js`
- Create: `pos-service/backend/src/services/transaction.service.js`
- Create: `pos-service/backend/tests/unit/transaction.service.test.js`

- [ ] **Step 1: Write test for ID generation and formatting**

Create `pos-service/backend/tests/unit/transaction.service.test.js`:

```javascript
const { generateTransactionId, formatCdmPayload } = require('../../src/utils/idGenerator');

describe('Utils', () => {
  it('should generate valid transaction ID', () => {
    const txId = generateTransactionId();
    expect(txId).toMatch(/^TXN-\d{8}-[a-f0-9]{4}$/);
  });

  it('should format Canonical Data Model correctly', () => {
    const txData = {
      transaction_id: 'TXN-20260606-1234',
      customer_name: 'Walk-in',
      total_amount: 50000,
      items: [{ menu_id: 'M01', menu_name: 'Steak', qty: 1, price: 50000 }]
    };

    const cdm = formatCdmPayload(txData);
    
    expect(cdm.event_type).toBe('TRANSAKSI_SELESAI');
    expect(cdm.source_system).toBe('POS');
    expect(cdm.transaction_id).toBe('TXN-20260606-1234');
    expect(cdm.customer.name).toBe('Walk-in');
    expect(cdm.currency).toBe('IDR');
    expect(cdm.items.length).toBe(1);
    expect(cdm.total_amount).toBe(50000);
    expect(cdm.trace_id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pos-service/backend && npm test`
Expected: FAIL due to missing utils

- [ ] **Step 3: Implement ID Generator and CDM formatter**

Create `pos-service/backend/src/utils/idGenerator.js`:

```javascript
const { v4: uuidv4 } = require('uuid');

const generateTransactionId = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const shortUuid = uuidv4().slice(0, 4);
  return `TXN-${date}-${shortUuid}`;
};

const formatCdmPayload = (data) => {
  return {
    event_type: "TRANSAKSI_SELESAI",
    transaction_id: data.transaction_id,
    source_system: "POS",
    timestamp: new Date().toISOString(),
    customer: {
      name: data.customer_name || "Walk-in Customer"
    },
    items: data.items.map(item => ({
      menu_id: item.menu_id,
      menu_name: item.menu_name,
      qty: item.qty,
      price: item.price
    })),
    total_amount: data.total_amount,
    currency: "IDR",
    trace_id: `trace-pos-${uuidv4().slice(0, 8)}`
  };
};

module.exports = { generateTransactionId, formatCdmPayload };
```

- [ ] **Step 4: Create Transaction Service**

Create `pos-service/backend/src/services/transaction.service.js`:

```javascript
const TransactionModel = require('../models/transaction.model');
const { generateTransactionId, formatCdmPayload } = require('../utils/idGenerator');
// Publisher will be injected or imported later

class TransactionService {
  static async processTransaction(reqData) {
    const txId = generateTransactionId();
    
    const txData = {
      transaction_id: txId,
      customer_name: reqData.customer_name,
      total_amount: reqData.total_amount
    };
    
    // Save to database
    await TransactionModel.save(txData, reqData.items);
    
    // Create payload
    const fullData = { ...txData, items: reqData.items };
    const cdmPayload = formatCdmPayload(fullData);
    
    return cdmPayload;
  }
}

module.exports = TransactionService;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd pos-service/backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pos-service/backend/src/utils pos-service/backend/src/services pos-service/backend/tests
git commit -m "feat(pos): implement transaction service, ID generator and CDM mapping"
```

---

## Task 4: RabbitMQ Publisher

**Files:**
- Create: `pos-service/backend/src/config/rabbitmq.js`
- Create: `pos-service/backend/src/messaging/eventPublisher.js`
- Modify: `pos-service/backend/src/services/transaction.service.js`
- Create: `pos-service/backend/tests/unit/eventPublisher.test.js`

- [ ] **Step 1: Write test for Publisher**

Create `pos-service/backend/tests/unit/eventPublisher.test.js`:

```javascript
const { publishEvent } = require('../../src/messaging/eventPublisher');

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
    }),
    close: jest.fn(),
    on: jest.fn()
  })
}));

describe('Event Publisher', () => {
  it('should publish message without errors', async () => {
    const payload = { event_type: 'TEST' };
    await expect(publishEvent(payload)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pos-service/backend && npm test`
Expected: FAIL due to missing module

- [ ] **Step 3: Implement RabbitMQ Config and Publisher**

Create `pos-service/backend/src/config/rabbitmq.js`:

```javascript
require('dotenv').config();
const amqp = require('amqplib');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  if (channel) return channel;
  
  try {
    const user = process.env.RABBITMQ_USER || 'guest';
    const pass = process.env.RABBITMQ_PASSWORD || 'guest';
    const host = process.env.RABBITMQ_HOST || 'localhost';
    const port = process.env.RABBITMQ_PORT || 5672;
    
    connection = await amqp.connect(`amqp://${user}:${pass}@${host}:${port}`);
    channel = await connection.createChannel();
    
    const exchange = process.env.RABBITMQ_EXCHANGE || 'flowca.events';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    
    console.log('RabbitMQ Connected');
    return channel;
  } catch (err) {
    console.error('RabbitMQ Connection Error:', err);
    throw err;
  }
};

module.exports = { connectRabbitMQ };
```

Create `pos-service/backend/src/messaging/eventPublisher.js`:

```javascript
const { connectRabbitMQ } = require('../config/rabbitmq');
require('dotenv').config();

const publishEvent = async (payload) => {
  try {
    const channel = await connectRabbitMQ();
    const exchange = process.env.RABBITMQ_EXCHANGE || 'flowca.events';
    const routingKey = process.env.RABBITMQ_ROUTING_KEY || 'transaction.completed';
    
    const messageBuffer = Buffer.from(JSON.stringify(payload));
    
    channel.publish(exchange, routingKey, messageBuffer, {
      persistent: true,
      messageId: payload.transaction_id,
      contentType: 'application/json'
    });
    
    console.log(`Event published to ${exchange}/${routingKey}: ${payload.transaction_id}`);
    return true;
  } catch (err) {
    console.error('Failed to publish event:', err);
    // Ideally queue for retry or alert
    throw err;
  }
};

module.exports = { publishEvent };
```

- [ ] **Step 4: Wire Publisher to Transaction Service**

Modify `pos-service/backend/src/services/transaction.service.js` to add the import and call it:

```javascript
const TransactionModel = require('../models/transaction.model');
const { generateTransactionId, formatCdmPayload } = require('../utils/idGenerator');
const { publishEvent } = require('../messaging/eventPublisher');

class TransactionService {
  static async processTransaction(reqData) {
    const txId = generateTransactionId();
    
    const txData = {
      transaction_id: txId,
      customer_name: reqData.customer_name,
      total_amount: reqData.total_amount
    };
    
    // 1. Save to database
    await TransactionModel.save(txData, reqData.items);
    
    // 2. Format CDM
    const fullData = { ...txData, items: reqData.items };
    const cdmPayload = formatCdmPayload(fullData);
    
    // 3. Publish Event
    await publishEvent(cdmPayload);
    
    return cdmPayload;
  }
}

module.exports = TransactionService;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd pos-service/backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pos-service/backend/src/config/rabbitmq.js pos-service/backend/src/messaging pos-service/backend/src/services pos-service/backend/tests
git commit -m "feat(pos): implement RabbitMQ publisher and wire to transaction service"
```

---

## Task 5: API Endpoints

**Files:**
- Create: `pos-service/backend/src/controllers/transaction.controller.js`
- Create: `pos-service/backend/src/routes/transaction.routes.js`
- Modify: `pos-service/backend/src/app.js`
- Create: `pos-service/backend/tests/integration/api.test.js`

- [ ] **Step 1: Write integration test for the API**

Create `pos-service/backend/tests/integration/api.test.js`:

```javascript
const request = require('supertest');
const app = require('../../src/app');

// Mock dependencies
jest.mock('../../src/models/transaction.model', () => ({
  save: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/messaging/eventPublisher', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}));

describe('POST /api/pos/transactions', () => {
  it('should create a transaction and return 201', async () => {
    const payload = {
      customer_name: "Test User",
      total_amount: 150000,
      items: [
        { menu_id: "M01", menu_name: "Burger", qty: 2, price: 50000 },
        { menu_id: "D01", menu_name: "Coke", qty: 2, price: 25000 }
      ]
    };

    const res = await request(app)
      .post('/api/pos/transactions')
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transaction_id).toBeDefined();
    expect(res.body.data.event_type).toBe('TRANSAKSI_SELESAI');
  });

  it('should return 400 if validation fails', async () => {
    const payload = { customer_name: "No Items" };
    const res = await request(app).post('/api/pos/transactions').send(payload);
    expect(res.statusCode).toEqual(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pos-service/backend && npm test`
Expected: FAIL due to 404 on the endpoint

- [ ] **Step 3: Implement Controller and Routes**

Create `pos-service/backend/src/controllers/transaction.controller.js`:

```javascript
const TransactionService = require('../services/transaction.service');

const createTransaction = async (req, res) => {
  try {
    const { items, total_amount } = req.body;
    
    // Basic validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }
    
    if (total_amount === undefined || total_amount < 0) {
      return res.status(400).json({ success: false, message: 'Valid total_amount is required' });
    }

    const result = await TransactionService.processTransaction(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Transaction processed and published',
      data: result
    });
  } catch (error) {
    console.error('Transaction Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process transaction',
      error: error.message
    });
  }
};

module.exports = { createTransaction };
```

Create `pos-service/backend/src/routes/transaction.routes.js`:

```javascript
const express = require('express');
const { createTransaction } = require('../controllers/transaction.controller');

const router = express.Router();

router.post('/', createTransaction);

module.exports = router;
```

Modify `pos-service/backend/src/app.js` to register the routes:

```javascript
const express = require('express');
const cors = require('cors');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.use('/api/pos/transactions', transactionRoutes);

module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pos-service/backend && npm test`
Expected: PASS

- [ ] **Step 5: Add Server boot script (index.js or update app.js)**

Create `pos-service/backend/src/server.js` (for running without supertest):

```javascript
require('dotenv').config();
const app = require('./app');
const TransactionModel = require('./models/transaction.model');

const PORT = process.env.PORT || 3001;

// Init DB and start server
TransactionModel.initTable().then(() => {
  app.listen(PORT, () => {
    console.log(`POS Service running on port ${PORT}`);
  });
});
```

Update `package.json` "start" and "dev" scripts to point to `src/server.js`.

- [ ] **Step 6: Commit**

```bash
git add pos-service/backend/src/controllers pos-service/backend/src/routes pos-service/backend/src/app.js pos-service/backend/src/server.js pos-service/backend/package.json pos-service/backend/tests
git commit -m "feat(pos): add transaction API endpoint and server boot script"
```

---

## Task 6: React Frontend setup and Cashier UI

**Files:**
- Create: `pos-service/frontend/package.json`
- Create: `pos-service/frontend/vite.config.js`
- Create: `pos-service/frontend/src/App.jsx`
- Create: `pos-service/frontend/src/components/CashierPOS.jsx`

- [ ] **Step 1: Setup React via Vite**

```bash
cd pos-service
npm create vite@latest frontend -- --template react
cd frontend
npm install axios
```

- [ ] **Step 2: Create the Cashier UI Component**

Create `pos-service/frontend/src/components/CashierPOS.jsx`:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const MOCK_MENU = [
  { id: 'M001', name: 'Steak', price: 50000 },
  { id: 'M002', name: 'Fried Rice', price: 25000 },
  { id: 'D001', name: 'Ice Tea', price: 10000 }
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/pos/transactions';

export default function CashierPOS() {
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState('');

  const addToCart = (item) => {
    const existing = cart.find(c => c.menu_id === item.id);
    if (existing) {
      setCart(cart.map(c => c.menu_id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { menu_id: item.id, menu_name: item.name, price: item.price, qty: 1 }]);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    setStatus('Processing...');
    
    try {
      const payload = {
        customer_name: customerName || 'Walk-in',
        items: cart,
        total_amount: totalAmount
      };
      
      const res = await axios.post(API_URL, payload);
      setStatus(`Success! Transaction ID: ${res.data.data.transaction_id}`);
      setCart([]);
      setCustomerName('');
    } catch (err) {
      setStatus(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>POS System</h1>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
          <h2>Menu</h2>
          {MOCK_MENU.map(item => (
            <div key={item.id} style={{ margin: '10px 0' }}>
              <span>{item.name} - Rp {item.price}</span>
              <button onClick={() => addToCart(item)} style={{ marginLeft: '10px' }}>Add</button>
            </div>
          ))}
        </div>
        
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
          <h2>Current Order</h2>
          <input 
            type="text" 
            placeholder="Customer Name" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
            style={{ marginBottom: '10px', display: 'block' }}
          />
          {cart.map((item, idx) => (
            <div key={idx}>
              {item.menu_name} x {item.qty} = Rp {item.price * item.qty}
            </div>
          ))}
          <h3>Total: Rp {totalAmount}</h3>
          <button onClick={handleSubmit} disabled={cart.length === 0} style={{ padding: '10px', background: 'green', color: 'white' }}>
            Submit Transaction
          </button>
          {status && <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{status}</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render it in App**

Modify `pos-service/frontend/src/App.jsx`:

```jsx
import CashierPOS from './components/CashierPOS'

function App() {
  return (
    <div>
      <CashierPOS />
    </div>
  )
}

export default App
```

- [ ] **Step 4: Commit**

```bash
git add pos-service/frontend/
git commit -m "feat(pos): build React UI for cashier terminal"
```

---

## Task 7: Dockerization

**Files:**
- Create: `pos-service/backend/Dockerfile`
- Create: `pos-service/frontend/Dockerfile`
- Create: `pos-service/docker-compose.yml`

- [ ] **Step 1: Backend Dockerfile**

Create `pos-service/backend/Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

- [ ] **Step 2: Frontend Dockerfile**

Create `pos-service/frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Docker Compose Setup**

Create `pos-service/docker-compose.yml`:

```yaml
version: '3.8'

services:
  pos-mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: pos_db
    ports:
      - "3306:3306"
    volumes:
      - pos_mysql_data:/var/lib/mysql

  pos-rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"

  pos-backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - POS_DB_HOST=pos-mysql
      - POS_DB_PORT=3306
      - POS_DB_NAME=pos_db
      - POS_DB_USER=root
      - POS_DB_PASSWORD=secret
      - RABBITMQ_HOST=pos-rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=guest
      - RABBITMQ_PASSWORD=guest
      - RABBITMQ_EXCHANGE=flowca.events
      - RABBITMQ_ROUTING_KEY=transaction.completed
    depends_on:
      - pos-mysql
      - pos-rabbitmq

  pos-frontend:
    build: ./frontend
    ports:
      - "8080:80"
    environment:
      - VITE_API_URL=http://localhost:3001/api/pos/transactions

volumes:
  pos_mysql_data:
```

- [ ] **Step 4: Commit**

```bash
git add pos-service/backend/Dockerfile pos-service/frontend/Dockerfile pos-service/docker-compose.yml
git commit -m "build(pos): add Dockerfiles and docker-compose orchestration"
```
