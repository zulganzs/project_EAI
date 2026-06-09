const dotenv = require('dotenv');
dotenv.config();

const { app } = require('./app');

const PORT = process.env.GATEWAY_PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`   → POS:        ${process.env.POS_BASE_URL || 'http://localhost:3001'}`);
  console.log(`   → Inventory:  ${process.env.INVENTORY_BASE_URL || 'http://localhost:3002'}`);
  console.log(`   → CRM:        ${process.env.CRM_BASE_URL || 'http://localhost:3003'}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down API Gateway...');
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
