const express = require('express');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pos-backend',
    timestamp: new Date().toISOString(),
  });
});

// Transaction API routes
app.use('/api/pos', transactionRoutes);

module.exports = { app };
