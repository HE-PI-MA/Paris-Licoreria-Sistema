class LicenseMiddleware {
  constructor(activationService) {
    this.activationService = activationService;
    this.requireActivation = this.requireActivation.bind(this);
  }

  requireActivation(req, res, next) {
    try {
      const activation = this.activationService.getValidatedActivation();

      req.licenseActivation = activation;
      return next();
    } catch (error) {
      return res.status(403).json({
        error: "SISTEMA_NO_ACTIVADO",
        estado: error.message
      });
    }
  }
}

module.exports = LicenseMiddleware;
