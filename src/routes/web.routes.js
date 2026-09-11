/** Registra páginas públicas, módulos autorizados y la demostración exclusiva de administración. */
const express = require("express");
const navigation = require('../config/navigation');

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

    this.router.get(
      '/perfil',
      this.licenseMiddleware.requireActivation,
      this.authMiddleware.requireAuth,
      this.webController.perfil
    );

    // La demostración está fuera del menú operativo y utiliza datos ficticios del navegador.
    this.router.get('/demostracion/componentes', this.licenseMiddleware.requireActivation,
      this.authMiddleware.requireAuth, (req, res) => {
        const page = req.authUser.rol === 'ADMINISTRADOR'
          ? { id: 'demo-componentes', label: 'Demostración de componentes', icon: 'box' }
          : { id: 'forbidden', label: 'Acceso restringido', icon: 'lock' };
        return this.webController.renderWorkspace(req, res, page, page.id === 'forbidden' ? 403 : 200);
      });

    // Ocultar un enlace no autoriza el recurso: comprobar también las peticiones directas.
    for (const item of navigation.modules.filter(item => item.id !== 'inicio')) {
      this.router.get(item.href, this.licenseMiddleware.requireActivation,
        this.authMiddleware.requireAuth, (req, res) => {
          if (!navigation.allowed(item, req.authUser.rol)) {
            return this.webController.renderWorkspace(req, res,
              { id: 'forbidden', label: 'Acceso restringido', icon: 'lock' }, 403);
          }
          return this.webController.renderWorkspace(req, res, item);
        });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = WebRoutes;
