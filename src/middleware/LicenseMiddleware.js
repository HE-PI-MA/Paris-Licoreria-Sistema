/** Exige activación válida antes de continuar y dirige al acceso correspondiente cuando falla. */
class LicenseMiddleware {
  constructor(activationService) { this.activationService = activationService; this.requireActivation = this.requireActivation.bind(this); }
  async requireActivation(req, res, next) {
    try {
      req.licenseActivation = await this.activationService.getValidatedActivation();
      next();
    } catch (error) {
      if (!req.originalUrl.startsWith('/api/')) return res.redirect('/activar');
      return res.status(403).json({ error: 'SISTEMA_NO_ACTIVADO', estado: this.activationService.licenseService.errorCode(error) });
    }
  }
}
module.exports = LicenseMiddleware;
