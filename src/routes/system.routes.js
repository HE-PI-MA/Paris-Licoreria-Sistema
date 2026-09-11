/** Declara las rutas técnicas del sistema y sus restricciones de exposición. */
const express = require('express');

class SystemRoutes {
  constructor(systemController) {
    this.router = express.Router();
    this.systemController = systemController;

    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get('/estado', this.systemController.status);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = SystemRoutes;
