/** Contrato de compras con datos ficticios: atomicidad, idempotencia, referencias, precisión y protección HTTP. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PurchaseMemoryRepository,body}=require('./support/purchase-fixture');
const Service=require('../src/services/PurchaseService'),Input=require('../src/domain/PurchaseInput'),Decimal=require('../public/js/components/decimal');
const {server,password}=require('./support/application-fixture');
const key=()=>crypto.randomUUID();
test('Ubicaciones: conserva el contrato U025 y valida nombres nuevos sin destinos ambiguos',()=>{
 const payload=body(),previous=Input.purchase(payload);
 assert.equal(previous.locationId,1);assert.equal(Object.hasOwn(previous,'locationName'),false);
 const {locationId,...inline}=payload;
 assert.equal(Input.purchase({...inline,locationName:'  heladera   dos  '}).locationName,'HELADERA DOS');
 for(const name of ['', ' ', 'a'.repeat(81), '\u0000HELADERA', null, 123])assert.throws(()=>Input.purchase({...inline,locationName:name}),e=>e.status===422);
 assert.throws(()=>Input.purchase({...payload,locationName:'HELADERA'}),e=>e.status===422);
});
test('Ubicaciones: alta atómica, reintento idempotente, reutilización exacta y rechazo de inactivas',async()=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo),payload=body(),operation=key();delete payload.locationId;payload.locationName='heladera';
 const [a,b]=await Promise.all([service.create(1,operation,payload),service.create(1,operation,payload)]);assert.deepEqual(a,b);
 assert.equal(repo.pool.data.locations.length,2);assert.equal((await service.detail(a.id)).lines[0].location,'HELADERA');
 assert.deepEqual(await service.locations({term:'heladera'}),{options:[{value:'2',label:'HELADERA'}],total:1});
 const ref=r=>({id:r.id,version:r.version});
 const existing={...payload,supplier:ref(await repo.suppliers.get(1)),lines:[{...payload.lines[0],product:ref(await repo.products.getProduct(1)),presentation:ref(await repo.products.getPresentation(1,1))}]};
 await service.create(1,key(),existing);assert.equal(repo.pool.data.locations.length,2);assert.equal(repo.pool.data.lines.at(-1).locationId,2);
 repo.pool.data.locations[1].state='INACTIVO';await assert.rejects(service.create(1,key(),existing),e=>e.status===422&&Boolean(e.fieldErrors.locationIdText));
 assert.equal(repo.pool.data.locations[1].state,'INACTIVO');assert.equal(repo.pool.data.purchases.length,2);
});
test('Ubicaciones: un error tardío revierte el lugar nuevo y permite volver a guardar',async()=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo),payload=body(),operation=key();delete payload.locationId;payload.locationName='CAJA DOS';
 repo.failLine=true;await assert.rejects(service.create(1,operation,payload));assert.equal(repo.pool.data.locations.length,1);assert.equal(repo.pool.data.operations.size,0);
 repo.failLine=false;await service.create(1,operation,payload);assert.equal(repo.pool.data.locations.length,2);assert.equal(repo.pool.data.locations[1].name,'CAJA DOS');
});
test('Compras: altas conjuntas, equivalencia, total y reintento concurrente sin duplicar',async()=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo),payload=body(),operation=key();
 const [a,b]=await Promise.all([service.create(1,operation,payload),service.create(1,operation,payload)]);assert.deepEqual(a,b);assert.equal(a.total,'90.50');
 assert.equal(repo.pool.data.suppliers.length,1);assert.equal(repo.pool.data.products.length,1);assert.equal(repo.pool.data.presentations.length,1);assert.equal(repo.pool.data.purchases.length,1);assert.equal(repo.pool.data.lines[0].baseQuantity,'12.000');
 await assert.rejects(service.create(1,operation,{...payload,observation:'CAMBIO'}),e=>e.status===409);
 const supplier=await repo.suppliers.get(1),product=await repo.products.getProduct(1),presentation=await repo.products.getPresentation(1,1);
 const ref=r=>({id:r.id,version:r.version});const existing={...payload,supplier:ref(supplier),lines:[{...payload.lines[0],product:ref(product),presentation:ref(presentation)}]};
 await service.create(1,key(),existing);assert.equal(repo.pool.data.suppliers[0].phone,'70000000');assert.equal(repo.pool.data.presentations.length,1);
 await assert.rejects(service.create(1,key(),{...existing,supplier:{...existing.supplier,phone:'77777777'}}),e=>e.status===400);
 repo.pool.data.presentations[0].factor='12.000';await assert.rejects(service.create(1,key(),existing),e=>e.status===409);
});
test('Compras: una fila inválida o fallo de stock revierte también catálogos y clave de operación',async()=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo),payload=body();
 payload.lines.push({...payload.lines[0],product:{...payload.lines[0].product,clientKey:key(),name:'OTRO',categoryId:'99'},presentation:{...payload.lines[0].presentation,barcode:'otro'}});
 await assert.rejects(service.create(1,key(),payload),e=>e.status===422);for(const table of ['suppliers','products','presentations','purchases','lines'])assert.equal(repo.pool.data[table].length,0);assert.equal(repo.pool.data.operations.size,0);
 const valid=body(),operation=key();repo.failLine=true;await assert.rejects(service.create(1,operation,valid));assert.equal(repo.pool.data.purchases.length,0);repo.failLine=false;await service.create(1,operation,valid);assert.equal(repo.pool.data.purchases.length,1);
});
test('Compras: reutiliza el mismo producto nuevo entre lotes y rechaza coincidencias no seleccionadas',async()=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo),payload=body();payload.lines.push({...structuredClone(payload.lines[0]),lotCode:'LOTE-2'});
 await service.create(1,key(),payload);assert.equal(repo.pool.data.products.length,1);assert.equal(repo.pool.data.presentations.length,1);assert.equal(repo.pool.data.lines.length,2);
 await assert.rejects(service.create(1,key(),body()),e=>e.status===409&&/proveedor/.test(e.message));
 const supplier=await repo.suppliers.get(1);await assert.rejects(service.create(1,key(),{...body(),supplier:{id:1,version:supplier.version}}),e=>e.status===409&&/producto/.test(e.message));
});
test('Compras: rechaza campos extra, cantidades y fechas inválidas; calcula centavos exactos',()=>{
 const payload=body();assert.throws(()=>Input.purchase({...payload,unexpected:true}));assert.throws(()=>Input.purchase({...payload,lines:[]}));assert.throws(()=>Input.purchase({...payload,lines:Array(51).fill(payload.lines[0])}));
 for(const quantity of ['-1','0','1.0001','Infinity','1e3'])assert.throws(()=>Input.purchase({...payload,lines:[{...payload.lines[0],quantity}]}));
 assert.throws(()=>Input.purchase({...payload,lines:[{...payload.lines[0],expiresOn:'2026-02-30'}]}));
 assert.equal(Decimal.multiply('0.125','0.12',2),'0.02');assert.equal(Decimal.multiply('3','453.592',3),'1360.776');assert.equal(Decimal.total([{quantity:'1',cost:'0.10'},{quantity:'1',cost:'0.20'}]),'0.30');
});
test('Compras: API conserva sesión, CSRF y permiso administrador',async()=>{
 const repo=new PurchaseMemoryRepository(),app=await server({purchaseRepository:repo});
 try{
  assert.equal((await app.request('/api/compras')).status,401);
  const form=await app.form();const login=await app.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);assert.equal(login.status,200);
  const auth=await app.form('/compras',login.cookie);
  assert.equal((await app.post('/api/compras',body(),{cookie:auth.cookie,token:''},{'x-operation-id':key()})).status,403);
  const result=await app.post('/api/compras',body(),auth,{'x-operation-id':key()});assert.equal(result.status,201,result.text);
  assert.equal((await app.request('/api/compras/1',{headers:{Cookie:auth.cookie}})).status,200);
  app.setUser({id_usuario:1,id_rol:2,nombre:'Cajero',nombre_usuario:'audit_user',estado:'ACTIVO',rol:'ENCARGADO_VENTA'});
  assert.equal((await app.request('/api/compras',{headers:{Cookie:auth.cookie}})).status,403);
 }finally{await app.close();}
});
