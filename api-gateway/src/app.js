const express = require('express');
const { posProxy, inventoryProxy, crmProxy, accountingProxy } = require('./middleware/proxy');
const { globalLimiter, writeLimiter } = require('./middleware/rateLimiter');

const app = express();

// Health check (no body parsing or rate limiting needed)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting — applied before proxying
app.use('/api', globalLimiter);
app.use('/api', writeLimiter);

// Content-Based Router — proxy routes MUST be before express.json()
// to avoid consuming the request body before forwarding
app.use('/api/pos', posProxy);
app.use('/api/inventory', inventoryProxy);
app.use('/api/crm', crmProxy);
app.use('/api/accounting', accountingProxy);

// Body parsing for non-proxied routes (e.g., catch-all)
app.use(express.json());

// Catch-all 404 for unmatched API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route not found — no matching service' });
});

module.exports = { app };
