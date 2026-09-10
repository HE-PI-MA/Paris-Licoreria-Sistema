const safeLog = require('../utils/safeLog');
class LicenseController {
  constructor(licenseService, activationService) {
    Object.assign(this, { licenseService, activationService });
    this.status = this.status.bind(this); this.activate = this.activate.bind(this);
  }
  async status(req, res) { return res.json(await this.activationService.getSystemStatus()); }
  async activate(req, res) {
    try {
      const result = await this.activationService.activate(req.body?.codigo);
      return res.json({ mensaje: 'Equipo activado correctamente', ...result });
    } catch (error) {
      const code = this.licenseService.errorCode(error);
      if (code.startsWith('LICENCIA_') || ['ACTIVACION_CODIGO_REQUERIDO','ACTIVACION_CODIGO_INVALIDO'].includes(code)) {
        return res.status(400).json({ error: code });
      }
      safeLog('ACTIVATION_FAILED', error, req.requestId);
      return res.status(500).json({ error: 'ERROR_DE_ACTIVACION' });
    }
  }
}
module.exports = LicenseController;
