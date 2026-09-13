/** Comprueba en solo lectura las dependencias, campos y motores necesarios para guardar Compras de forma atómica. */
const SuppliersSetup=require('./setup-suppliers');
class PurchasesCheck {
 constructor(pool){this.pool=pool;}
 async run(){
  await new SuppliersSetup(this.pool).run({check:true});
  const tables=['proveedor','producto','presentacion_producto','compra','detalle_compra','lote_producto','lote_ubicacion','catalogo_operacion'];
  const [engines]=await this.pool.query('SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)',[tables]);
  if(tables.some(name=>!engines.some(row=>row.name===name && row.engine==='InnoDB')))throw new Error('Las tablas de Compras deben existir y utilizar InnoDB.');
  for(const query of [
   'SELECT id_compra,id_proveedor,id_usuario,fecha_hora,observacion FROM compra LIMIT 0',
   'SELECT id_detalle_compra,id_compra,id_presentacion,cantidad,costo_unitario FROM detalle_compra LIMIT 0',
   'SELECT id_lote,id_detalle_compra,codigo_lote,fecha_vencimiento,cantidad_inicial FROM lote_producto LIMIT 0',
   'SELECT id_lote_ubicacion,id_lote,id_ubicacion,cantidad_actual FROM lote_ubicacion LIMIT 0',
   'SELECT id_ubicacion,nombre,estado FROM ubicacion LIMIT 0',
   'SELECT id_compra,fecha_hora,proveedor,usuario,total_compra FROM vw_compras_totales LIMIT 0'
  ])await this.pool.query(query);
  return {checked:true};
 }
}
if(require.main===module){
 require('dotenv').config({path:require('node:path').join(__dirname,'..','.env'),quiet:true});
 const db=require('../src/config/database');
 new PurchasesCheck(db.getPool()).run().then(()=>console.log('COMPRAS U025: estructura y consultas verificadas. La cuenta también necesita los permisos INSERT documentados en database/permisos_minimos.sql. No se modificaron registros.'))
  .catch(error=>{require('../src/utils/safeLog')('PURCHASES_CHECK_FAILED',error);console.error('No se pudo comprobar Compras. Revisa las dependencias U012/U023 y los permisos indicados en docs/37_COMPRAS_U025.md.');process.exitCode=1;})
  .finally(()=>db.getPool().end());
}
module.exports=PurchasesCheck;
