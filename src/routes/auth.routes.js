const express = require('express');
const loginRateLimiter = require('../middleware/loginRateLimiter');

class AuthRoutes {
  constructor(authController) {
    this.router = express.Router();
    this.authController = authController;

    this.registerRoutes();
  }

  registerRoutes() {
    this.router.post(
      '/login',
      loginRateLimiter,
      this.authController.login
    );

    this.router.post('/logout', this.authController.logout);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AuthRoutes;
