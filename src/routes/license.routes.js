/** Conecta las rutas HTTP de consulta y activación con LicenseController. */
const express = require("express");

class LicenseRoutes {
  constructor(licenseController) {
    this.router = express.Router();
    this.licenseController = licenseController;
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/estado", this.licenseController.status);
    this.router.post("/activar", this.licenseController.activate);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = LicenseRoutes;
