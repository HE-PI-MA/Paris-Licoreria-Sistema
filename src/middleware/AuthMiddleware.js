const safeLog = require('../utils/safeLog');
class AuthMiddleware {
  constructor(authService) { this.authService = authService; this.requireAuth = this.requireAuth.bind(this); }
  deny(req, res) {
    res.clearCookie('paris.sid', { path: '/' });
    if (!req.originalUrl.startsWith('/api/')) return res.redirect('/login?sesion=vencida');
    return res.status(401).json({ error: 'Debe iniciar sesion' });
  }
  async requireAuth(req, res, next) {
    try {
      const id = req.session?.usuario?.idUsuario;
      if (!id) return this.deny(req, res);
      const usuario = await this.authService.getAuthenticatedUser(id);
      if (!usuario) {
        await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
        return this.deny(req, res);
      }
      req.authUser = usuario;
      req.session.usuario = { idUsuario: usuario.idUsuario, idRol: usuario.idRol, rol: usuario.rol };
      next();
    } catch (error) {
      safeLog('AUTH_VALIDATION_FAILED', error, req.requestId);
      return res.status(503).json({ error: 'No se pudo verificar la sesion. Intenta nuevamente.' });
    }
  }
}
module.exports = AuthMiddleware;
