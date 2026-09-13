/** Declara los argumentos de Inventario y hereda el transporte y los errores seguros del controlador compartido. */
const CatalogController=require('./CatalogController');
class InventoryController extends CatalogController {
 constructor(service){super(service,{label:'Inventario',event:'INVENTORY_REQUEST_FAILED'});}
 arguments(req,method,write){
  if(['transfer','count','remove'].includes(method))return [req.authUser.idUsuario,req.get('x-operation-id'),req.body];
  if(method==='history')return [req.query];
  if(method==='lots')return [req.params.id,req.query];
  return super.arguments(req,method,write);
 }
}
module.exports=InventoryController;
