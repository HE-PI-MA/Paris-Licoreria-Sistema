/** U012 contra MySQL 8 desechable. Nunca carga .env: crea y elimina solo una base aleatoria paris_u012_test_*. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {readSql}=require('../scripts/sql');
const ProductsSetup=require('../scripts/setup-products');
const Repository=require('../src/repositories/ProductRepository');
const Service=require('../src/services/ProductService');
test('U012: MySQL real, permisos mínimos, reintentos concurrentes e historial', {skip:process.env.PARIS_MYSQL_TEST!=='1',timeout:120000},async t=>{
 assert.ok(process.env.TEST_DB_USER);
 const config={host:process.env.TEST_DB_HOST||'127.0.0.1',port:Number(process.env.TEST_DB_PORT||3306),user:process.env.TEST_DB_USER,password:process.env.TEST_DB_PASSWORD,charset:'utf8mb4'};
 const admin=await mysql.createConnection(config),suffix=crypto.randomBytes(6).toString('hex'),db='paris_u012_test_'+suffix,account='u012_'+suffix,secret=crypto.randomBytes(24).toString('hex');
 let owner,pool;
 const body={name:'Vino ficticio',categoryId:'1',unitId:'1',minimum:'2.5',description:'Ensayo',state:'ACTIVO'},key=()=>crypto.randomUUID();
 let repo,service,product,presentation;
 try{
  await admin.query('CREATE DATABASE '+db+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  owner=mysql.createPool({...config,database:db,connectionLimit:4});
  for(const name of ['02_creacion_tablas.sql','03_rutinas.sql','04_vistas.sql','03_datos_iniciales.sql'])for(const sql of readSql(path.join(__dirname,'fixtures/v2',name)))await owner.query(sql);
  for(const sql of readSql(path.join(__dirname,'../database/migrations/U004.sql')))await owner.query(sql);
  const setup=new ProductsSetup(owner);await owner.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)',['U004',setup.checksum('U004')]);
  await owner.query("INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena) VALUES(1,'Prueba','Local','u012_test','synthetic-only')");
  await t.test('instalación idempotente y rechazo de tabla incompatible',async()=>{
   await setup.run();await setup.run();await setup.run({check:true});
   await owner.query('ALTER TABLE catalogo_operacion ADD COLUMN inesperada INT');
   await assert.rejects(setup.run(),/otra estructura/);
   await owner.query('ALTER TABLE catalogo_operacion DROP COLUMN inesperada');
  });
  await admin.query('CREATE USER ?@? IDENTIFIED BY ?',[account,'localhost',secret]);
  for(const [priv,tables]of [ ['SELECT',['usuario','app_migration','categoria','unidad_medida','detalle_compra','detalle_venta','vw_stock_producto']],['SELECT,INSERT,UPDATE,DELETE',['producto','presentacion_producto']],['SELECT,INSERT,UPDATE',['catalogo_operacion']]])for(const table of tables)await admin.query('GRANT '+priv+' ON '+db+'.'+table+' TO ?@?',[account,'localhost']);
  pool=mysql.createPool({...config,user:account,password:secret,database:db,connectionLimit:4});repo=new Repository(pool);service=new Service(repo);
  await t.test('cuenta limitada consulta e instala ya aplicado sin conceder DDL',async()=>{
   await new ProductsSetup(pool).run({check:true});assert.equal((await service.list({})).total,0);
   assert.ok((await service.options('categories',{})).total>0);assert.ok((await service.options('units',{})).total>0);
   await assert.rejects(pool.query('DELETE FROM '+db+'.detalle_compra'),e=>e.code==='ER_TABLEACCESS_DENIED_ERROR');
  });
  await t.test('dos envíos simultáneos y reintento crean un solo producto',async()=>{
   const operation=key();const [a,b]=await Promise.all([service.create(1,operation,body),service.create(1,operation,body)]);assert.deepEqual(a,b);
   assert.deepEqual(await service.create(1,operation,body),a);assert.equal((await service.list({})).total,1);product=await service.detail(a.id);
   await assert.rejects(service.create(1,operation,{...body,name:'Otra cosa'}),e=>e.status===409);
   assert.equal(product.minimum,'2.500');
  });
  await t.test('edición, versión vencida, referencias y filtros remotos',async()=>{
   const saved=await service.update(1,key(),product.id,{...body,name:'Vino 100%_seguro',version:product.version});
   await assert.rejects(service.update(1,key(),product.id,{...body,version:product.version}),e=>e.status===409);
   product=await service.detail(saved.id);
   assert.equal((await service.list({term:'%_'})).total,1);assert.equal((await service.list({term:"' OR 1=1 --"})).total,0);
   assert.equal((await service.list({state:'INACTIVO'})).total,0);assert.equal((await service.list({lowStock:'SI'})).total,1);
   await assert.rejects(service.create(1,key(),{...body,categoryId:'999999'}),e=>e.status===422);
   await assert.rejects(service.create(1,key(),{...body,unitId:'999999'}),e=>e.status===422);
  });
  await t.test('presentaciones, barras únicas, alcance del padre y equivalencia',async()=>{
   const data={name:'Botella',factor:'1',barcode:'BARRA-TEST',price:'12.50',state:'ACTIVO'};
   const created=await service.savePresentation(1,key(),product.id,null,data);presentation=await service.presentation(product.id,created.id);
   assert.equal(presentation.price,'12.50');assert.equal(presentation.used,false);
   await assert.rejects(service.savePresentation(1,key(),product.id,null,{...data,name:'Duplicada'}),e=>e.status===409);
   const other=await service.create(1,key(),body);await assert.rejects(service.presentation(other.id,presentation.id),e=>e.status===404);
   await service.remove(1,key(),other.id,{version:(await service.detail(other.id)).version});
   assert.equal((await service.list({term:'BARRA-TEST'})).total,1);
   await assert.rejects(service.update(1,key(),product.id,{...body,unitId:'2',version:product.version}),e=>e.status===409);
   await service.savePresentation(1,key(),product.id,presentation.id,{...data,factor:'2',version:presentation.version});
   presentation=await service.presentation(product.id,presentation.id);assert.equal(presentation.factor,'2.000');
  });
  await t.test('desactivación y reactivación conservan registros',async()=>{
   await service.state(1,key(),product.id,{state:'INACTIVO',version:product.version});product=await service.detail(product.id);
   await assert.rejects(service.savePresentation(1,key(),product.id,null,{name:'Caja',factor:'12',barcode:'',price:'99',state:'ACTIVO'}),e=>e.status===409);
   await service.state(1,key(),product.id,{state:'ACTIVO',version:product.version});product=await service.detail(product.id);
   await service.presentationState(1,key(),product.id,presentation.id,{state:'INACTIVO',version:presentation.version});presentation=await service.presentation(product.id,presentation.id);
   await service.presentationState(1,key(),product.id,presentation.id,{state:'ACTIVO',version:presentation.version});presentation=await service.presentation(product.id,presentation.id);
  });
  await t.test('historial de compra impide borrar y cambiar factor, incluso con stock cero',async()=>{
   await owner.query("INSERT INTO proveedor(nombre) VALUES('Proveedor ficticio U012')");
   const connection=await owner.getConnection();
   try{await connection.query('CALL sp_registrar_compra(1,1,CURRENT_TIMESTAMP,NULL,?,@compra)',[JSON.stringify([{id_presentacion:presentation.id,cantidad:2,costo_unitario:5,id_ubicacion:1}])]);}finally{connection.release();}
   presentation=await service.presentation(product.id,presentation.id);assert.equal(presentation.used,true);
   await owner.query("UPDATE ubicacion SET estado='INACTIVO' WHERE id_ubicacion=1");assert.equal(Number((await service.detail(product.id)).stock),0);
   await assert.rejects(service.remove(1,key(),product.id,{version:product.version}),e=>e.status===409&&/historial/.test(e.message));
   await assert.rejects(service.removePresentation(1,key(),product.id,presentation.id,{version:presentation.version}),e=>e.status===409);
   await assert.rejects(service.savePresentation(1,key(),product.id,presentation.id,{name:presentation.name,factor:'3',barcode:presentation.barcode,price:'12.50',state:'ACTIVO',version:presentation.version}),e=>Boolean(e.fieldErrors.factor));
   assert.equal((await service.presentations(product.id,{})).total,1);
  });
  await t.test('presentación con ventas pero sin compras directas conserva su historial',async()=>{
   await owner.query("UPDATE ubicacion SET estado='ACTIVO' WHERE id_ubicacion=1");
   const created=await service.savePresentation(1,key(),product.id,null,{name:'Venta por unidad',factor:'1',barcode:'',price:'10',state:'ACTIVO'});
   const [cash]=await owner.query("INSERT INTO sesion_caja(id_usuario,fecha_hora_apertura) VALUES(1,DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 HOUR))");
   await owner.query('CALL sp_registrar_venta(?,?,?,@venta)',[cash.insertId,JSON.stringify([{id_presentacion:created.id,cantidad:1}]),JSON.stringify([{metodo_pago:'EFECTIVO',monto:10}])]);
   const sold=await service.presentation(product.id,created.id);assert.equal(sold.used,true);
   await assert.rejects(service.removePresentation(1,key(),product.id,created.id,{version:sold.version}),e=>e.status===409);
  });
  await t.test('borrado sin historial elimina únicamente el producto elegido y sus presentaciones',async()=>{
   const p=await service.create(1,key(),body);const child=await service.savePresentation(1,key(),p.id,null,{name:'Unidad',factor:'1',barcode:'',price:'0',state:'ACTIVO'});
   const operation=key(),payload={version:(await service.detail(p.id)).version};await service.remove(1,operation,p.id,payload);await service.remove(1,operation,p.id,payload);
   await assert.rejects(service.detail(p.id),e=>e.status===404);assert.equal(await repo.getPresentation(p.id,child.id),undefined);
   assert.equal((await service.list({})).total,1);
  });
 }finally{
  if(pool)await pool.end();if(owner)await owner.end();
  assert.match(db,/^paris_u012_test_[a-f0-9]{12}$/);assert.match(account,/^u012_[a-f0-9]{12}$/);
  await admin.query('DROP DATABASE IF EXISTS '+db);await admin.query('DROP USER IF EXISTS ?@?',[account,'localhost']);await admin.end();
 }
});
