const crypto=require('node:crypto');const Input=require('../domain/OperationInput');const {RecordError}=require('../domain/RecordInput');
class SaleService{
 constructor(repository){this.repository=repository;}
 products(actor,query){return this.repository.products(Input.text(query.term,120,'term',true));}
 async create(actor,key,body){const data=Input.sale(body),operation=Input.key(key),session=await this.repository.openSession(actor.idUsuario);if(!session)throw new RecordError(409,'Abre tu turno de caja antes de registrar una venta.');const hash=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');try{const id=await this.repository.create(actor.idUsuario,session.id,operation,hash,data);return {id};}catch(error){
   // Dos reintentos idénticos pueden competir por la clave única. Si el primero ya confirmó,
   // devolver su mismo id mantiene exactamente-una-venta sin convertir un reintento válido en error.
   if(error.code==='ER_DUP_ENTRY'&&typeof this.repository.operation==='function'){
     const existing=await this.repository.operation(session.id,operation);
     if(existing&&existing.hash===hash)return {id:Number(existing.id)};
     if(existing)throw new RecordError(409,'La clave de guardado ya fue utilizada con otra venta.');
   }
   if(error.code==='ER_SIGNAL_EXCEPTION'||error.code==='ER_DUP_ENTRY')throw new RecordError(409,error.sqlMessage||'La venta no pudo confirmarse. Revisa caja, stock y pago.');throw error;}}
 list(actor,query){const input=Input.page(query,['date','total','user','state']);if(!query.sort)input.sort='date';if(!query.direction)input.direction='desc';if(query.state!==undefined&&query.state!==''){if(!['VIGENTE','ANULADA'].includes(query.state))throw new RecordError(400,'Estado de venta no válido.');input.state=query.state;}else input.state='';return this.repository.list(input,actor);}
 async detail(actor,id){const row=await this.repository.detail(Input.id(id),actor);if(!row)throw new RecordError(404,'La venta no existe o no tienes permiso para verla.');return row;}
 async cancel(actor,id,body){if(actor.rol!=='ADMINISTRADOR')throw new RecordError(403,'Solo el administrador puede anular ventas.');const data=Input.cancellation(body);try{await this.repository.cancel(actor.idUsuario,Input.id(id),data);return {id:Number(id),state:'ANULADA'};}catch(error){if(error.code==='ER_SIGNAL_EXCEPTION'||error.code==='ER_DUP_ENTRY')throw new RecordError(409,error.sqlMessage||'No se pudo anular la venta.');throw error;}}
}
module.exports=SaleService;
