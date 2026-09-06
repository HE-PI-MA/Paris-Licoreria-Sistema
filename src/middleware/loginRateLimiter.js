const { rateLimit } = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesion. Intente nuevamente en 15 minutos.'
  }
});

module.exports = loginRateLimiter;
