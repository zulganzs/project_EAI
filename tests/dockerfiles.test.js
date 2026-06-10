/**
 * Phase 7A — Dockerfile Validation Tests
 * Verifies all Dockerfiles exist and contain required instructions.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOCKERFILES = [
  {
    path: 'pos-service/backend/Dockerfile',
    shouldExpose: '3001',
    shouldContain: ['FROM node:20-alpine', 'EXPOSE 3001', 'CMD'],
    type: 'node-backend',
  },
  {
    path: 'pos-service/frontend/Dockerfile',
    shouldContain: ['FROM node:20-alpine AS build', 'FROM nginx:alpine', 'npm run build'],
    type: 'react-frontend',
  },
  {
    path: 'inventory-service/backend/Dockerfile',
    shouldExpose: '3002',
    shouldContain: ['FROM node:20-alpine', 'EXPOSE 3002', 'CMD'],
    type: 'node-backend',
  },
  {
    path: 'inventory-service/frontend/Dockerfile',
    shouldContain: ['FROM node:20-alpine AS build', 'FROM nginx:alpine', 'npm run build'],
    type: 'react-frontend',
  },
  {
    path: 'crm-service/backend/Dockerfile',
    shouldExpose: '3003',
    shouldContain: ['FROM node:20-alpine', 'EXPOSE 3003', 'CMD'],
    type: 'node-backend',
  },
  {
    path: 'crm-service/frontend/Dockerfile',
    shouldContain: ['FROM node:20-alpine AS build', 'FROM nginx:alpine', 'npm run build'],
    type: 'react-frontend',
  },
  {
    path: 'accounting-service/src/Accounting.Service/Dockerfile',
    shouldContain: ['mcr.microsoft.com/dotnet/sdk:10.0', 'mcr.microsoft.com/dotnet/runtime:10.0', 'dotnet publish'],
    type: 'dotnet-worker',
  },
  {
    path: 'api-gateway/Dockerfile',
    shouldExpose: '3000',
    shouldContain: ['FROM node:20-alpine', 'EXPOSE 3000', 'CMD'],
    type: 'node-backend',
  },
];

describe('Phase 7A — Dockerfile Validation', () => {
  DOCKERFILES.forEach(({ path: relPath, shouldExpose, shouldContain, type }) => {
    const dockerfilePath = path.join(ROOT, relPath);

    describe(`${relPath} (${type})`, () => {
      test('file exists', () => {
        expect(fs.existsSync(dockerfilePath)).toBe(true);
      });

      if (shouldContain) {
        test('contains required instructions', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          shouldContain.forEach((keyword) => {
            expect(content).toContain(keyword);
          });
        });
      }

      if (shouldExpose) {
        test(`exposes port ${shouldExpose}`, () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toContain(`EXPOSE ${shouldExpose}`);
        });
      }

      if (type === 'node-backend') {
        test('copies source code', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toMatch(/COPY.*src/);
        });

        test('installs production dependencies only', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toContain('npm install --omit=dev');
        });
      }

      if (type === 'react-frontend') {
        test('has multi-stage build', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toContain('AS build');
          expect(content).toContain('FROM nginx:alpine');
        });
      }

      if (type === 'dotnet-worker') {
        test('has multi-stage build (build + runtime)', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toContain('AS build');
          expect(content).toContain('AS runtime');
        });

        test('publishes in Release mode', () => {
          const content = fs.readFileSync(dockerfilePath, 'utf8');
          expect(content).toContain('-c Release');
        });
      }
    });
  });
});
