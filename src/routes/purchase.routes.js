/** Compras requiere administrador, sesión y activación; todas las escrituras conservan el CSRF global. */
const express = require('express');
const RoleMiddleware = require('../middleware/RoleMiddleware');
class PurchaseRoutes {
  constructor(controller,license,auth) {
    this.router=express.Router();
    this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR'));
    this.router.get('/',controller.handle('list'));
    this.router.get('/ubicaciones',controller.handle('locations'));
    this.router.get('/:id',controller.handle('detail'));
    this.router.post('/',controller.handle('create',{write:true,created:true}));
  }
  getRouter(){return this.router;}
}
module.exports=PurchaseRoutes;
