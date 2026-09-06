const express = require("express");

class WebRoutes {
  constructor(webController, licenseMiddleware, authMiddleware) {
    this.router = express.Router();
    this.webController = webController;
    this.licenseMiddleware = licenseMiddleware;
    this.authMiddleware = authMiddleware;
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", this.webController.home);
    this.router.get("/login", this.webController.login);
    this.router.get("/activar", this.webController.activation);

    this.router.get(
      "/inicio",
      this.licenseMiddleware.requireActivation,
      this.authMiddleware.requireAuth,
      this.webController.inicio
    );
  }

  getRouter() {
    return this.router;
  }
}

module.exports = WebRoutes;
