const express = require('express');
const { posProxy, inventoryProxy, crmProxy } = require('./middleware/proxy');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Content-Based Router — proxy routes to downstream services
app.use('/api/pos', posProxy);
app.use('/api/inventory', inventoryProxy);
app.use('/api/crm', crmProxy);

// Catch-all 404 for unmatched API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route not found — no matching service' });
});

module.exports = { app };
