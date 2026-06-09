const express = require('express');
const reservationRoutes = require('./routes/reservation.routes');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'crm-backend',
    timestamp: new Date().toISOString(),
  });
});

// Reservation API routes
app.use('/api/crm', reservationRoutes);

module.exports = { app };
