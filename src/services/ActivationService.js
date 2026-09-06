const crypto = require("crypto");

class ActivationService {
  constructor(
    activationRepository,
    licenseService,
    windowsProtection,
    machineFingerprint
  ) {
    this.activationRepository = activationRepository;
    this.licenseService = licenseService;
    this.windowsProtection = windowsProtection;
    this.machineFingerprint = machineFingerprint;
  }

  hashCode(code) {
    return crypto
      .createHash("sha256")
      .update(String(code), "utf8")
      .digest("hex");
  }

  hashesMatch(first, second) {
    if (
      typeof first !== "string" ||
      typeof second !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(first) ||
      !/^[a-fA-F0-9]{64}$/.test(second)
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(first, "hex"),
      Buffer.from(second, "hex")
    );
  }

  activate(code) {
    const activationCode = String(code || "").trim();

    if (!activationCode) {
      throw new Error("ACTIVACION_CODIGO_REQUERIDO");
    }

    const license = this.licenseService.getValidatedLicense();
    const receivedHash = this.hashCode(activationCode);

    if (!this.hashesMatch(receivedHash, license.activacionHash)) {
      throw new Error("ACTIVACION_CODIGO_INVALIDO");
    }

    const activation = {
      version: 1,
      producto: "PARIS_LICORERIA",
      licenciaId: license.licenciaId,
      equipo: this.machineFingerprint.generate().toLowerCase(),
      fechaActivacion: new Date().toISOString()
    };

    const protectedData = this.windowsProtection.protect(
      JSON.stringify(activation)
    );

    this.activationRepository.write(protectedData);

    return {
      activada: true,
      estado: "ACTIVACION_CORRECTA",
      licenciaId: license.licenciaId
    };
  }

  getValidatedActivation() {
    const license = this.licenseService.getValidatedLicense();
    const protectedData = this.activationRepository.read();

    if (!protectedData) {
      throw new Error("ACTIVACION_REQUERIDA");
    }

    let rawActivation;

    try {
      rawActivation = this.windowsProtection.unprotect(protectedData);
    } catch (error) {
      throw new Error("ACTIVACION_NO_VALIDA_PARA_ESTE_EQUIPO");
    }

    let activation;

    try {
      activation = JSON.parse(rawActivation);
    } catch (error) {
      throw new Error("ACTIVACION_FORMATO_INVALIDO");
    }

    if (
      activation.version !== 1 ||
      activation.producto !== "PARIS_LICORERIA"
    ) {
      throw new Error("ACTIVACION_INVALIDA");
    }

    if (activation.licenciaId !== license.licenciaId) {
      throw new Error("ACTIVACION_LICENCIA_NO_COINCIDE");
    }

    const currentFingerprint = this.machineFingerprint
      .generate()
      .toLowerCase();

    if (activation.equipo !== currentFingerprint) {
      throw new Error("ACTIVACION_EQUIPO_NO_COINCIDE");
    }

    return activation;
  }

  getStatus() {
    try {
      const activation = this.getValidatedActivation();

      return {
        activada: true,
        estado: "ACTIVACION_VALIDA",
        licenciaId: activation.licenciaId,
        fechaActivacion: activation.fechaActivacion
      };
    } catch (error) {
      return {
        activada: false,
        estado: error.message
      };
    }
  }
}

module.exports = ActivationService;
