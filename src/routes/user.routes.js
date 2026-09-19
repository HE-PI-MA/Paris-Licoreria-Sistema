const express=require('express'),RoleMiddleware=require('../middleware/RoleMiddleware');
class UserRoutes{constructor(controller,license,auth){this.router=express.Router();this.router.use(license.requireActivation,auth.requireAuth,new RoleMiddleware().allow('ADMINISTRADOR'));
 this.router.get('/',controller.handle('list',req=>[req.query]));this.router.get('/:id',controller.handle('detail',req=>[req.params.id]));this.router.post('/',controller.handle('create',req=>[req.authUser,req.get('x-operation-id'),req.body],{created:true}));this.router.post('/:id',controller.handle('update',req=>[req.authUser,req.get('x-operation-id'),req.params.id,req.body]));}
 getRouter(){return this.router;}}
module.exports=UserRoutes;
