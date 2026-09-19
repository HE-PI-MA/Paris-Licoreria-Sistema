/** Respuesta HTTP segura para módulos operativos. Los servicios conservan reglas y validaciones. */
const {RecordError}=require('../domain/RecordInput');const safeLog=require('../utils/safeLog');
class BusinessController{
 constructor(service,{label='Operación',event='BUSINESS_REQUEST_FAILED'}={}){this.service=service;this.label=label;this.event=event;}
 handle(method,args=()=>[] ,{created=false}={}){return async(req,res)=>{try{return res.status(created?201:200).json(await this.service[method](...args(req)));}catch(error){if(error instanceof RecordError)return res.status(error.status).json({error:error.message,fieldErrors:error.fieldErrors});safeLog(this.event,error,req.requestId);const setup=['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR','ER_TABLEACCESS_DENIED_ERROR','ER_COLUMNACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR','ER_PROCACCESS_DENIED_ERROR','ER_SP_DOES_NOT_EXIST','ER_VIEW_INVALID'].includes(error.code);return res.status(setup?503:500).json({error:setup?this.label+' necesita completar U039 o sus permisos de base de datos.':'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.',requestId:req.requestId});}};}
}
module.exports=BusinessController;
