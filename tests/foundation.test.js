const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');

describe('Phase 1 - Shared Foundation', () => {
  describe('1A. Folder structure', () => {
    const requiredDirs = [
      'pos-service/backend/src/config',
      'pos-service/backend/src/controllers',
      'pos-service/backend/src/services',
      'pos-service/backend/src/routes',
      'pos-service/backend/src/models',
      'pos-service/backend/src/messaging',
      'pos-service/backend/src/utils',
      'pos-service/backend/tests/unit',
      'pos-service/backend/tests/integration',
      'pos-service/frontend/src/components',
      'pos-service/frontend/src/services',
      'inventory-service/backend/src/config',
      'inventory-service/backend/src/controllers',
      'inventory-service/backend/src/services',
      'inventory-service/backend/src/routes',
      'inventory-service/backend/src/models',
      'inventory-service/backend/src/messaging',
      'inventory-service/backend/src/utils',
      'inventory-service/backend/tests/unit',
      'inventory-service/backend/tests/integration',
      'inventory-service/frontend/src/components',
      'inventory-service/frontend/src/services',
      'src/Accounting.Service/Models',
      'src/Accounting.Service/Services',
      'src/Accounting.Service/Messaging',
      'src/Accounting.Service/Data',
      'src/Accounting.Service/Configuration',
      'tests/Accounting.Service.Tests/Services',
      'tests/Accounting.Service.Tests/Data',
      'tests/Accounting.Service.Tests/Models',
      'api-gateway/src/middleware',
      'api-gateway/src/routes',
      'api-gateway/src/config',
      'api-gateway/tests',
      'crm-service/backend/src/config',
      'crm-service/backend/src/controllers',
      'crm-service/backend/src/services',
      'crm-service/backend/src/routes',
      'crm-service/backend/src/models',
      'crm-service/backend/tests/unit',
      'crm-service/backend/tests/integration',
      'crm-service/frontend/src/components',
      'crm-service/frontend/src/services',
    ];

    test.each(requiredDirs)('directory %s exists', (dir) => {
      const fullPath = path.join(ROOT, dir);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('1B. .env.example has required keys', () => {
    const requiredKeys = [
      'GATEWAY_PORT',
      'POS_PORT',
      'POS_DB_HOST',
      'POS_DB_NAME',
      'INVENTORY_PORT',
      'INVENTORY_DB_HOST',
      'INVENTORY_DB_NAME',
      'CRM_PORT',
      'CRM_DB_HOST',
      'CRM_DB_NAME',
      'ACCOUNTING_PORT',
      'RABBITMQ_HOST',
      'RABBITMQ_PORT',
      'RABBITMQ_USER',
      'RABBITMQ_PASSWORD',
      'RABBITMQ_EXCHANGE',
      'RABBITMQ_ROUTING_KEY',
      'POS_BASE_URL',
      'INVENTORY_BASE_URL',
      'CRM_BASE_URL',
    ];

    test('.env.example file exists', () => {
      expect(fs.existsSync(path.join(ROOT, '.env.example'))).toBe(true);
    });

    test('.env.example contains all required keys', () => {
      const content = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
      requiredKeys.forEach((key) => {
        expect(content).toMatch(new RegExp('^' + key + '=', 'm'));
      });
    });
  });
});

describe('Phase 1 - docker-compose.yml', () => {
  const requiredServices = [
    'rabbitmq',
    'pos-mysql',
    'pos-backend',
    'pos-frontend',
    'inventory-mysql',
    'inventory-backend',
    'inventory-frontend',
    'accounting-service',
    'crm-mysql',
    'crm-backend',
    'crm-frontend',
    'api-gateway',
  ];

  let parsed;
  beforeAll(() => {
    const content = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
    parsed = yaml.load(content);
  });

  test('is valid YAML with version 3.8', () => {
    expect(parsed.version).toBe('3.8');
    expect(parsed.services).toBeDefined();
  });

  test('contains all required services', () => {
    const serviceNames = Object.keys(parsed.services);
    requiredServices.forEach((svc) => {
      expect(serviceNames).toContain(svc);
    });
  });

  test('rabbitmq has healthcheck', () => {
    expect(parsed.services.rabbitmq.healthcheck).toBeDefined();
    expect(parsed.services.rabbitmq.healthcheck.test).toBeDefined();
  });

  test('volumes are defined for persistence', () => {
    const requiredVolumes = [
      'rabbitmq_data',
      'pos_mysql_data',
      'inventory_mysql_data',
      'accounting_data',
      'crm_mysql_data',
    ];
    requiredVolumes.forEach((vol) => {
      expect(parsed.volumes).toHaveProperty(vol);
    });
  });

  test('uses env vars (no hardcoded credentials)', () => {
    expect(parsed.services.rabbitmq.environment.RABBITMQ_DEFAULT_USER).toMatch(/\$\{/);
    const posEnv = parsed.services['pos-backend'].environment;
    expect(posEnv).toEqual(
      expect.arrayContaining([
        expect.stringContaining('RABBITMQ_HOST=rabbitmq'),
        expect.stringContaining('POS_DB_HOST=pos-mysql'),
      ])
    );
  });

  test('api-gateway depends on all backends', () => {
    const gatewayDeps = parsed.services['api-gateway'].depends_on;
    expect(gatewayDeps).toContain('pos-backend');
    expect(gatewayDeps).toContain('inventory-backend');
    expect(gatewayDeps).toContain('accounting-service');
    expect(gatewayDeps).toContain('crm-backend');
  });
});
