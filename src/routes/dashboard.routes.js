const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class DashboardRoutes{constructor(controller,license,auth){this.router=express.Router();this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR','ENCARGADO_VENTA'));this.router.get('/resumen',controller.handle('summary',req=>[req.authUser]));}getRouter(){return this.router;}}
module.exports=DashboardRoutes;
