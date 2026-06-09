const request = require('supertest');
const { app: gatewayApp } = require('../../src/app');

describe('5D. Gateway to CRM Wiring', () => {
  test('gateway app is defined and has proxy routes', () => {
    expect(gatewayApp).toBeDefined();
    const routes = gatewayApp._router.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);
    expect(routes).toContain('/health');
  });

  test('gateway config has correct CRM route target', () => {
    const config = require('../../src/config/routes');
    expect(config.crmBaseUrl).toBeDefined();
    expect(config.crmBaseUrl).toMatch(/^http/);
  });

  test('gateway config has all three service targets', () => {
    const config = require('../../src/config/routes');
    expect(config.posBaseUrl).toBeDefined();
    expect(config.inventoryBaseUrl).toBeDefined();
    expect(config.crmBaseUrl).toBeDefined();
  });

  test('CRM service app exports correctly', () => {
    const { app: crmApp } = require('../../../crm-service/backend/src/app');
    expect(crmApp).toBeDefined();
  });

  test('CRM service has /health endpoint', async () => {
    const { app: crmApp } = require('../../../crm-service/backend/src/app');
    const res = await request(crmApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('crm-backend');
  });

  test('gateway /api/crm route exists (proxies even when downstream is down)', async () => {
    // When CRM service is down, we should get 502 or 504 (not 404)
    const res = await request(gatewayApp).get('/api/crm/reservations');
    expect([200, 502, 504]).toContain(res.status);
  });

  test('gateway /api/pos route exists (proxies even when downstream is down)', async () => {
    const res = await request(gatewayApp).get('/api/pos/health');
    expect([200, 502, 504]).toContain(res.status);
  });

  test('gateway /api/inventory route exists (proxies even when downstream is down)', async () => {
    const res = await request(gatewayApp).get('/api/inventory/health');
    expect([200, 502, 504]).toContain(res.status);
  });
});
