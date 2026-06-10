/**
 * Phase 7A — Nginx Configuration Validation Tests
 * Verifies all frontend nginx configs exist and proxy /api/ correctly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const NGINX_CONFIGS = [
  { path: 'pos-service/frontend/nginx.conf', service: 'POS' },
  { path: 'inventory-service/frontend/nginx.conf', service: 'Inventory' },
  { path: 'crm-service/frontend/nginx.conf', service: 'CRM' },
];

describe('Phase 7A — Nginx Configuration', () => {
  NGINX_CONFIGS.forEach(({ path: relPath, service }) => {
    const filePath = path.join(ROOT, relPath);

    describe(`${service} frontend nginx.conf`, () => {
      let content;

      beforeAll(() => {
        content = fs.readFileSync(filePath, 'utf8');
      });

      test('file exists', () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      test('listens on port 80', () => {
        expect(content).toContain('listen 80');
      });

      test('serves from /usr/share/nginx/html', () => {
        expect(content).toContain('/usr/share/nginx/html');
      });

      test('has SPA fallback (try_files)', () => {
        expect(content).toMatch(/try_files.*index\.html/);
      });

      test('proxies /api/ to api-gateway:3000', () => {
        expect(content).toContain('location /api/');
        expect(content).toContain('proxy_pass http://api-gateway:3000');
      });

      test('sets proxy headers', () => {
        expect(content).toContain('proxy_set_header Host');
        expect(content).toContain('proxy_set_header X-Real-IP');
        expect(content).toContain('proxy_set_header X-Forwarded-For');
      });
    });
  });
});
