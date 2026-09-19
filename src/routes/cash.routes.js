const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class CashRoutes{constructor(controller,license,auth){this.router=express.Router();this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR','ENCARGADO_VENTA'));
 this.router.get('/estado',controller.handle('status',req=>[req.authUser]));this.router.get('/cajas',controller.handle('boxes'));this.router.get('/denominaciones',controller.handle('denominations'));
 this.router.get('/',controller.handle('history',req=>[req.authUser,req.query]));this.router.post('/abrir',controller.handle('open',req=>[req.authUser,req.body],{created:true}));this.router.post('/cerrar',controller.handle('close',req=>[req.authUser,req.body]));}
 getRouter(){return this.router;}}
module.exports=CashRoutes;
