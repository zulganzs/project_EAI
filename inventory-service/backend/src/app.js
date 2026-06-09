const express = require('express');
const ingredientRoutes = require('./routes/ingredient.routes');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'inventory-backend',
    timestamp: new Date().toISOString(),
  });
});

// Inventory API routes
app.use('/api/inventory', ingredientRoutes);

module.exports = { app };
