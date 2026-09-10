const { rateLimit } = require('express-rate-limit');
function limiter(limit, windowMs, skipSuccessfulRequests = false) {
  return rateLimit({ limit, windowMs, skipSuccessfulRequests,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Espera unos minutos e intenta nuevamente.' } });
}
module.exports = () => ({
  general: limiter(120, 60 * 1000),
  login: limiter(5, 15 * 60 * 1000, true),
  activation: limiter(5, 15 * 60 * 1000, true),
  status: limiter(30, 60 * 1000)
});
