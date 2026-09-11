/** Declara las rutas de autenticación y el orden de los controles de licencia y sesión. */
const express = require("express");

class AuthRoutes {
  constructor(authController, licenseMiddleware, authMiddleware) {
    this.router = express.Router();
    this.authController = authController;
    this.licenseMiddleware = licenseMiddleware;
    this.authMiddleware = authMiddleware;
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.post(
      "/login",
      this.licenseMiddleware.requireActivation,
      this.authController.login
    );

    this.router.get(
      "/me",
      this.licenseMiddleware.requireActivation,
      this.authMiddleware.requireAuth,
      this.authController.me
    );

    this.router.post("/logout", this.authController.logout);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AuthRoutes;
