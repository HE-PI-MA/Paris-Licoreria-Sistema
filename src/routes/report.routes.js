const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class ReportRoutes{constructor(controller,license,auth){this.router=express.Router();this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR'));this.router.get('/resumen',controller.handle('summary',req=>[req.query]));}getRouter(){return this.router;}}
module.exports=ReportRoutes;
