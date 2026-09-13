/** API de Proveedores exclusiva del administrador; las escrituras pasan por el CSRF global antes de esta ruta. */
const express = require('express');
const RoleMiddleware = require('../middleware/RoleMiddleware');
class SupplierRoutes {
  constructor(controller, license, auth) {
    this.router = express.Router();
    this.router.use(license.requireActivation, auth.requireAuth, new RoleMiddleware().allow('ADMINISTRADOR'));
    this.router.get('/', controller.handle('list'));
    this.router.get('/:id', controller.handle('detail'));
    this.router.post('/', controller.handle('create', { write: true, created: true }));
    this.router.post('/:id/editar', controller.handle('update', { write: true }));
    this.router.post('/:id/estado', controller.handle('state', { write: true }));
    this.router.post('/:id/eliminar', controller.handle('remove', { write: true }));
  }
  getRouter() { return this.router; }
}
module.exports = SupplierRoutes;
