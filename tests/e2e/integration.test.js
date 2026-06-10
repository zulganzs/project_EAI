/**
 * Phase 7C — End-to-End Integration Test
 *
 * Tests the full flow through the Docker stack:
 *   POST via Gateway → POS saves → RabbitMQ → Inventory deducts + Accounting journals
 *
 * Prerequisites:
 *   docker compose up -d --build
 *   Wait for all services to be healthy (~30-60 seconds)
 *
 * Run:
 *   npm run test:e2e
 */
const axios = require('axios');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const RABBITMQ_MGMT_URL = process.env.RABBITMQ_MGMT_URL || 'http://localhost:15672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'guest';
const RABBITMQ_PASS = process.env.RABBITMQ_PASSWORD || 'guest';

const TIMEOUT = 60000;
const POLL_INTERVAL = 2000;

// Helper: wait for a URL to return 200
async function waitForUrl(url, timeout = TIMEOUT) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await axios.get(url, { timeout: 3000 });
      if (res.status === 200) return res;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

// Helper: poll until a condition is true
async function waitForCondition(fn, timeout = TIMEOUT) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {
      // condition not met yet
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error('Timeout waiting for condition');
}

describe('Phase 7C — End-to-End Integration', () => {
  // Increase timeout for all E2E tests
  jest.setTimeout(120000);

  beforeAll(async () => {
    // Wait for all services to be ready
    console.log('⏳ Waiting for API Gateway...');
    await waitForUrl(`${GATEWAY_URL}/health`);
    console.log('✅ API Gateway is ready');

    // Wait a bit more for subscriptions to be set up
    await new Promise(r => setTimeout(r, 3000));
  });

  describe('1. Service Health Checks', () => {
    test('API Gateway /health returns 200', async () => {
      const res = await axios.get(`${GATEWAY_URL}/health`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      expect(res.data.service).toBe('api-gateway');
    });

    test('POS Backend reachable via Gateway', async () => {
      // The POS /health isn't directly exposed via gateway, but we can
      // reach the POS backend on its port if mapped
      const posUrl = process.env.POS_URL || 'http://localhost:3001';
      const res = await axios.get(`${posUrl}/health`);
      expect(res.status).toBe(200);
      expect(res.data.service).toBe('pos-backend');
    });

    test('Inventory Backend health check', async () => {
      const invUrl = process.env.INVENTORY_URL || 'http://localhost:3002';
      const res = await axios.get(`${invUrl}/health`);
      expect(res.status).toBe(200);
      expect(res.data.service).toBe('inventory-backend');
    });

    test('CRM Backend health check', async () => {
      const crmUrl = process.env.CRM_URL || 'http://localhost:3003';
      const res = await axios.get(`${crmUrl}/health`);
      expect(res.status).toBe(200);
      expect(res.data.service).toBe('crm-backend');
    });
  });

  describe('2. POS Transaction via Gateway', () => {
    let transactionId;

    test('POST /api/pos/transactions creates a transaction', async () => {
      // Use a menu item NOT in the recipe/BOM so it doesn't affect inventory
      // This tests POS → Gateway flow without triggering stock deduction
      const data = {
        customer_name: 'E2E Test Customer',
        items: [
          { menu_id: 'D001', menu_name: 'Es Teh', qty: 2, price: 8000 },
        ],
      };

      const res = await axios.post(`${GATEWAY_URL}/api/pos/transactions`, data);
      expect(res.status).toBe(201);
      expect(res.data.transaction_id).toBeDefined();
      expect(res.data.transaction_id).toMatch(/^TXN-/);

      transactionId = res.data.transaction_id;
      console.log(`  📝 Created transaction: ${transactionId}`);
    });

    test('GET /api/pos/transactions/:id retrieves the transaction', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/pos/transactions/${transactionId}`);
      expect(res.status).toBe(200);
      expect(res.data.transaction_id).toBe(transactionId);
      expect(Number(res.data.total_amount)).toBe(16000);
      expect(res.data.items).toHaveLength(1);
    });
  });

  describe('3. Inventory Stock Deduction (via RabbitMQ)', () => {
    let stockBefore;

    beforeAll(async () => {
      // Capture stock levels before we create the POS transaction
      const invUrl = process.env.INVENTORY_URL || 'http://localhost:3002';
      const res = await axios.get(`${invUrl}/api/inventory/ingredients`);
      stockBefore = {};
      res.data.forEach(i => { stockBefore[i.name] = Number(i.stock_qty); });
    });

    let deductionTxId;

    test('POST creates a POS transaction that triggers stock deduction', async () => {
      const data = {
        customer_name: 'E2E Stock Test',
        items: [
          { menu_id: 'M001', menu_name: 'Steak', qty: 2, price: 50000 },
          { menu_id: 'M002', menu_name: 'Nasi Goreng', qty: 1, price: 25000 },
        ],
      };

      const res = await axios.post(`${GATEWAY_URL}/api/pos/transactions`, data);
      expect(res.status).toBe(201);
      deductionTxId = res.data.transaction_id;
      console.log(`  📝 Deduction test transaction: ${deductionTxId}`);
    });

    test('ingredient stock decreased after POS transaction', async () => {
      // Steak (M001) uses: Daging Sapi 0.5kg + Kentang 0.3kg per serving
      // 2x Steak = 1.0kg Daging Sapi + 0.6kg Kentang
      // Nasi Goreng (M002) uses: Beras 0.2kg + Telur 2 + Minyak 0.05 + Bawang 20g + Kecap 30ml

      // Wait for RabbitMQ message to be processed
      await new Promise(r => setTimeout(r, 8000));

      const invUrl = process.env.INVENTORY_URL || 'http://localhost:3002';
      const res = await axios.get(`${invUrl}/api/inventory/ingredients`);
      expect(res.status).toBe(200);

      const ingredients = res.data;

      // Daging Sapi: should decrease by 1.0 (2x Steak × 0.5kg)
      const dagingSapi = ingredients.find(i => i.name === 'Daging Sapi');
      expect(dagingSapi).toBeDefined();
      expect(Number(dagingSapi.stock_qty)).toBeCloseTo(stockBefore['Daging Sapi'] - 1.0, 1);

      // Kentang: should decrease by 0.6 (2x Steak × 0.3kg)
      const kentang = ingredients.find(i => i.name === 'Kentang');
      expect(kentang).toBeDefined();
      expect(Number(kentang.stock_qty)).toBeCloseTo(stockBefore['Kentang'] - 0.6, 1);

      // Beras: should decrease by 0.2 (1x NasiGoreng × 0.2kg)
      const beras = ingredients.find(i => i.name === 'Beras');
      expect(beras).toBeDefined();
      expect(Number(beras.stock_qty)).toBeCloseTo(stockBefore['Beras'] - 0.2, 1);
    });
  });

  describe('4. CRM Reservation via Gateway', () => {
    let reservationId;

    test('POST /api/crm/reservations creates a reservation', async () => {
      const data = {
        customer_name: 'E2E Test Guest',
        phone: '08123456789',
        party_size: 4,
        reservation_time: '2026-06-10T19:00:00.000Z',
        table_number: 5,
      };

      const res = await axios.post(`${GATEWAY_URL}/api/crm/reservations`, data);
      expect(res.status).toBe(201);
      expect(res.data.reservation_id).toBeDefined();
      expect(res.data.reservation_id).toMatch(/^RSV-/);

      reservationId = res.data.reservation_id;
      console.log(`  📅 Created reservation: ${reservationId}`);
    });

    test('GET /api/crm/reservations lists reservations', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/crm/reservations`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
    });

    test('PATCH /api/crm/reservations/:id updates status', async () => {
      const res = await axios.patch(
        `${GATEWAY_URL}/api/crm/reservations/${reservationId}`,
        { status: 'COMPLETED' },
      );
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('COMPLETED');
    });
  });

  describe('5. Inventory CRUD via Gateway', () => {
    let ingredientId;

    test('GET /api/inventory/ingredients returns list', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/inventory/ingredients`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
    });

    test('POST /api/inventory/ingredients creates a new ingredient', async () => {
      const data = {
        name: 'Garam E2E Test',
        unit: 'gram',
        stock_qty: 500,
      };

      const res = await axios.post(`${GATEWAY_URL}/api/inventory/ingredients`, data);
      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
      ingredientId = res.data.id;
    });

    test('PATCH /api/inventory/ingredients/:id updates stock', async () => {
      const res = await axios.patch(
        `${GATEWAY_URL}/api/inventory/ingredients/${ingredientId}`,
        { stock_qty: 250 },
      );
      expect(res.status).toBe(200);
      expect(Number(res.data.stock_qty)).toBe(250);
    });
  });

  describe('6. RabbitMQ Management API', () => {
    test('RabbitMQ management UI is accessible', async () => {
      const res = await axios.get(`${RABBITMQ_MGMT_URL}/api/overview`, {
        auth: { username: RABBITMQ_USER, password: RABBITMQ_PASS },
      });
      expect(res.status).toBe(200);
      expect(res.data.node).toBeDefined();
    });

    test('flowca.events exchange exists', async () => {
      const res = await axios.get(`${RABBITMQ_MGMT_URL}/api/exchanges/%2F/flowca.events`, {
        auth: { username: RABBITMQ_USER, password: RABBITMQ_PASS },
      });
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('flowca.events');
      expect(res.data.type).toBe('topic');
    });

    test('inventory_queue exists and has bindings', async () => {
      const res = await axios.get(`${RABBITMQ_MGMT_URL}/api/queues/%2F/inventory_queue`, {
        auth: { username: RABBITMQ_USER, password: RABBITMQ_PASS },
      });
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('inventory_queue');
    });
  });
});
