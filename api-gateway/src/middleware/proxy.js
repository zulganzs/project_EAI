const { createProxyMiddleware } = require('http-proxy-middleware');
const routes = require('../config/routes');

/**
 * Error handler for proxy failures (downstream service unavailable).
 * Returns 502 JSON when downstream is unreachable and headers not yet sent.
 */
function onProxyError(err, req, res) {
  console.error(`[Gateway Proxy Error] ${req.method} ${req.url}: ${err.message}`);
  if (!res.headersSent) {
    res.status(502).json({
      error: `Service unavailable: ${err.message}`,
      path: req.url,
    });
  }
}

/**
 * POS proxy — /api/pos/* → POS_BASE_URL
 */
const posProxy = createProxyMiddleware({
  target: routes.posBaseUrl,
  changeOrigin: true,
  on: { error: onProxyError },
});

/**
 * Inventory proxy — /api/inventory/* → INVENTORY_BASE_URL
 */
const inventoryProxy = createProxyMiddleware({
  target: routes.inventoryBaseUrl,
  changeOrigin: true,
  on: { error: onProxyError },
});

/**
 * CRM proxy — /api/crm/* → CRM_BASE_URL
 */
const crmProxy = createProxyMiddleware({
  target: routes.crmBaseUrl,
  changeOrigin: true,
  on: { error: onProxyError },
});

module.exports = { posProxy, inventoryProxy, crmProxy };
