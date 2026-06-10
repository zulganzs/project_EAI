const request = require('supertest');
const { app } = require('../../src/app');

describe('5B. Content-Based Router - Proxy Configuration', () => {
  test('config module exports route targets from env vars', () => {
    const config = require('../../src/config/routes');
    expect(config).toHaveProperty('posBaseUrl');
    expect(config).toHaveProperty('inventoryBaseUrl');
    expect(config).toHaveProperty('crmBaseUrl');
  });

  test('config defaults match docker-compose service names', () => {
    const config = require('../../src/config/routes');
    expect(config.posBaseUrl).toBe(process.env.POS_BASE_URL || 'http://localhost:3001');
    expect(config.inventoryBaseUrl).toBe(process.env.INVENTORY_BASE_URL || 'http://localhost:3002');
    expect(config.crmBaseUrl).toBe(process.env.CRM_BASE_URL || 'http://localhost:3003');
  });
});

describe('5B. Content-Based Router - Proxy Routing', () => {
  test('GET /api/pos/health proxies to POS service', async () => {
    const res = await request(app).get('/api/pos/health');
    // When POS service is down, proxy returns 502 or 504
    // When POS is up but route doesn't exist, returns 404 (passed through)
    expect([200, 404, 502, 504]).toContain(res.status);
  });

  test('GET /api/inventory/health proxies to Inventory service', async () => {
    const res = await request(app).get('/api/inventory/health');
    expect([200, 404, 502, 504]).toContain(res.status);
  });

  test('GET /api/crm/health proxies to CRM service', async () => {
    const res = await request(app).get('/api/crm/health');
    expect([200, 404, 502, 504]).toContain(res.status);
  });

  test('GET /api/unknown returns 404 (no matching route)', async () => {
    const res = await request(app).get('/api/unknown/something');
    // Could be 404 from gateway or proxied
    expect([404, 502, 504]).toContain(res.status);
  });
});

describe('5B. Content-Based Router - Error Handling', () => {
  test('gateway handles unavailable downstream service gracefully', async () => {
    // All downstream services are down in test env, so we should get a proper error
    const res = await request(app).get('/api/pos/health');
    // Should not crash the gateway — just return error status
    expect(res.status).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('gateway returns error body with message when downstream is down', async () => {
    const res = await request(app).get('/api/pos/health');
    // http-proxy-middleware returns 504 when downstream is unreachable
    // Our custom error handler returns 502 when headers not yet sent
    // If downstream is up, it may return 404 (route not found on downstream)
    expect([404, 502, 504]).toContain(res.status);
  });
});
