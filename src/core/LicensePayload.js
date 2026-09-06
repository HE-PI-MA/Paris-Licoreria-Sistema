class LicensePayload {
  static serialize(license) {
    const payload = {
      version: license.version,
      producto: license.producto,
      licenciaId: license.licenciaId,
      cliente: license.cliente,
      tipo: license.tipo,
      fechaEmision: license.fechaEmision,
      fechaExpiracion: license.fechaExpiracion,
      equipo: license.equipo,
      activacionHash: license.activacionHash
    };

    return JSON.stringify(payload);
  }
}

module.exports = LicensePayload;
