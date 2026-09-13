/** Compras de prueba en memoria con OperationStore real. Cada transacción clona el estado y solo lo publica al confirmar. */
const Repository=require('../../src/repositories/PurchaseRepository');
const Products=require('../../src/repositories/ProductRepository');
const Suppliers=require('../../src/repositories/SupplierRepository');
class PurchaseMemoryPool {
 constructor(){this.queue=Promise.resolve();this.data={locations:[{id:1,name:"ALMACÉN DE PRUEBA",state:"ACTIVO"}],suppliers:[],products:[],presentations:[],purchases:[],lines:[],operations:new Map()};}
 async getConnection(){const pool=this;let release;return {
  async beginTransaction(){const previous=pool.queue;pool.queue=new Promise(r=>{release=r;});await previous;this.data=structuredClone(pool.data);},
  async query(sql,args=[]){
   if(sql.startsWith('SET TRANSACTION'))return [[]];
   const id=args[0]+':'+args[1];
   if(sql.startsWith('INSERT INTO catalogo_operacion')){if(this.data.operations.has(id))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});this.data.operations.set(id,{hash:args[2],result:null});return [{}];}
   if(sql.startsWith('SELECT solicitud_hash'))return [[this.data.operations.get(id)]];
   if(sql.startsWith('UPDATE catalogo_operacion')){this.data.operations.get(args[1]+':'+args[2]).result=args[0];return [{}];}
   throw new Error('Unexpected SQL: '+sql);
  },async commit(){pool.data=this.data;},async rollback(){},release(){release?.();}
 };}
}
class PurchaseMemoryProducts extends Products {
 rows(c,key){return (c?.data || this.pool.data)[key];}
 async getProduct(id,c){return this.decorate(this.rows(c,'products').find(r=>r.id===Number(id)));}
 async getPresentation(productId,id,c){return this.decorate(this.rows(c,'presentations').find(r=>r.id===Number(id)&&r.productId===Number(productId)),true);}
 async detail(id){const row=await this.getProduct(id);return row && {...row,category:'BEBIDAS',unit:'UNIDAD'};}
 async presentationDetail(id,child){return this.getPresentation(id,child);}
 async list(input){const rows=this.rows(null,'products').filter(r=>(!input.state||r.state===input.state)&&r.name.includes(input.term.toUpperCase()));return {records:rows.slice((input.page-1)*input.pageSize,input.page*input.pageSize).map(r=>this.decorate(r)),total:rows.length};}
 async presentations(id,input){const rows=this.rows(null,'presentations').filter(r=>r.productId===Number(id)&&(!input.state||r.state===input.state)&&r.name.includes(input.term.toUpperCase()));return {records:rows.slice((input.page-1)*input.pageSize,input.page*input.pageSize).map(r=>this.decorate(r,true)),total:rows.length};}
 async options(kind){return {options:[{value:'1',label:kind==='categories'?'BEBIDAS':'UNIDAD'}],total:1};}
 async category(c,id){return Number(id)===1?{state:'ACTIVO'}:null;}
 async unit(c,id){return Number(id)===1?{id:1}:null;}
 async insertProduct(c,data){const id=c.data.products.length+1;c.data.products.push({...data,id,categoryId:Number(data.categoryId),unitId:Number(data.unitId)});return {id};}
 async insertPresentation(c,productId,data){if(data.barcode&&c.data.presentations.some(r=>r.barcode===data.barcode))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});const id=c.data.presentations.length+1;c.data.presentations.push({...data,id,productId});return {id};}
}
class PurchaseMemorySuppliers extends Suppliers {
 async get(id,c){return this.decorate((c?.data || this.pool.data).suppliers.find(r=>r.id===Number(id)));}
 async insert(c,data){const id=c.data.suppliers.length+1;c.data.suppliers.push({...data,id});return {id};}
 async list(input){const rows=this.pool.data.suppliers.filter(r=>(!input.state||r.state===input.state)&&r.name.includes(input.term.toUpperCase()));return {records:rows.slice((input.page-1)*input.pageSize,input.page*input.pageSize).map(r=>this.decorate(r)),total:rows.length};}
}
class PurchaseMemoryRepository extends Repository {
 constructor(){super(new PurchaseMemoryPool());this.products=new PurchaseMemoryProducts(this.pool);this.suppliers=new PurchaseMemorySuppliers(this.pool);}
 async namedSupplier(c,name){return c.data.suppliers.find(r=>r.name.toUpperCase()===name.toUpperCase());}
 async namedProduct(c,name){return c.data.products.find(r=>r.name.toUpperCase()===name.toUpperCase());}
 async namedPresentation(c,id,name){return c.data.presentations.find(r=>r.productId===id&&r.name.toUpperCase()===name.toUpperCase());}
 async actor(){return {state:'ACTIVO'};}
 async location(c,id){return c.data.locations.find(row=>row.id===Number(id));}
 async namedLocation(c,name){return c.data.locations.find(row=>row.name.toUpperCase()===name.toUpperCase());}
 async insertLocation(c,name){const id=c.data.locations.length+1;c.data.locations.push({id,name,state:'ACTIVO'});return id;}
 async locations(input){const rows=this.pool.data.locations.filter(row=>row.state==='ACTIVO'&&row.name.includes(input.term.toUpperCase()));return {options:rows.slice((input.page-1)*input.pageSize,input.page*input.pageSize).map(row=>({value:String(row.id),label:row.name})),total:rows.length};}
 async insert(c,supplierId,userId,observation){const id=c.data.purchases.length+1;c.data.purchases.push({id,supplierId,userId,observation});return id;}
 async insertLine(c,purchaseId,presentationId,locationId,line,baseQuantity){if(this.failLine)throw new Error('Simulated storage failure');c.data.lines.push({id:c.data.lines.length+1,purchaseId,presentationId,locationId,...line,baseQuantity});}
 async list(input){if(this.failList)throw new Error('Simulated connection failure');let rows=this.pool.data.purchases.map(p=>this.header(p)).filter(r=>r.supplier.includes(input.term.toUpperCase())||String(r.id)===input.term);return {records:rows.slice((input.page-1)*input.pageSize,input.page*input.pageSize),total:rows.length};}
 header(p){const lines=this.pool.data.lines.filter(l=>l.purchaseId===p.id);return {...p,date:'13/09/2026 10:30',user:'USUARIO DE PRUEBA',supplier:this.pool.data.suppliers.find(s=>s.id===p.supplierId).name,total:require('../../public/js/components/decimal').total(lines)};}
 async detail(id){const p=this.pool.data.purchases.find(p=>p.id===Number(id));if(!p)return null;return {...this.header(p),lines:this.pool.data.lines.filter(l=>l.purchaseId===p.id).map(l=>{const pres=this.pool.data.presentations.find(p=>p.id===l.presentationId),prod=this.pool.data.products.find(p=>p.id===pres.productId);return {...l,rowId:l.id,product:prod.name,presentation:pres.name,unit:'UNIDAD',factor:pres.factor,subtotal:require('../../public/js/components/decimal').multiply(l.quantity,l.cost,2),location:this.pool.data.locations.find(row=>row.id===Number(l.locationId)).name};})};}
}
function body(){return {supplier:{name:'DISTRIBUIDORA FICTICIA',phone:'70000000'},locationId:'1',observation:'PRUEBA',lines:[{product:{clientKey:require('node:crypto').randomUUID(),name:'CERVEZA FICTICIA',categoryId:'1',unitId:'1'},presentation:{name:'PAQUETE DE 6',factor:'6',barcode:'Prueba-001',price:'60'},quantity:'2',cost:'45.25',lotCode:'L-01',expiresOn:'2027-12-31'}]};}
module.exports={PurchaseMemoryRepository,body};
