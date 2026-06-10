/**
 * Phase 7B — docker-compose.yml Validation Tests
 * Verifies the production docker-compose is complete and correct.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const COMPOSE_PATH = path.join(ROOT, 'docker-compose.yml');

let composeConfig = null;

beforeAll(() => {
  const content = fs.readFileSync(COMPOSE_PATH, 'utf8');
  composeConfig = yaml.load(content);
});

describe('Phase 7B — docker-compose.yml Structure', () => {
  test('file exists and is valid YAML', () => {
    expect(fs.existsSync(COMPOSE_PATH)).toBe(true);
    expect(composeConfig).toBeDefined();
    expect(composeConfig.services).toBeDefined();
  });

  test('defines all 12 services', () => {
    const services = Object.keys(composeConfig.services);
    expect(services).toHaveLength(12);
    const expected = [
      'rabbitmq', 'pos-mysql', 'pos-backend', 'pos-frontend',
      'inventory-mysql', 'inventory-backend', 'inventory-frontend',
      'accounting-service', 'crm-mysql', 'crm-backend',
      'crm-frontend', 'api-gateway',
    ];
    expected.forEach(s => expect(services).toContain(s));
  });

  test('defines all 5 named volumes', () => {
    const volumes = Object.keys(composeConfig.volumes);
    ['rabbitmq_data', 'pos_mysql_data', 'inventory_mysql_data', 'accounting_data', 'crm_mysql_data']
      .forEach(v => expect(volumes).toContain(v));
  });
});

describe('Phase 7B — RabbitMQ', () => {
  let svc;
  beforeAll(() => { svc = composeConfig.services.rabbitmq; });

  test('uses rabbitmq:3-management image', () => expect(svc.image).toBe('rabbitmq:3-management'));
  test('exposes ports 5672 and 15672', () => {
    expect(svc.ports).toContain('5672:5672');
    expect(svc.ports).toContain('15672:15672');
  });
  test('has healthcheck', () => expect(svc.healthcheck).toBeDefined());
  test('has persistent volume', () => expect(svc.volumes).toContain('rabbitmq_data:/var/lib/rabbitmq'));
});

describe('Phase 7B — MySQL Services', () => {
  [
    { name: 'pos-mysql', schema: 'pos-service' },
    { name: 'inventory-mysql', schema: 'inventory-service' },
    { name: 'crm-mysql', schema: 'crm-service' },
  ].forEach(({ name, schema }) => {
    describe(name, () => {
      let svc;
      beforeAll(() => { svc = composeConfig.services[name]; });

      test('uses mysql:8.0', () => expect(svc.image).toBe('mysql:8.0'));
      test('has healthcheck', () => expect(svc.healthcheck).toBeDefined());
      test('mounts schema.sql for auto-init', () => {
        expect(svc.volumes.find(v => v.includes('schema.sql') && v.includes('docker-entrypoint-initdb.d'))).toBeDefined();
      });
      test('has persistent volume', () => {
        expect(svc.volumes.find(v => v.includes('_mysql_data'))).toBeDefined();
      });
    });
  });

  test('inventory-mysql also mounts seed.sql', () => {
    const inv = composeConfig.services['inventory-mysql'];
    expect(inv.volumes.find(v => v.includes('seed.sql'))).toBeDefined();
  });
});

describe('Phase 7B — Backend Services', () => {
  const backends = [
    { name: 'pos-backend', port: '3001', portVar: 'POS_PORT', db: 'pos-mysql', rabbit: true },
    { name: 'inventory-backend', port: '3002', portVar: 'INVENTORY_PORT', db: 'inventory-mysql', rabbit: true },
    { name: 'crm-backend', port: '3003', portVar: 'CRM_PORT', db: 'crm-mysql', rabbit: false },
    { name: 'api-gateway', port: '3000', portVar: 'GATEWAY_PORT', db: null, rabbit: false },
  ];

  backends.forEach(({ name, port, portVar, db, rabbit }) => {
    describe(name, () => {
      let svc;
      beforeAll(() => { svc = composeConfig.services[name]; });

      test('has build context and Dockerfile', () => {
        expect(svc.build).toBeDefined();
        expect(svc.build.dockerfile).toBe('Dockerfile');
      });
      test(`exposes port ${port}`, () => expect(svc.ports[0]).toContain(port));
      test(`sets ${portVar}=${port}`, () => {
        expect(svc.environment.flat()).toContain(`${portVar}=${port}`);
      });
      if (db) {
        test(`depends on ${db} healthy`, () => {
          expect(svc.depends_on[db].condition).toBe('service_healthy');
        });
      }
      if (rabbit) {
        test('depends on rabbitmq healthy', () => {
          expect(svc.depends_on.rabbitmq.condition).toBe('service_healthy');
        });
      }
      test('has restart policy', () => expect(svc.restart).toBe('on-failure'));
    });
  });
});

describe('Phase 7B — Accounting Service (C#)', () => {
  let svc;
  beforeAll(() => { svc = composeConfig.services['accounting-service']; });

  test('build context correct', () => {
    expect(svc.build.context).toBe('./accounting-service/src/Accounting.Service');
  });
  test('depends on rabbitmq healthy', () => {
    expect(svc.depends_on.rabbitmq.condition).toBe('service_healthy');
  });
  test('has SQLite volume', () => {
    expect(svc.volumes).toContain('accounting_data:/app/data');
  });
  test('has DATABASE_CONNECTION_STRING', () => {
    expect(svc.environment.flat().some(e => e.includes('DATABASE_CONNECTION_STRING'))).toBe(true);
  });
});

describe('Phase 7B — Frontend Services', () => {
  [
    { name: 'pos-frontend', port: '9080' },
    { name: 'inventory-frontend', port: '9081' },
    { name: 'crm-frontend', port: '9082' },
  ].forEach(({ name, port }) => {
    describe(name, () => {
      let svc;
      beforeAll(() => { svc = composeConfig.services[name]; });

      test('has build with Dockerfile', () => expect(svc.build).toBeDefined());
      test(`maps port ${port}`, () => expect(svc.ports[0]).toContain(port));
      test('depends on api-gateway', () => expect(svc.depends_on).toContain('api-gateway'));
      test('has restart policy', () => expect(svc.restart).toBe('on-failure'));
    });
  });
});

describe('Phase 7B — API Gateway Routing', () => {
  let gw;
  beforeAll(() => { gw = composeConfig.services['api-gateway']; });

  test('routes to POS backend', () => {
    expect(gw.environment.flat()).toContain('POS_BASE_URL=http://pos-backend:3001');
  });
  test('routes to Inventory backend', () => {
    expect(gw.environment.flat()).toContain('INVENTORY_BASE_URL=http://inventory-backend:3002');
  });
  test('routes to CRM backend', () => {
    expect(gw.environment.flat()).toContain('CRM_BASE_URL=http://crm-backend:3003');
  });
  test('depends on all backends', () => {
    ['pos-backend', 'inventory-backend', 'crm-backend', 'accounting-service']
      .forEach(d => expect(gw.depends_on).toContain(d));
  });
});
