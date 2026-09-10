const LicenseSchema = require("../core/LicenseSchema");

class LicenseService {
  constructor(licenseRepository, licenseVerifier, machineFingerprint) {
    this.licenseRepository = licenseRepository;
    this.licenseVerifier = licenseVerifier;
    this.machineFingerprint = machineFingerprint;
  }

  getCurrentLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async getValidatedLicense() {
    const license = await this.licenseRepository.read();
    if (!license) throw new Error("LICENCIA_NO_INSTALADA");
    LicenseSchema.validate(license);
    if (!(await this.licenseVerifier.verify(license))) throw new Error("LICENCIA_FIRMA_INVALIDA");

    const currentFingerprint = await this.machineFingerprint.generate();
    if (license.equipo.toLowerCase() !== currentFingerprint.toLowerCase()) {
      throw new Error("LICENCIA_EQUIPO_NO_AUTORIZADO");
    }

    if (license.tipo === "TEMPORAL") {
      const today = this.getCurrentLocalDate();
      if (today > license.fechaExpiracion) throw new Error("LICENCIA_EXPIRADA");
    }
    return license;
  }

  errorCode(error) {
    return /^(LICENCIA|ACTIVACION|CLAVE_PUBLICA|MACHINE_GUID|SISTEMA_OPERATIVO|WINDOWS_PROTECTION)_[A-Z_]+$/.test(error?.message || '')
      ? error.message : 'ERROR_DE_LICENCIA';
  }
  describe(license) {
    return { valida: true, estado: 'LICENCIA_VALIDA', licenciaId: license.licenciaId,
      cliente: license.cliente, tipo: license.tipo, fechaEmision: license.fechaEmision, fechaExpiracion: license.fechaExpiracion };
  }
  async getStatus() {
    try { return this.describe(await this.getValidatedLicense()); }
    catch (error) { return { valida: false, estado: this.errorCode(error) }; }
  }
}
module.exports = LicenseService;
