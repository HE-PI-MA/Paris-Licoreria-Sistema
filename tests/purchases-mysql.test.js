/** Integración MySQL desechable. Crea una base aleatoria paris_u026_test_*; nunca carga .env ni toca la base de negocio. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path'),mysql=require('mysql2/promise');
const {readSql}=require('../scripts/sql'),ProductsSetup=require('../scripts/setup-products'),SuppliersSetup=require('../scripts/setup-suppliers');
const Repository=require('../src/repositories/PurchaseRepository'),Service=require('../src/services/PurchaseService');
const {body}=require('./support/purchase-fixture');
test('U026: compra atómica, precisión y privilegios en MySQL real',{skip:process.env.PARIS_MYSQL_TEST!=='1',timeout:120000},async t=>{
 assert.ok(process.env.TEST_DB_USER);const config={host:process.env.TEST_DB_HOST||'127.0.0.1',port:Number(process.env.TEST_DB_PORT||3306),user:process.env.TEST_DB_USER,password:process.env.TEST_DB_PASSWORD,charset:'utf8mb4'};
 const suffix=crypto.randomBytes(6).toString('hex'),db='paris_u026_test_'+suffix,account='u026_'+suffix,secret=crypto.randomBytes(24).toString('hex');
 const admin=await mysql.createConnection(config);let owner,pool,repo,service;
 const key=()=>crypto.randomUUID(),ref=r=>({id:r.id,version:r.version});
 try{
  await admin.query('CREATE DATABASE '+db+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');owner=mysql.createPool({...config,database:db,connectionLimit:8});
  for(const name of ['02_creacion_tablas.sql','03_rutinas.sql','04_vistas.sql','03_datos_iniciales.sql'])for(const sql of readSql(path.join(__dirname,'fixtures/v2',name)))await owner.query(sql);
  for(const sql of readSql(path.join(__dirname,'../database/migrations/U004.sql')))await owner.query(sql);
  const setup=new ProductsSetup(owner);await owner.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)',['U004',setup.checksum('U004')]);await setup.run();await new SuppliersSetup(owner).run();
  await owner.query("INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena) VALUES(1,'Prueba','Local','u026_test','synthetic-only')");
  await admin.query('CREATE USER ?@? IDENTIFIED BY ?',[account,'localhost',secret]);
  for(const [priv,tables]of [['SELECT',['usuario','app_migration','categoria','unidad_medida','vw_compras_totales','vw_stock_producto']],['SELECT,INSERT,UPDATE,DELETE',['producto','presentacion_producto','proveedor']],['SELECT,INSERT',['compra','detalle_compra','lote_producto','lote_ubicacion','ubicacion']],['SELECT',['detalle_venta']],['SELECT,INSERT,UPDATE',['catalogo_operacion']]])for(const table of tables)await admin.query('GRANT '+priv+' ON '+db+'.'+table+' TO ?@?',[account,'localhost']);
  pool=mysql.createPool({...config,database:db,user:account,password:secret,connectionLimit:8});repo=new Repository(pool);service=new Service(repo);
  await new (require('../scripts/check-purchases'))(pool).run();
  let saved,payload=body();
  await t.test('alta nueva y reintentos simultáneos generan una sola compra con 12 unidades base',async()=>{
   const operation=key();const [a,b]=await Promise.all([service.create(1,operation,payload),service.create(1,operation,payload)]);assert.deepEqual(a,b);saved=a;assert.equal(a.total,'90.50');
   const [[count]]=await owner.query('SELECT COUNT(*) AS n FROM compra');assert.equal(count.n,1);
   const [[stock]]=await owner.query('SELECT cantidad_actual AS quantity FROM lote_ubicacion');assert.equal(stock.quantity,'12.000');
   const list=await service.list({});assert.equal(list.total,1);assert.equal(list.records[0].total,'90.50');
   const detail=await service.detail(a.id);assert.equal(detail.lines[0].baseQuantity,'12.000');assert.equal(detail.lines[0].cost,'45.25');
   assert.equal((await service.locations({})).total>0,true);
   await assert.rejects(pool.query('UPDATE compra SET observacion=NULL'),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
   await assert.rejects(pool.query('DELETE FROM lote_ubicacion'),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
  });
  const [[ids]]=await owner.query('SELECT c.id_proveedor AS supplier,p.id_producto AS product,pr.id_presentacion AS presentation FROM compra c JOIN detalle_compra d ON d.id_compra=c.id_compra JOIN presentacion_producto pr ON pr.id_presentacion=d.id_presentacion JOIN producto p ON p.id_producto=pr.id_producto WHERE c.id_compra=?',[saved.id]);
  const existing=async()=>({...body(),supplier:ref(await repo.suppliers.get(ids.supplier)),lines:[{...body().lines[0],product:ref(await repo.products.getProduct(ids.product)),presentation:ref(await repo.products.getPresentation(ids.product,ids.presentation))}]});
  await t.test('registros existentes, stock fraccionario exacto y teléfono conservado',async()=>{
   const data=await existing();data.lines[0].quantity='0.125';data.lines[0].cost='0.12';const result=await service.create(1,key(),data);assert.equal(result.total,'0.02');
   assert.equal((await service.detail(result.id)).lines[0].baseQuantity,'0.750');assert.equal((await repo.suppliers.get(ids.supplier)).phone,'70000000');
  });
  await t.test('fila tardía inválida revierte compra, proveedor, producto, presentación y operación',async()=>{
   const before=async()=>{const values={};for(const table of ['proveedor','producto','presentacion_producto','compra','detalle_compra','lote_producto','lote_ubicacion','ubicacion','catalogo_operacion']){const [[row]]=await owner.query('SELECT COUNT(*) AS n FROM '+table);values[table]=row.n;}return values;};
   const state=await before(),data=body();delete data.locationId;data.locationName='LUGAR QUE NO DEBE QUEDAR';data.supplier.name='NUEVO QUE NO DEBE QUEDAR';data.lines[0].product.name='PRODUCTO QUE NO DEBE QUEDAR';data.lines[0].presentation.barcode='NUEVO-ROLLBACK';
   data.lines.push({...structuredClone(data.lines[0]),product:{...data.lines[0].product,clientKey:key(),name:'INVALIDO',categoryId:'9999'}});
   await assert.rejects(service.create(1,key(),data),e=>e.status===422);assert.deepEqual(await before(),state);
  });
  await t.test('versiones, activos, relación producto-presentación y nombres ya existentes',async()=>{
   const data=await existing();await owner.query('UPDATE presentacion_producto SET precio_venta=61 WHERE id_presentacion=?',[ids.presentation]);await assert.rejects(service.create(1,key(),data),e=>e.status===409);
   const inactive=await existing();await owner.query("UPDATE ubicacion SET estado='INACTIVO' WHERE id_ubicacion=1");await assert.rejects(service.create(1,key(),inactive),e=>e.status===422);await owner.query("UPDATE ubicacion SET estado='ACTIVO' WHERE id_ubicacion=1");
   await assert.rejects(service.create(1,key(),body()),e=>e.status===409);
   const wrong=await existing();wrong.lines[0].presentation.id=99999;await assert.rejects(service.create(1,key(),wrong),e=>e.status===409);
  });
  await t.test('ubicación nueva con permisos mínimos, reintento, coincidencia exacta y bloqueo de inactiva',async()=>{
   const data=await existing();delete data.locationId;data.locationName='heladera';const operation=key();
   const [a,b]=await Promise.all([service.create(1,operation,data),service.create(1,operation,data)]);assert.deepEqual(a,b);
   assert.equal((await service.detail(a.id)).lines[0].location,'HELADERA');
   const options=await service.locations({term:'hela'});assert.equal(options.total,1);assert.equal(options.options[0].label,'HELADERA');
   await service.create(1,key(),data);
   const [[count]]=await owner.query("SELECT COUNT(*) AS n FROM ubicacion WHERE nombre='HELADERA'");assert.equal(count.n,1);
   await assert.rejects(pool.query("UPDATE ubicacion SET estado='INACTIVO' WHERE nombre='HELADERA'"),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
   await assert.rejects(pool.query("DELETE FROM ubicacion WHERE nombre='HELADERA'"),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
   await owner.query("UPDATE ubicacion SET estado='INACTIVO' WHERE nombre='HELADERA'");await assert.rejects(service.create(1,key(),data),e=>e.status===422);
   assert.equal((await service.locations({term:'hela'})).total,0);
  });
  await t.test('ubicaciones concurrentes comparten el lugar después de un reintento sin duplicar compras',async()=>{
   const data=await existing();delete data.locationId;data.locationName='CAJA DOS';const operations=[key(),key()];
   const results=await Promise.allSettled(operations.map(operation=>service.create(1,operation,data)));
   assert.ok(results.some(result=>result.status==='fulfilled'));
   for(const [index,result]of results.entries())if(result.status==='rejected'){assert.equal(result.reason.status,409);await service.create(1,operations[index],data);}
   const [[count]]=await owner.query("SELECT COUNT(*) AS n FROM ubicacion WHERE nombre='CAJA DOS'");assert.equal(count.n,1);
   const [[lines]]=await owner.query("SELECT COUNT(*) AS n FROM lote_ubicacion lu JOIN ubicacion u USING(id_ubicacion) WHERE u.nombre='CAJA DOS'");assert.equal(lines.n,2);
  });
  await t.test('dos altas nuevas concurrentes del mismo nombre no crean duplicados',async()=>{
   const data=body();data.supplier.name='PROVEEDOR CONCURRENTE';data.lines[0].product.name='PRODUCTO CONCURRENTE';data.lines[0].presentation.barcode='CONCURRENT-TEST';
   const results=await Promise.allSettled([service.create(1,key(),data),service.create(1,key(),data)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   const [[count]]=await owner.query("SELECT COUNT(*) AS n FROM proveedor WHERE nombre='PROVEEDOR CONCURRENTE'");assert.equal(count.n,1);
  });
 }finally{if(pool)await pool.end();if(owner)await owner.end();assert.match(db,/^paris_u026_test_[a-f0-9]{12}$/);await admin.query('DROP DATABASE IF EXISTS '+db);await admin.query('DROP USER IF EXISTS ?@?',[account,'localhost']);await admin.end();}
});
