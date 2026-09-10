const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const database = require('../src/config/database');
const migrate = require('../scripts/migrate');

test('migration runner resumes an interrupted DROP/CREATE and refuses a different payload', async () => {
  const originalPool = database.pool, originalArgv = process.argv;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'paris-migrate-'));
  const backup = path.join(temporary, 'synthetic.sql');
  fs.writeFileSync(backup, '-- Synthetic backup for orchestration test only.\n'.repeat(50));
  const markers = new Map();
  const tables = new Set('rol usuario producto presentacion_producto categoria unidad_medida proveedor compra detalle_compra lote_producto ubicacion lote_ubicacion ajuste_inventario sesion_caja venta detalle_venta detalle_venta_lote pago denominacion arqueo_caja detalle_arqueo'.split(' '));
  const routines = new Set(['sp_registrar_compra','sp_registrar_venta','sp_anular_venta','sp_registrar_ajuste_inventario','sp_cerrar_sesion_caja']);
  let failCreate = true, ddlCount = 0, released = 0;
  const connection = {
    async query(sql) {
      if(sql.startsWith('SELECT GET_LOCK'))return [[{acquired:1}]];
      if(sql.startsWith('SELECT RELEASE_LOCK'))return [[{released:1}]];
      if(sql.includes('information_schema.tables'))return [[...tables].map(name=>({name}))];
      if(sql.includes('information_schema.routines'))return [[...routines].map(name=>({name}))];
      if(sql.startsWith('SELECT DATABASE()'))return [[{name:'synthetic_test'}]];
      if(sql.startsWith('SELECT VERSION()'))return [[{version:'8.0.44'}]];
      if(sql.startsWith('CREATE ') || sql.startsWith('DROP '))ddlCount++;
      const table=/^CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql);if(table)tables.add(table[1]);
      const drop=/^DROP PROCEDURE IF EXISTS (\w+)/.exec(sql);if(drop)routines.delete(drop[1]);
      const create=/^CREATE PROCEDURE (\w+)/.exec(sql);
      if(create){
        if(failCreate){failCreate=false;const error=new Error('Synthetic interruption');error.code='ER_PARSE_ERROR';throw error;}
        routines.add(create[1]);
      }
      return [{}];
    },
    async execute(sql,args){
      if(sql.startsWith('SELECT checksum'))return [markers.has(args[0])?[{checksum:markers.get(args[0])}]:[]];
      if(sql.startsWith('INSERT INTO app_migration'))markers.set(args[0],args[1]);
      if(sql.startsWith('DELETE FROM app_migration'))markers.delete(args[0]);
      return [{}];
    },
    release(){released++;}
  };
  database.pool={getConnection:async()=>connection};
  process.argv=[process.execPath,'migrate.js','--backup',backup];
  try{
    await assert.rejects(migrate(), /Migracion incompleta/);
    assert.equal(markers.has('U004'),false);
    assert.equal(markers.has('U004_STARTED'),true);
    assert.equal(routines.has('sp_registrar_compra'),false);
    await migrate();
    assert.equal(markers.has('U004'),true);
    assert.equal(markers.has('U004_STARTED'),false);
    assert.equal(routines.size,5);
    const completedDdl=ddlCount;
    await migrate();assert.equal(ddlCount,completedDdl);
    markers.delete('U004');markers.set('U004_STARTED','different-checksum');
    await assert.rejects(migrate(),/otro contenido/);assert.equal(ddlCount,completedDdl);
    assert.equal(released,4);
  }finally{
    database.pool=originalPool;process.argv=originalArgv;
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});
