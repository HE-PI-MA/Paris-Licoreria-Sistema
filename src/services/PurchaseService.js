/** Orquesta una compra atómica e idempotente. Reutiliza catálogos existentes y convierte presentaciones a stock base dentro del bloqueo. */
const crypto = require('node:crypto');
const Input = require('../domain/PurchaseInput');
const { RecordError } = require('../domain/RecordInput');
const ProductService = require('./ProductService');
const Decimal = require('../../public/js/components/decimal');
class PurchaseService {
  constructor(repository) { this.repository=repository; this.products=new ProductService(repository.products); }
  list(query) { return this.repository.list(Input.list(query)); }
  locations(query) { Input.body(query,['term','page','pageSize']); return this.repository.locations(Input.page(query)); }
  async detail(id) { const row=await this.repository.detail(Input.id(id)); if(!row)throw new RecordError(404,'La compra no existe.'); return row; }
  current(row,ref,label) {
    if(!row || row.state!=='ACTIVO')throw new RecordError(409,label+' no está disponible. Revisa la selección.');
    if(row.version!==ref.version)throw new RecordError(409,label+' cambió. Vuelve a seleccionarlo para revisar sus datos actuales.');
    return row;
  }
  async supplier(c,data) {
    if(data.id)return this.current(await this.repository.suppliers.get(data.id,c,true),data,'El proveedor').id;
    if(await this.repository.namedSupplier(c,data.name))throw new RecordError(409,'El proveedor ya está registrado. Selecciónalo en las sugerencias; si está inactivo, revísalo en Proveedores.');
    return (await this.repository.suppliers.insert(c,data)).id;
  }
  async product(c,data,cache) {
    if(data.id)return this.current(await this.repository.products.getProduct(data.id,c,true),data,'El producto');
    const previous=cache.get(data.clientKey);
    if(previous) {
      if(previous.fingerprint!==JSON.stringify(data))throw new RecordError(422,'El mismo producto nuevo tiene datos diferentes entre filas.');
      return previous.row;
    }
    if(await this.repository.namedProduct(c,data.name))throw new RecordError(409,'El producto '+data.name+' ya está registrado. Selecciónalo en las sugerencias.');
    await this.products.referenceChecks(c,data);
    const row={...data,...await this.repository.products.insertProduct(c,data)};
    cache.set(data.clientKey,{fingerprint:JSON.stringify(data),row}); return row;
  }
  async presentation(c,productId,data,cache) {
    if(data.id)return this.current(await this.repository.products.getPresentation(productId,data.id,c,true),data,'La presentación');
    const key=productId+':'+data.name.toLocaleUpperCase('es'), previous=cache.get(key);
    if(previous) {
      if(previous.fingerprint!==JSON.stringify(data))throw new RecordError(422,'La misma presentación nueva tiene datos diferentes entre filas.');
      return previous.row;
    }
    if(await this.repository.namedPresentation(c,productId,data.name))throw new RecordError(409,'La presentación '+data.name+' ya existe. Selecciónala en las sugerencias.');
    const row={...data,...await this.repository.products.insertPresentation(c,productId,data)};
    cache.set(key,{fingerprint:JSON.stringify(data),row}); return row;
  }
  async create(actor,key,body) {
    const data=Input.purchase(body), userId=Input.id(actor), total=Decimal.total(data.lines);
    if(Decimal.units(total,2)>999999999999999n)throw new RecordError(422,'El total supera el importe permitido de la compra.');
    const metadata={userId,key:Input.key(key),hash:crypto.createHash('sha256').update(JSON.stringify(['purchase:create',data])).digest('hex')};
    try {
      return await this.repository.write(metadata,async c=>{
        if((await this.repository.actor(c,userId))?.state!=='ACTIVO')throw new RecordError(403,'El usuario ya no está activo.');
        if((await this.repository.location(c,data.locationId))?.state!=='ACTIVO')throw new RecordError(422,'Selecciona una ubicación activa.',{locationId:'La ubicación no está disponible.'});
        const supplierId=await this.supplier(c,data.supplier), products=new Map(), presentations=new Map();
        const id=await this.repository.insert(c,supplierId,userId,data.observation);
        for(const [index,line] of data.lines.entries()) {
          try {
            const product=await this.product(c,line.product,products);
            const presentation=await this.presentation(c,product.id,line.presentation,presentations);
            const baseQuantity=Decimal.multiply(line.quantity,presentation.factor,3), units=Decimal.units(baseQuantity,3);
            if(units<=0n || units>999999999999999n)throw new RecordError(422,'La cantidad convertida debe estar entre 0,001 y 999.999.999.999,999 unidades base.');
            await this.repository.insertLine(c,id,presentation.id,data.locationId,line,baseQuantity);
          } catch(error) { if(error instanceof RecordError)throw new RecordError(error.status,'Fila '+(index+1)+': '+error.message); throw error; }
        }
        return {id,total};
      });
    } catch(error) {
      if(error instanceof RecordError)throw error;
      if(error.code==='ER_DUP_ENTRY')throw new RecordError(409,'Ya existe una presentación o código de barras con esos datos. Revisa las sugerencias.');
      if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw new RecordError(409,'Otra operación está usando estos registros. Reintenta guardar la misma compra.');
      if(['ER_NO_REFERENCED_ROW_2','ER_SIGNAL_EXCEPTION'].includes(error.code))throw new RecordError(409,'Los datos cambiaron o no cumplen las reglas de stock. Revisa las filas antes de reintentar.');
      throw error;
    }
  }
}
module.exports = PurchaseService;
