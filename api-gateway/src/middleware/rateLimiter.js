const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — applies to all API routes.
 * Limits each IP to 100 requests per 15-minute window.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,                  
  standardHeaders: true,    
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.',
  },
});

/**
 * Stricter limiter for write operations (POST/PATCH/PUT/DELETE).
 * Limits each IP to 30 write requests per 15-minute window.
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many write requests, please try again later.',
  },
  // Only count non-GET requests
  skip: (req) => req.method === 'GET',
});

module.exports = { globalLimiter, writeLimiter };
