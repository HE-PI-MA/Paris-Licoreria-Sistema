/** Instala únicamente la infraestructura U012. Verifica U004 y cualquier tabla previa antes de registrar la migración; se puede reanudar. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readSql } = require('./sql');
class ProductsSetup {
  constructor(pool) { this.pool = pool; }
  checksum(version) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../database/migrations/' + version + '.sql'), 'utf8').replace(/\r\n/g, '\n')).digest('hex'); }
  async verifyTable(c) {
    const [columns] = await c.query('SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLLATION_NAME AS collation FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ORDINAL_POSITION', ['catalogo_operacion']);
    const expected = [['id_usuario','int unsigned','NO',null],['clave','char(36)','NO','ascii_bin'],['solicitud_hash','char(64)','NO','ascii_bin'],['resultado','json','YES',null],['creada_en','timestamp','NO',null]];
    if (JSON.stringify(columns.map(v => [v.name,v.type,v.nullable,v.collation])) !== JSON.stringify(expected)) throw new Error('La tabla catalogo_operacion tiene otra estructura. No se sobrescribe.');
    const [indices] = await c.query("SELECT COLUMN_NAME AS name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='catalogo_operacion' AND index_name='PRIMARY' ORDER BY SEQ_IN_INDEX");
    const [[table]] = await c.query("SELECT ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='catalogo_operacion'");
    const [foreign] = await c.query("SELECT COLUMN_NAME AS name, REFERENCED_TABLE_NAME AS target, REFERENCED_COLUMN_NAME AS targetColumn FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name='catalogo_operacion' AND REFERENCED_TABLE_NAME IS NOT NULL");
    if (table.engine !== 'InnoDB' || indices.map(v => v.name).join(',') !== 'id_usuario,clave' || foreign.length !== 1 || foreign[0].name !== 'id_usuario' || foreign[0].target !== 'usuario' || foreign[0].targetColumn !== 'id_usuario') throw new Error('La tabla catalogo_operacion tiene claves o motor diferentes. No se sobrescribe.');
  }
  async run({ check = false } = {}) {
    const c = await this.pool.getConnection(); let lockName;
    try {
      const [[info]] = await c.query('SELECT DATABASE() AS name, VERSION() AS version');
      const v = info.version.split('.').map(Number);
      if (!info.name || v[0] !== 8 || (v[1] === 0 && v[2] < 22)) throw new Error('U012 requiere una base configurada en MySQL 8.0.22 o posterior de la serie 8.');
      lockName = 'paris_U012_' + crypto.createHash('sha256').update(info.name).digest('hex').slice(0,32);
      const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
      if (Number(lock.acquired) !== 1) throw new Error('Otra instalación U012 está en curso.');
      const [versions] = await c.query("SELECT id, checksum FROM app_migration WHERE id IN ('U004','U012')");
      if (versions.find(row => row.id === 'U004')?.checksum !== this.checksum('U004')) throw new Error('Primero debe estar instalada la versión U004 esperada.');
      const installed = versions.find(row => row.id === 'U012');
      if (installed && installed.checksum !== this.checksum('U012')) throw new Error('Existe una migración U012 distinta. No se reemplaza.');
      const [tables] = await c.query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='catalogo_operacion'");
      if (!tables.length) {
        if (check || installed) throw new Error('Falta catalogo_operacion. Ejecuta node scripts/setup-products.js con una cuenta de instalación.');
        for (const statement of readSql(path.join(__dirname, '../database/migrations/U012.sql'))) await c.query(statement);
      }
      await this.verifyTable(c);
      if (!installed) {
        if (check) throw new Error('La instalación U012 está pendiente de registrar. Ejecuta node scripts/setup-products.js.');
        await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)', ['U012',this.checksum('U012')]);
      }
      // Consultas sin filas: comprueban acceso de lectura sin tocar datos del negocio.
      for (const table of ['producto','presentacion_producto','categoria','unidad_medida','detalle_compra','detalle_venta','vw_stock_producto','catalogo_operacion']) await c.query('SELECT * FROM ' + table + ' LIMIT 0');
      return { database: info.name, installed: true };
    } finally { if (lockName) await c.query('SELECT RELEASE_LOCK(?)', [lockName]); c.release(); }
  }
}
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const database = require('../src/config/database');
  new ProductsSetup(database.getPool()).run({ check: process.argv.includes('--comprobar') }).then(result => {
    console.log('U012 verificada en ' + result.database + '. Se conservaron los datos del negocio.');
  }).catch(error => {
    require('../src/utils/safeLog')('PRODUCTS_SETUP', error);
    console.error(error.code ? 'No se pudo preparar U012. Revisa conexión y permisos de instalación; consulta docs/24_PRODUCTOS_U012.md.' : error.message);
    process.exitCode = 1;
  }).finally(() => database.getPool().end());
}
module.exports = ProductsSetup;
