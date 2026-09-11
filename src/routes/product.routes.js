/** API del catálogo exclusiva del administrador. Todas las escrituras usan POST JSON y el CSRF global. */
const express = require('express');
const RoleMiddleware = require('../middleware/RoleMiddleware');
class ProductRoutes {
  constructor(controller, license, auth) {
    this.router = express.Router();
    this.router.use(license.requireActivation, auth.requireAuth, new RoleMiddleware().allow('ADMINISTRADOR'));
    this.router.get('/', controller.handle('list'));
    for (const kind of ['categories','units']) this.router.get('/opciones/' + kind, (req, res, next) => { req.params.kind = kind; return controller.handle('options')(req, res, next); });
    this.router.post('/', controller.handle('create', { write: true, created: true }));
    this.router.get('/:id', controller.handle('detail'));
    this.router.post('/:id/editar', controller.handle('update', { write: true }));
    this.router.post('/:id/estado', controller.handle('state', { write: true }));
    this.router.post('/:id/eliminar', controller.handle('remove', { write: true }));
    this.router.get('/:id/presentaciones', controller.handle('presentations'));
    this.router.post('/:id/presentaciones', controller.handle('savePresentation', { write: true, created: true }));
    this.router.get('/:id/presentaciones/:presentationId', controller.handle('presentation'));
    this.router.post('/:id/presentaciones/:presentationId/editar', controller.handle('savePresentation', { write: true }));
    this.router.post('/:id/presentaciones/:presentationId/estado', controller.handle('presentationState', { write: true }));
    this.router.post('/:id/presentaciones/:presentationId/eliminar', controller.handle('removePresentation', { write: true }));
  }
  getRouter() { return this.router; }
}
module.exports = ProductRoutes;
