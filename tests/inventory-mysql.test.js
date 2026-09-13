/** Comprueba existencias, historial, concurrencia y migración en MySQL real con datos ficticios y privilegios mínimos. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {database}=require('./support/inventory-mysql-fixture'),{body}=require('./support/purchase-fixture');
const Repo=require('../src/repositories/InventoryRepository'),Service=require('../src/services/InventoryService'),PurchaseRepo=require('../src/repositories/PurchaseRepository'),PurchaseService=require('../src/services/PurchaseService'),Setup=require('../scripts/setup-inventory');
const key=()=>crypto.randomUUID();
test('Inventario U030 en MySQL',{skip:process.env.PARIS_MYSQL_TEST!=='1',timeout:120000},async t=>{
 const db=await database(),repo=new Repo(db.pool),service=new Service(repo),purchases=new PurchaseService(new PurchaseRepo(db.pool));let productId,stockId;
 const stock=()=>service.stock(stockId),data=async(quantity,extra={})=>({stockId,version:(await stock()).version,quantity,reason:'PRUEBA DE INVENTARIO',...extra});
 try{
  await t.test('preparación repetible, compra real e historial de ingreso sin modificar la compra',async()=>{
   await new Setup(db.owner).run();await new Setup(db.pool).run({check:true});
   const purchase=await purchases.create(1,key(),body());const list=await service.list({});productId=list.records[0].id;
   stockId=(await service.lots(productId,{})).records[0].id;assert.equal((await stock()).physicalStock,'12.000');
   const history=await service.history({productId});assert.equal(history.total,1);assert.equal(history.records[0].type,'COMPRA');assert.equal(history.records[0].destinationId,1);
   assert.equal((await purchases.detail(purchase.id)).total,'90.50');
  });
  await t.test('traslado atómico a ubicación nueva y reintentos con la misma clave conservan el total',async()=>{
   const payload=await data('4',{destinationName:' heladera '}),operation=key();const [a,b]=await Promise.all([service.transfer(1,operation,payload),service.transfer(1,operation,payload)]);assert.deepEqual(a,b);
   assert.equal((await stock()).physicalStock,'8.000');assert.equal((await service.detail(productId)).physicalStock,'12.000');
   const lots=await service.lots(productId,{});assert.equal(lots.total,2);assert.equal(lots.records.find(r=>r.location==='HELADERA').physicalStock,'4.000');
   const history=await service.history({type:'TRASLADO'});assert.equal(history.total,1);assert.equal(history.records[0].beforeQuantity,'12.000');assert.equal(history.records[0].afterQuantity,'8.000');
   await assert.rejects(service.transfer(1,operation,{...payload,quantity:'3'}),e=>e.status===409);
  });
  await t.test('conteos hacia arriba y abajo mantienen originales y modifican solo la diferencia',async()=>{
   await service.count(1,key(),await data('10'));assert.equal((await service.detail(productId)).physicalStock,'14.000');
   await service.count(1,key(),await data('7'));assert.equal((await service.detail(productId)).physicalStock,'11.000');
   const [[row]]=await db.owner.query('SELECT cantidad_inicial FROM lote_producto WHERE id_lote=?',[(await stock()).lotId]);assert.equal(row.cantidad_inicial,'12.000');
   const counts=await service.history({type:'CONTEO'});assert.equal(counts.total,2);assert.ok(counts.records.some(r=>r.quantity==='2.000'));assert.ok(counts.records.some(r=>r.quantity==='-3.000'));
   await assert.rejects(service.count(1,key(),await data('7')),e=>e.status===422);
  });
  await t.test('retiro descuenta una sola vez y exige motivo, cantidad suficiente y vencimiento real',async()=>{
   const p=await data('1',{type:'DAÑADO'}),operation=key();await service.remove(1,operation,p);await service.remove(1,operation,p);assert.equal((await stock()).physicalStock,'6.000');
   assert.equal((await service.history({type:'RETIRO'})).total,1);
   await assert.rejects(service.remove(1,key(),await data('1',{type:'VENCIDO'})),e=>e.status===422);
   await assert.rejects(service.remove(1,key(),await data('20',{type:'OTRO'})),e=>e.status===422);
   await assert.rejects(service.remove(1,key(),await data('1',{type:'OTRO',reason:''})),e=>e.status===422);
  });
  await t.test('versiones desactualizadas y traslados simultáneos no consumen dos veces la existencia',async()=>{
   const payload=await data('2',{destinationName:'HELADERA'});const results=await Promise.allSettled([service.transfer(1,key(),payload),service.transfer(1,key(),payload)]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
   assert.equal((await stock()).physicalStock,'4.000');assert.equal((await service.detail(productId)).physicalStock,'10.000');
  });
  await t.test('un error tardío revierte cantidades, destino nuevo y operación; origen igual o inactivo se valida',async()=>{
   const payload=await data('1',{destinationName:'LUGAR TEMPORAL'}),operation=key(),insert=repo.movements.insert;
   repo.movements.insert=async()=>{throw new Error('FAIL AFTER STOCK');};await assert.rejects(service.transfer(1,operation,payload));repo.movements.insert=insert;
   assert.equal((await stock()).physicalStock,'4.000');assert.equal((await service.locations({term:'LUGAR TEMPORAL'})).total,0);
   await service.transfer(1,operation,payload);assert.equal((await stock()).physicalStock,'3.000');
   await assert.rejects(service.transfer(1,key(),await data('1',{destinationId:1})),e=>e.status===422);
   await db.owner.query("UPDATE ubicacion SET estado='INACTIVO' WHERE nombre='LUGAR TEMPORAL'");
   await assert.rejects(service.transfer(1,key(),await data('1',{destinationName:'LUGAR TEMPORAL'})),e=>e.status===422);
  });
  await t.test('fracciones exactas, avisos de vencimiento, agotados y filtros',async()=>{
   const make=async(name,days)=>{const b=body();b.supplier={id:1,version:(await purchases.repository.suppliers.get(1)).version};b.lines[0].product.name=name;b.lines[0].presentation.barcode=name;
    const [[d]]=await db.owner.query("SELECT DATE_FORMAT(DATE_ADD(CURRENT_DATE,INTERVAL ? DAY),'%Y-%m-%d') AS date",[days]);b.lines[0].expiresOn=d.date;return purchases.create(1,key(),b);};
   await make('PRODUCTO VENCIDO',0);await make('PRODUCTO POR VENCER',10);
   const expired=await service.list({alert:'VENCIDO'});assert.equal(expired.total,1);assert.equal(expired.records[0].stock,'0.000');
   assert.equal((await service.list({alert:'PROXIMO'})).total,1);assert.ok((await service.list({alert:'AGOTADO'})).records.some(r=>r.id===expired.records[0].id));
   const lot=(await service.lots(expired.records[0].id,{})).records[0];await service.remove(1,key(),{stockId:lot.id,version:lot.version,quantity:'12',type:'VENCIDO',reason:'RETIRO POR VENCIMIENTO'});assert.equal((await service.list({alert:'VENCIDO'})).total,0);
   await service.count(1,key(),await data('3.125'));await service.remove(1,key(),await data('0.025',{type:'OTRO'}));assert.equal((await stock()).physicalStock,'3.100');
  });
  await t.test('historial previo sin ubicación inventada y registros inmutables',async()=>{
   // Una importación antigua puede tener compras sin bitácora U030.
   const [[existing]]=await db.owner.query('SELECT id_presentacion FROM detalle_compra LIMIT 1');
   const [c]=await db.owner.query("INSERT INTO compra(id_proveedor,id_usuario) VALUES(1,1)");const [d]=await db.owner.query('INSERT INTO detalle_compra(id_compra,id_presentacion,cantidad,costo_unitario) VALUES(?,?,1,5)',[c.insertId,existing.id_presentacion]);
   const [l]=await db.owner.query('INSERT INTO lote_producto(id_detalle_compra,cantidad_inicial) VALUES(?,6)',[d.insertId]);await db.owner.query('INSERT INTO lote_ubicacion(id_lote,id_ubicacion,cantidad_actual) VALUES(?,1,6)',[l.insertId]);
   const historical=(await service.history({type:'COMPRA'})).records.find(r=>r.lotId===l.insertId);assert.equal(historical.destination,null);assert.match(historical.reason,/NO REGISTRADA/);
   await assert.rejects(db.owner.query("UPDATE inventario_movimiento SET motivo='CAMBIAR' LIMIT 1"),e=>e.code==='ER_SIGNAL_EXCEPTION');
   await assert.rejects(db.owner.query('DELETE FROM inventario_movimiento LIMIT 1'),e=>e.code==='ER_SIGNAL_EXCEPTION');
   await assert.rejects(db.pool.query('DELETE FROM lote_ubicacion LIMIT 1'),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
  });
  await t.test('instalación interrumpida se reanuda y una protección desconocida no se sobrescribe',async()=>{
   const {readSql}=require('../scripts/sql'),path=require('node:path');
   const sql=readSql(path.join(__dirname,'../database/migrations/U030.sql')).find(s=>/^CREATE TRIGGER trg_lote_ubicacion_bu_cantidad/i.test(s));
   const before=(await stock()).physicalStock;
   await db.owner.query("DELETE FROM app_migration WHERE id='U030'");
   await db.owner.query('DROP TRIGGER trg_lote_ubicacion_bu_cantidad');
   await new Setup(db.owner).run();assert.equal((await stock()).physicalStock,before);
   await db.owner.query('DROP TRIGGER trg_lote_ubicacion_bu_cantidad');
   await db.owner.query('CREATE TRIGGER trg_lote_ubicacion_bu_cantidad BEFORE UPDATE ON lote_ubicacion FOR EACH ROW SET NEW.cantidad_actual=NEW.cantidad_actual');
   await assert.rejects(new Setup(db.owner).run(),/fue modificado/);
   const [[trigger]]=await db.owner.query("SELECT ACTION_STATEMENT AS body FROM information_schema.triggers WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='trg_lote_ubicacion_bu_cantidad'");
   assert.match(trigger.body,/SET NEW.cantidad_actual=NEW.cantidad_actual/i);
   await db.owner.query('DROP TRIGGER trg_lote_ubicacion_bu_cantidad');await db.owner.query(sql);
   await new Setup(db.owner).run();assert.equal((await stock()).physicalStock,before);
  });
 }finally{await db.close();}
});
