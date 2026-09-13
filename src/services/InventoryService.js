/** Inventario administra diferencias reales y traslados, con motivo, versiones y reintentos atómicos. */
const crypto=require('node:crypto'),Input=require('../domain/InventoryInput'),{RecordError}=require('../domain/RecordInput'),Decimal=require('../../public/js/components/decimal');
class InventoryService {
 constructor(repository){this.repository=repository;}
 list(query){return this.repository.list(Input.listing(query));}
 locations(query){Input.body(query,['term','page','pageSize']);return this.repository.places.list(Input.page(query));}
 history(query){return this.repository.movements.list(Input.history(query));}
 async detail(id){const row=await this.repository.detail(Input.id(id));if(!row)throw new RecordError(404,'El producto no existe.');return row;}
 async lots(id,query){await this.detail(id);return this.repository.lots(Input.id(id),Input.lots(query));}
 async stock(id){const row=await this.repository.stock(Input.id(id));if(!row)throw new RecordError(404,'La existencia no existe.');return row;}
 signed(value){return value<0n?'-'+Decimal.text(-value,3):Decimal.text(value,3);}
 async destination(c,data){
  const row=data.destinationId?await this.repository.places.get(c,data.destinationId):await this.repository.places.named(c,data.destinationName);
  if(row?.state==='ACTIVO')return row.id;
  if(row||data.destinationId)throw new RecordError(422,'La ubicación de destino no está activa.',{destinationText:'Elige un destino activo.'});
  return this.repository.places.insert(c,data.destinationName);
 }
 transfer(user,key,body){return this.change('transfer',user,key,body);}
 count(user,key,body){return this.change('count',user,key,body);}
 remove(user,key,body){return this.change('remove',user,key,body);}
 async change(kind,user,key,body){
  const data=Input.movement(body,kind),userId=Input.id(user),metadata={userId,key:Input.key(key),hash:crypto.createHash('sha256').update(JSON.stringify(['inventory:'+kind,data])).digest('hex')};
  try{return await this.repository.write(metadata,async c=>{
   if((await this.repository.actor(c,userId))?.state!=='ACTIVO')throw new RecordError(403,'El usuario ya no está activo.');
   const row=await this.repository.lockStock(c,data.stockId);
   if(!row)throw new RecordError(404,'La existencia no está disponible.');
   if(row.version!==data.version)throw new RecordError(409,'La cantidad o los datos cambiaron. Cierra este formulario y vuelve a abrir la acción para revisar la existencia actual.');
   const before=Decimal.units(row.physicalStock,3),amount=Decimal.units(data.quantity,3);
   if(kind!=='count'&&amount>before)throw new RecordError(422,'La cantidad supera lo que hay en esa ubicación.',{quantity:'Disponible para esta operación: '+Decimal.format(row.physicalStock,3)});
   const common={lotId:row.lotId,userId,sourceId:row.locationId,before:row.physicalStock,reason:data.reason};let id,after;
   if(kind==='transfer'){
    const destinationId=await this.destination(c,data);if(destinationId===row.locationId)throw new RecordError(422,'El origen y el destino deben ser diferentes.',{destinationText:'Selecciona otra ubicación.'});
    const target=row.locations.find(r=>r.locationId===destinationId),destinationBefore=target?.quantity||'0.000',destinationAfter=Decimal.units(destinationBefore,3)+amount;
    if(destinationAfter>999999999999999n)throw new RecordError(422,'El destino supera la cantidad máxima permitida.');
    after=Decimal.text(before-amount,3);
    // Primero descontar origen; el límite de distribución del lote permanece válido al sumar el destino.
    await this.repository.setQuantity(c,row.id,after);
    const targetId=target?.id||await this.repository.addLocation(c,row.lotId,destinationId);
    await this.repository.setQuantity(c,targetId,Decimal.text(destinationAfter,3));
    id=await this.repository.movements.insert(c,{...common,type:'TRASLADO',quantity:data.quantity,after,destinationId,destinationBefore,destinationAfter:Decimal.text(destinationAfter,3)});
   }else if(kind==='count'){
    const difference=amount-before;if(difference===0n)throw new RecordError(422,'La cantidad contada es igual a la registrada. No hay diferencia que guardar.',{quantity:'Escribe la cantidad que contaste.'});
    after=data.quantity;
    // El trigger considera la diferencia registrada y conserva intacta la cantidad comprada original.
    id=await this.repository.movements.insert(c,{...common,type:'CONTEO',quantity:this.signed(difference),after});
    await this.repository.setQuantity(c,row.id,after);
   }else{
    if(data.type==='VENCIDO'&&row.expiryStatus!=='VENCIDO')throw new RecordError(422,'Ese lote todavía no está vencido. Selecciona el motivo correcto.',{type:'Revisa el motivo del retiro.'});
    id=await this.repository.remove(c,userId,data);after=Decimal.text(before-amount,3);
   }
   return {id,kind,stockId:row.id,productId:row.productId,quantity:after};
  });}catch(error){
   if(error instanceof RecordError)throw error;
   if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','ER_DUP_ENTRY'].includes(error.code))throw new RecordError(409,'Otra operación está usando estos registros. Reintenta guardar el mismo movimiento.');
   if(['ER_SIGNAL_EXCEPTION','ER_NO_REFERENCED_ROW_2','ER_CHECK_CONSTRAINT_VIOLATED','ER_DATA_OUT_OF_RANGE'].includes(error.code))throw new RecordError(409,'El movimiento no cumple las reglas de existencias. Actualiza los datos y revisa las cantidades.');
   throw error;
  }
 }
}
module.exports=InventoryService;
