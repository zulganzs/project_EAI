const request = require('supertest');
const { app } = require('../../src/app');

describe('5A. API Gateway Skeleton + /health', () => {
  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'api-gateway',
      timestamp: expect.any(String),
    });
  });

  test('GET /health timestamp is a valid ISO date', async () => {
    const res = await request(app).get('/health');
    const parsed = Date.parse(res.body.timestamp);
    expect(parsed).not.toBeNaN();
  });
});
