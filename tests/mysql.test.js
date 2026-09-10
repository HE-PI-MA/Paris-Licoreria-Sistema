const { test } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
const { readSql } = require('../scripts/sql');
// Never loads the application's .env or modifies its database.
test('U004 on disposable MySQL 8: preservation, stock, historical locks and concurrency', {skip:process.env.PARIS_MYSQL_TEST!=='1'}, async()=>{
  assert.ok(process.env.TEST_DB_USER,'Set TEST_DB_USER for a separate test server/account.');
  const config={host:process.env.TEST_DB_HOST||'127.0.0.1',port:Number(process.env.TEST_DB_PORT||3306),user:process.env.TEST_DB_USER,password:process.env.TEST_DB_PASSWORD,charset:'utf8mb4'};
  const admin=await mysql.createConnection(config);
  const db='paris_u004_test_'+crypto.randomBytes(6).toString('hex');
  let c,pool;
  try{
    const [[version]]=await admin.query('SELECT VERSION() AS version');assert.match(version.version,/^8\./);
    await admin.query('CREATE DATABASE '+db+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    c=await mysql.createConnection({...config,database:db});
    for(const file of ['02_creacion_tablas.sql','03_rutinas.sql','04_vistas.sql','03_datos_iniciales.sql']){
      for(const sql of readSql(path.join(__dirname,'fixtures/v2',file)))await c.query(sql);
    }
    const [[before]]=await c.query('SELECT COUNT(*) AS total FROM denominacion');
    const migration=readSql(path.join(__dirname,'../database/migrations/U004.sql'));
    for(const sql of migration)await c.query(sql);
    for(const sql of migration)await c.query(sql); // interrupted-DDL retry/idempotence
    const [[after]]=await c.query('SELECT COUNT(*) AS total FROM denominacion');assert.equal(after.total,before.total);
    await c.query("INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena) VALUES(1,'Test','Local','test_user','synthetic-not-for-login')");
    await c.query("INSERT INTO proveedor(nombre) VALUES('Test')");
    await c.query("INSERT INTO producto(id_categoria,id_unidad_medida,nombre) VALUES(1,1,'Test product')");
    await c.query("INSERT INTO presentacion_producto(id_producto,nombre_presentacion,factor_conversion,precio_venta) VALUES(1,'Unidad',1,10)");
    await c.query('CALL sp_registrar_compra(1,1,CURRENT_TIMESTAMP,NULL,?,@compra)',[JSON.stringify([{id_presentacion:1,cantidad:10,costo_unitario:5,id_ubicacion:1}])]);
    await c.query("INSERT INTO sesion_caja(id_usuario,fecha_hora_apertura,monto_inicial) VALUES(1,DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR),100)");
    const details=JSON.stringify([{id_presentacion:1,cantidad:2}]),payments=JSON.stringify([{metodo_pago:'EFECTIVO',monto:20}]);
    await c.query('CALL sp_registrar_venta(1,?,?,@venta)',[details,payments]);
    const [[sale]]=await c.query('SELECT @venta AS id');
    const [[denom]]=await c.query('SELECT id_denominacion AS id FROM denominacion WHERE valor=20');
    const [[hundred]]=await c.query('SELECT id_denominacion AS id FROM denominacion WHERE valor=100');
    const count=JSON.stringify([{id_denominacion:hundred.id,cantidad:1},{id_denominacion:denom.id,cantidad:1}]);
    await assert.rejects(c.query('CALL sp_cerrar_sesion_caja(1,DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 30 MINUTE),NULL,?,@arqueo)',[count]));
    await c.query('CALL sp_cerrar_sesion_caja(1,CURRENT_TIMESTAMP,NULL,?,@arqueo)',[count]);
    const [[original]]=await c.query('SELECT diferencia FROM vw_diferencias_caja WHERE id_sesion_caja=1');assert.equal(Number(original.diferencia),0);
    await assert.rejects(c.query('CALL sp_anular_venta(?,?)',[sale.id,'After close']));
    await assert.rejects(c.query('UPDATE detalle_venta SET precio_unitario=999 WHERE id_venta=?',[sale.id]));
    await assert.rejects(c.query('UPDATE detalle_arqueo SET cantidad=99 WHERE id_arqueo=@arqueo'));
    await assert.rejects(c.query('UPDATE denominacion SET valor=21 WHERE id_denominacion=?',[denom.id]));
    const [[unchanged]]=await c.query('SELECT diferencia FROM vw_diferencias_caja WHERE id_sesion_caja=1');assert.equal(Number(unchanged.diferencia),0);
    await c.query("UPDATE ubicacion SET estado='INACTIVO' WHERE id_ubicacion=1");
    const [[stock]]=await c.query('SELECT stock_disponible,stock_fisico FROM vw_stock_producto WHERE id_producto=1');
    assert.equal(Number(stock.stock_disponible),0);assert.equal(Number(stock.stock_fisico),8);
    await assert.rejects(c.query("INSERT INTO sesion_caja(id_usuario,fecha_hora_apertura) VALUES(1,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 HOUR))"));
    await c.query("UPDATE ubicacion SET estado='ACTIVO' WHERE id_ubicacion=1");
    const [s1]=await c.query('INSERT INTO sesion_caja(id_usuario) VALUES(1)');
    const [s2]=await c.query('INSERT INTO sesion_caja(id_usuario) VALUES(1)');
    pool=mysql.createPool({...config,database:db,connectionLimit:2});
    const sell=session=>pool.query('CALL sp_registrar_venta(?,?,?,@newSale)',[session,JSON.stringify([{id_presentacion:1,cantidad:6}]),JSON.stringify([{metodo_pago:'EFECTIVO',monto:60}])]);
    const concurrent=await Promise.allSettled([sell(s1.insertId),sell(s2.insertId)]);
    assert.equal(concurrent.filter(v=>v.status==='fulfilled').length,1);
    const [[remaining]]=await c.query('SELECT stock_disponible FROM vw_stock_producto WHERE id_producto=1');assert.equal(Number(remaining.stock_disponible),2);
  }finally{
    if(pool)await pool.end();if(c)await c.end();
    assert.match(db,/^paris_u004_test_[a-f0-9]{12}$/);
    await admin.query('DROP DATABASE IF EXISTS '+db);await admin.end();
  }
});
