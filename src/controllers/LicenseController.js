class LicenseController {
  constructor(licenseService, activationService) {
    this.licenseService = licenseService;
    this.activationService = activationService;

    this.status = this.status.bind(this);
    this.activate = this.activate.bind(this);
  }

  status(req, res) {
    const license = this.licenseService.getStatus();
    const activation = this.activationService.getStatus();

    return res.json({
      licencia: license,
      activacion: activation,
      accesoSistema: license.valida === true && activation.activada === true
    });
  }

  activate(req, res) {
    try {
      const { codigo } = req.body;
      const result = this.activationService.activate(codigo);

      return res.status(200).json({
        mensaje: "Equipo activado correctamente",
        ...result
      });
    } catch (error) {
      const knownErrors = [
        "ACTIVACION_CODIGO_REQUERIDO",
        "ACTIVACION_CODIGO_INVALIDO",
        "LICENCIA_NO_INSTALADA",
        "LICENCIA_FIRMA_INVALIDA",
        "LICENCIA_EQUIPO_NO_AUTORIZADO",
        "LICENCIA_EXPIRADA"
      ];

      if (knownErrors.includes(error.message)) {
        return res.status(400).json({
          error: error.message
        });
      }

      console.error(error);
      return res.status(500).json({
        error: "ERROR_DE_ACTIVACION"
      });
    }
  }
}

module.exports = LicenseController;
