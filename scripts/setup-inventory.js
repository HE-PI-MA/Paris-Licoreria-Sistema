/** Preparación U030 explícita y reanudable: agrega historial y adapta únicamente los dos límites conocidos de distribución. Nunca se ejecuta al iniciar Express. */
const path=require('node:path'),crypto=require('node:crypto'),ProductsSetup=require('./setup-products'),PurchasesCheck=require('./check-purchases'),{readSql}=require('./sql');
class InventorySetup extends ProductsSetup {
 normalize(value){return value.replace(/`/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
 triggerBody(statement){return statement.split(/FOR EACH ROW/i)[1].trim();}
 async schema(c){
  const [rows]=await c.query("SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventario_movimiento' ORDER BY ORDINAL_POSITION");
  if(!rows.length)return false;
  const names=['id_movimiento','id_lote','id_origen','id_destino','id_usuario','fecha_hora','tipo','cantidad','anterior','posterior','destino_anterior','destino_posterior','motivo'];
  const types=['bigint unsigned','int unsigned','int unsigned','int unsigned','int unsigned','datetime','varchar(20)','decimal(15,3)','decimal(15,3)','decimal(15,3)','decimal(15,3)','decimal(15,3)','varchar(250)'];
  const nullable=new Set(['id_origen','id_destino','destino_anterior','destino_posterior']);
  if(JSON.stringify(rows.map(r=>[r.name,r.type,r.nullable]))!==JSON.stringify(names.map((name,i)=>[name,types[i],nullable.has(name)?'YES':'NO'])))throw new Error('inventario_movimiento tiene una estructura diferente. No se reemplaza.');
  const [[table]]=await c.query("SELECT ENGINE AS engine FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventario_movimiento'");
  const [keys]=await c.query("SELECT COLUMN_NAME AS name,REFERENCED_TABLE_NAME AS target,REFERENCED_COLUMN_NAME AS targetColumn FROM information_schema.key_column_usage WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventario_movimiento' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY COLUMN_NAME");
  const expected=[['id_destino','ubicacion','id_ubicacion'],['id_lote','lote_producto','id_lote'],['id_origen','ubicacion','id_ubicacion'],['id_usuario','usuario','id_usuario']];
  const [checks]=await c.query("SELECT CONSTRAINT_NAME AS name,ENFORCED AS enforced FROM information_schema.table_constraints WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventario_movimiento' AND CONSTRAINT_TYPE='CHECK' ORDER BY CONSTRAINT_NAME");
  const [indices]=await c.query("SELECT INDEX_NAME AS name,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS fields FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventario_movimiento' GROUP BY INDEX_NAME");
  if(table.engine!=='InnoDB'||JSON.stringify(keys.map(r=>[r.name,r.target,r.targetColumn]))!==JSON.stringify(expected)||checks.map(r=>r.name+':'+r.enforced).join(',')!=='chk_im_coherencia:YES,chk_im_motivo:YES,chk_im_saldos:YES'||!indices.some(r=>r.name==='PRIMARY'&&r.fields==='id_movimiento')||!indices.some(r=>r.name==='idx_im_lote_tipo'&&r.fields==='id_lote,tipo'))throw new Error('Inventario tiene claves, controles o motor diferentes. No se reemplaza.');
  return true;
 }
 async run({check=false}={}){
  await new PurchasesCheck(this.pool).run();
  const statements=readSql(path.join(__dirname,'../database/migrations/U030.sql')),triggers=statements.filter(s=>/^CREATE TRIGGER/i.test(s));
  const originalHashes={"trg_lote_ubicacion_bi_cantidad": "605f452f2666781827b394ee62cc28a4c2c4b3a9d957bfb4a4a745e9f7e27bbf", "trg_lote_ubicacion_bu_cantidad": "12e5a4e689982e7f84cee2f1b82189ede7e8a3343c38ecb4bb5fd7795309bc9b"};
  const c=await this.pool.getConnection();let lockName,acquired=false;
  try{
   const [[info]]=await c.query('SELECT DATABASE() AS name');lockName='paris_U030_'+crypto.createHash('sha256').update(info.name).digest('hex').slice(0,32);
   const [[lock]]=await c.query('SELECT GET_LOCK(?,0) AS acquired',[lockName]);acquired=Number(lock.acquired)===1;if(!acquired)throw new Error('Otra instalación de Inventario está en curso.');
   const [[installed]]=await c.query("SELECT checksum FROM app_migration WHERE id='U030'");const checksum=this.checksum('U030');if(installed&&installed.checksum!==checksum)throw new Error('Existe una versión U030 diferente. No se reemplaza.');
   const ready=await this.schema(c),pending=[];
   // La cuenta de ejecución no tiene TRIGGER y MySQL le oculta sus definiciones.
   // La comprobación limitada verifica esquema, versión y lecturas; la instalación verifica los cuerpos.
   for(const sql of check?[]:triggers){
    const name=sql.match(/^CREATE TRIGGER\s+(\w+)/i)[1],[[current]]=await c.query('SELECT ACTION_STATEMENT AS body FROM information_schema.triggers WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?',[name]);
    if(current&&this.normalize(current.body)===this.normalize(this.triggerBody(sql)))continue;
    if(current&&crypto.createHash('sha256').update(this.normalize(current.body)).digest('hex')!==originalHashes[name])throw new Error('El trigger '+name+' fue modificado. No se reemplaza.');
    if(check||installed)throw new Error('Falta completar Inventario U030. Ejecuta node scripts/setup-inventory.js con una cuenta de instalación y el servidor detenido.');
    if(!current&&originalHashes[name]&&!ready)throw new Error('Falta la protección original '+name+'. Revisa la base antes de instalar.');
    pending.push({name,sql,exists:Boolean(current)});
   }
   if(!ready){if(check||installed)throw new Error('Falta preparar Inventario U030. Ejecuta node scripts/setup-inventory.js.');await c.query(statements.find(s=>/^CREATE TABLE/i.test(s)));await this.schema(c);}
   for(const trigger of pending){if(trigger.exists)await c.query('DROP TRIGGER '+trigger.name);await c.query(trigger.sql);}
   if(!installed){if(check)throw new Error('U030 no está registrada. Ejecuta node scripts/setup-inventory.js.');await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)',['U030',checksum]);}
   for(const table of ['inventario_movimiento','ajuste_inventario','lote_ubicacion','vw_stock_lote_ubicacion','detalle_venta_lote','sesion_caja','venta'])await c.query('SELECT * FROM '+table+' LIMIT 0');
   return {database:info.name,installed:true};
  }finally{try{if(acquired)await c.query('SELECT RELEASE_LOCK(?)',[lockName]);}finally{c.release();}}
 }
}
if(require.main===module){
 require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});const pool=require('../src/config/database').getPool();
 new InventorySetup(pool).run({check:process.argv.includes('--comprobar')}).then(r=>console.log('INVENTARIO U030 PREPARADO en '+r.database+'. Se conservaron compras y existencias.'))
 .catch(error=>{require('../src/utils/safeLog')('INVENTORY_SETUP',error);console.error(error.code?'No se pudo preparar Inventario. Revisa conexión y permisos en docs/42_INVENTARIO_U030.md.':error.message);process.exitCode=1;}).finally(()=>pool.end());
}
module.exports=InventorySetup;
