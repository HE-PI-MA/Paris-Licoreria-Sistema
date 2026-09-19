const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class SaleRoutes{constructor(controller,license,auth){this.router=express.Router();this.router.use(express.json({limit:'64kb'}));this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR','ENCARGADO_VENTA'));
 this.router.get('/productos',controller.handle('products',req=>[req.authUser,req.query]));this.router.get('/',controller.handle('list',req=>[req.authUser,req.query]));this.router.get('/:id',controller.handle('detail',req=>[req.authUser,req.params.id]));
 this.router.post('/',controller.handle('create',req=>[req.authUser,req.get('x-operation-id'),req.body],{created:true}));this.router.post('/:id/anular',controller.handle('cancel',req=>[req.authUser,req.params.id,req.body]));}
 getRouter(){return this.router;}}
module.exports=SaleRoutes;
