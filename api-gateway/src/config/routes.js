/**
 * API Gateway Route Configuration
 * Reads downstream service URLs from environment variables with sensible defaults.
 */
module.exports = {
  posBaseUrl: process.env.POS_BASE_URL || 'http://localhost:3001',
  inventoryBaseUrl: process.env.INVENTORY_BASE_URL || 'http://localhost:3002',
  crmBaseUrl: process.env.CRM_BASE_URL || 'http://localhost:3003',
};
