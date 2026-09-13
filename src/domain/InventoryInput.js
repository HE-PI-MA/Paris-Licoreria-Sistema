/** Contratos de Inventario: cantidades exactas, referencias vigentes y motivos obligatorios. */
const {ProductInput,ProductError:RecordError}=require('./ProductInput');
class InventoryInput extends ProductInput {
 static choice(value,options,field){const text=value||'';if(!options.includes(text))throw new RecordError(422,'Revisa el filtro o motivo seleccionado.',{[field]:'Selecciona una opción de la lista.'});return text;}
 static listing(query){
  this.body(query,['term','page','pageSize','sort','direction','categoryId','alert']);
  return {...this.page(query,['name','stock','physicalStock']),alert:this.choice(query.alert,['','BAJO','AGOTADO','PROXIMO','VENCIDO'],'alert')};
 }
 static lots(query){this.body(query,['term','page','pageSize','sort','direction','locationId']);return {...super.page({...query,sort:query.sort||'location'},['location','expiresOn','stock']),locationId:query.locationId?this.id(query.locationId):null};}
 static history(query){
  this.body(query,['term','page','pageSize','sort','direction','productId','locationId','type']);
  return {...super.page({...query,sort:query.sort||'date',direction:query.direction||'desc'},['date']),productId:query.productId?this.id(query.productId):null,
   locationId:query.locationId?this.id(query.locationId):null,type:this.choice(query.type,['','COMPRA','TRASLADO','CONTEO','RETIRO','VENTA'],'type')};
 }
 static movement(body,kind){
  this.body(body,['stockId','version','quantity','reason',...(kind==='transfer'?['destinationId','destinationName']:kind==='remove'?['type']:[])]);
  const result={stockId:this.id(body.stockId),version:this.version(body.version),quantity:this.decimal(body.quantity,3,'quantity',kind!=='count'),reason:this.text(body.reason,250,'reason').toLocaleUpperCase('es')};
  if(kind==='remove')result.type=this.choice(body.type,['DAÑADO','PERDIDO','VENCIDO','OTRO'],'type');
  if(kind==='transfer'){
   if(body.destinationName===undefined)result.destinationId=this.id(body.destinationId,'destinationText');
   else {if(body.destinationId!==undefined)throw new RecordError(422,'Indica un solo destino.');result.destinationName=this.text(this.text(body.destinationName,80,'destinationText').replace(/\s+/g,' ').toLocaleUpperCase('es'),80,'destinationText');}
  }
  return result;
 }
}
module.exports=InventoryInput;
