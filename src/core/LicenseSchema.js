class LicenseSchema {
  static isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(value + "T00:00:00Z");

    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  }

  static validate(license) {
    if (!license || typeof license !== "object") {
      throw new Error("LICENCIA_ESTRUCTURA_INVALIDA");
    }

    const requiredFields = [
      "version",
      "producto",
      "licenciaId",
      "cliente",
      "tipo",
      "fechaEmision",
      "equipo",
      "activacionHash",
      "firma"
    ];

    for (const field of requiredFields) {
      if (license[field] === undefined || license[field] === null) {
        throw new Error("LICENCIA_CAMPO_FALTANTE_" + field.toUpperCase());
      }
    }

    if (!Object.prototype.hasOwnProperty.call(license, "fechaExpiracion")) {
      throw new Error("LICENCIA_CAMPO_FALTANTE_FECHAEXPIRACION");
    }

    if (license.version !== 1) {
      throw new Error("LICENCIA_VERSION_NO_COMPATIBLE");
    }

    if (license.producto !== "PARIS_LICORERIA") {
      throw new Error("LICENCIA_PRODUCTO_INVALIDO");
    }

    if (typeof license.licenciaId !== "string" || !license.licenciaId.trim()) {
      throw new Error("LICENCIA_ID_INVALIDO");
    }

    if (typeof license.cliente !== "string" || !license.cliente.trim()) {
      throw new Error("LICENCIA_CLIENTE_INVALIDO");
    }

    if (!["PERMANENTE", "TEMPORAL"].includes(license.tipo)) {
      throw new Error("LICENCIA_TIPO_INVALIDO");
    }

    if (!this.isValidDate(license.fechaEmision)) {
      throw new Error("LICENCIA_FECHA_EMISION_INVALIDA");
    }

    if (license.tipo === "PERMANENTE" && license.fechaExpiracion !== null) {
      throw new Error("LICENCIA_PERMANENTE_NO_DEBE_EXPIRAR");
    }

    if (
      license.tipo === "TEMPORAL" &&
      !this.isValidDate(license.fechaExpiracion)
    ) {
      throw new Error("LICENCIA_FECHA_EXPIRACION_INVALIDA");
    }

    if (!/^[a-fA-F0-9]{64}$/.test(license.equipo)) {
      throw new Error("LICENCIA_EQUIPO_INVALIDO");
    }

    if (!/^[a-fA-F0-9]{64}$/.test(license.activacionHash)) {
      throw new Error("LICENCIA_ACTIVACION_INVALIDA");
    }

    if (typeof license.firma !== "string" || license.firma.length < 20) {
      throw new Error("LICENCIA_FIRMA_INVALIDA");
    }

    return true;
  }
}

module.exports = LicenseSchema;
