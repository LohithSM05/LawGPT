const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many attempts from this device. Please try again later.',
  },
});

module.exports = { authLimiter };
