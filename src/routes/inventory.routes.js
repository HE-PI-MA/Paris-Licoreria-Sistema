/** Inventario exige activación, sesión y administrador. Las escrituras pasan por el CSRF global y OperationStore. */
const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class InventoryRoutes {
 constructor(controller,license,auth){
  this.router=express.Router();this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR'));
  for(const [route,method]of [['/','list'],['/ubicaciones','locations'],['/movimientos','history'],['/existencias/:id','stock'],['/:id/lotes','lots'],['/:id','detail']])this.router.get(route,controller.handle(method));
  for(const [route,method]of [['/traslados','transfer'],['/conteos','count'],['/retiros','remove']])this.router.post(route,controller.handle(method,{write:true,created:true}));
 }
 getRouter(){return this.router;}
}
module.exports=InventoryRoutes;
