/** MySQL desechable con la cuenta mínima de Inventario. Solo usa TEST_DB_* y elimina exclusivamente la base aleatoria creada aquí. */
const mysql=require('mysql2/promise'),crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict'),{readSql}=require('../../scripts/sql');
async function database(){
 assert.ok(process.env.TEST_DB_USER);const config={host:process.env.TEST_DB_HOST||'127.0.0.1',port:Number(process.env.TEST_DB_PORT||3306),user:process.env.TEST_DB_USER,password:process.env.TEST_DB_PASSWORD,charset:'utf8mb4'};
 const suffix=crypto.randomBytes(6).toString('hex'),name='paris_u030_test_'+suffix,account='u030_'+suffix,secret=crypto.randomBytes(24).toString('hex');const admin=await mysql.createConnection(config);let owner,pool;
 const close=async()=>{if(pool)await pool.end();if(owner)await owner.end();assert.match(name,/^paris_u030_test_[a-f0-9]{12}$/);await admin.query('DROP DATABASE IF EXISTS '+name);await admin.query('DROP USER IF EXISTS ?@?',[account,'localhost']);await admin.end();};
 try{
  await admin.query('CREATE DATABASE '+name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');owner=mysql.createPool({...config,database:name,connectionLimit:8});
  for(const file of ['02_creacion_tablas.sql','03_rutinas.sql','04_vistas.sql','03_datos_iniciales.sql'])for(const sql of readSql(path.join(__dirname,'../fixtures/v2',file)))await owner.query(sql);
  for(const sql of readSql(path.join(__dirname,'../../database/migrations/U004.sql')))await owner.query(sql);
  const setup=new (require('../../scripts/setup-products'))(owner);await owner.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)',['U004',setup.checksum('U004')]);await setup.run();await new (require('../../scripts/setup-suppliers'))(owner).run();
  await owner.query("INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena) VALUES(1,'Prueba','Inventario','u030_test','synthetic-only')");
  await new (require('../../scripts/setup-inventory'))(owner).run();
  await new (require('../../scripts/setup-media'))(owner).run();
  await admin.query('CREATE USER ?@? IDENTIFIED BY ?',[account,'localhost',secret]);
  const permissions=[['SELECT',['usuario','app_migration','unidad_medida','vw_compras_totales','vw_stock_producto','vw_stock_lote_ubicacion','detalle_venta','detalle_venta_lote','venta','sesion_caja']],
   ['SELECT,INSERT,UPDATE,DELETE',['producto_imagen','producto','presentacion_producto','proveedor']],['SELECT,INSERT',['categoria','compra','detalle_compra','lote_producto','ubicacion','ajuste_inventario','inventario_movimiento']],['SELECT,INSERT,UPDATE',['lote_ubicacion','catalogo_operacion']]];
  for(const [priv,tables]of permissions)for(const table of tables)await admin.query('GRANT '+priv+' ON '+name+'.'+table+' TO ?@?',[account,'localhost']);
  pool=mysql.createPool({...config,database:name,user:account,password:secret,connectionLimit:8});return {owner,pool,close};
 }catch(error){await close();throw error;}
}
module.exports={database};
