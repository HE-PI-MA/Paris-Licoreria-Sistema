const crypto = require('crypto');
class CsrfMiddleware {
  constructor(origin) { this.origin = origin; this.protect = this.protect.bind(this); }
  token(req, res) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    return req.session.csrfToken;
  }
  protect(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const expectedOrigin = this.origin || req.protocol + '://' + req.get('host');
    const receivedOrigin = req.get('origin');
    if (req.get('sec-fetch-site') === 'cross-site' || (receivedOrigin && receivedOrigin !== expectedOrigin)) {
      return res.status(403).json({ error: 'SOLICITUD_NO_AUTORIZADA' });
    }
    if (req.method !== 'POST' || !req.is('application/json')) {
      return res.status(415).json({ error: 'Se requiere una solicitud JSON.' });
    }
    const token = req.get('x-csrf-token');
    const expected = req.session?.csrfToken;
    if (typeof token !== 'string' || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(403).json({ error: 'La sesion del formulario vencio. Recarga la pagina.' });
    }
    next();
  }
}
module.exports = CsrfMiddleware;
