const crypto = require('crypto');
class ActivationService {
  constructor(activationRepository, licenseService, windowsProtection) {
    Object.assign(this, { activationRepository, licenseService, windowsProtection });
    this.cachedData = null;
    this.decoding = null;
    this.activating = Promise.resolve();
  }
  hashCode(code) { return crypto.createHash('sha256').update(code, 'utf8').digest('hex'); }
  hashesMatch(a, b) {
    return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) && /^[a-f0-9]{64}$/i.test(b) &&
      crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }
  async activate(code) {
    if (typeof code !== 'string' || !code.trim() || code.length > 512) throw new Error('ACTIVACION_CODIGO_REQUERIDO');
    // Serializa activaciones concurrentes y conserva la fecha de una activación válida.
    const operation = this.activating.then(async () => {
      const license = await this.licenseService.getValidatedLicense();
      if (!this.hashesMatch(this.hashCode(code.trim()), license.activacionHash)) throw new Error('ACTIVACION_CODIGO_INVALIDO');
      try {
        const current = await this.getValidatedActivation(license);
        return { activada: true, estado: 'ACTIVACION_YA_VALIDA', licenciaId: current.licenciaId, fechaActivacion: current.fechaActivacion };
      } catch (error) {
        if (!error.message.startsWith('ACTIVACION_')) throw error;
      }
      const activation = { version: 1, producto: 'PARIS_LICORERIA', licenciaId: license.licenciaId,
        equipo: license.equipo.toLowerCase(), fechaActivacion: new Date().toISOString() };
      const protectedData = await this.windowsProtection.protect(JSON.stringify(activation));
      await this.activationRepository.write(protectedData);
      this.cachedData = null;
      return { activada: true, estado: 'ACTIVACION_CORRECTA', licenciaId: license.licenciaId, fechaActivacion: activation.fechaActivacion };
    });
    this.activating = operation.catch(() => {});
    return operation;
  }
  async getValidatedActivation(license) {
    license = license || await this.licenseService.getValidatedLicense();
    const data = await this.activationRepository.read();
    if (!data) throw new Error('ACTIVACION_REQUERIDA');
    // Solo se reutiliza el descifrado de bytes idénticos; la licencia y su fecha
    // se vuelven a validar. Si el archivo cambia, también se vuelve a descifrar.
    if (data !== this.cachedData) {
      this.cachedData = data;
      this.decoding = Promise.resolve().then(() => this.windowsProtection.unprotect(data)).then(raw => {
        try { return JSON.parse(raw); } catch { throw new Error('ACTIVACION_FORMATO_INVALIDO'); }
      }).catch(() => {
        if (this.cachedData === data) this.cachedData = null;
        throw new Error('ACTIVACION_NO_VALIDA_PARA_ESTE_EQUIPO');
      });
    }
    const activation = await this.decoding;
    if (!activation || activation.version !== 1 || activation.producto !== 'PARIS_LICORERIA') throw new Error('ACTIVACION_INVALIDA');
    if (activation.licenciaId !== license.licenciaId) throw new Error('ACTIVACION_LICENCIA_NO_COINCIDE');
    if (activation.equipo !== license.equipo.toLowerCase()) throw new Error('ACTIVACION_EQUIPO_NO_COINCIDE');
    return { ...activation };
  }
  async getStatus(license) {
    try {
      const a = await this.getValidatedActivation(license);
      return { activada: true, estado: 'ACTIVACION_VALIDA', licenciaId: a.licenciaId, fechaActivacion: a.fechaActivacion };
    } catch (error) { return { activada: false, estado: this.licenseService.errorCode(error) }; }
  }
  async getSystemStatus() {
    let license;
    try { license = await this.licenseService.getValidatedLicense(); }
    catch (error) {
      const estado = this.licenseService.errorCode(error);
      return { licencia: { valida: false, estado }, activacion: { activada: false, estado }, accesoSistema: false };
    }
    const activacion = await this.getStatus(license);
    return { licencia: this.licenseService.describe(license), activacion, accesoSistema: activacion.activada };
  }
}
module.exports = ActivationService;
