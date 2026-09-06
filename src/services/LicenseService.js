const LicenseSchema = require("../core/LicenseSchema");

class LicenseService {
  constructor(licenseRepository, licenseVerifier, machineFingerprint) {
    this.licenseRepository = licenseRepository;
    this.licenseVerifier = licenseVerifier;
    this.machineFingerprint = machineFingerprint;
  }

  getValidatedLicense() {
    const license = this.licenseRepository.read();

    if (!license) {
      throw new Error("LICENCIA_NO_INSTALADA");
    }

    LicenseSchema.validate(license);

    if (!this.licenseVerifier.verify(license)) {
      throw new Error("LICENCIA_FIRMA_INVALIDA");
    }

    const currentFingerprint = this.machineFingerprint.generate();

    if (license.equipo.toLowerCase() !== currentFingerprint.toLowerCase()) {
      throw new Error("LICENCIA_EQUIPO_NO_AUTORIZADO");
    }

    if (license.tipo === "TEMPORAL") {
      const today = new Date().toISOString().slice(0, 10);

      if (today > license.fechaExpiracion) {
        throw new Error("LICENCIA_EXPIRADA");
      }
    }

    return license;
  }

  getStatus() {
    try {
      const license = this.getValidatedLicense();

      return {
        valida: true,
        estado: "LICENCIA_VALIDA",
        licenciaId: license.licenciaId,
        cliente: license.cliente,
        tipo: license.tipo,
        fechaEmision: license.fechaEmision,
        fechaExpiracion: license.fechaExpiracion
      };
    } catch (error) {
      return {
        valida: false,
        estado: error.message
      };
    }
  }
}

module.exports = LicenseService;
