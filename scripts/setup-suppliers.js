/** Instala el NIT opcional de Proveedores sobre U012. Verifica la estructura antes de alterar y permite reanudar el registro de una instalación interrumpida. */
const path = require('node:path');
const crypto = require('node:crypto');
const ProductsSetup = require('./setup-products');
const { readSql } = require('./sql');
class SuppliersSetup extends ProductsSetup {
  async schema(c) {
    const [columns] = await c.query("SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='proveedor' ORDER BY ORDINAL_POSITION");
    const expected = [['id_proveedor', 'int unsigned', 'NO'], ['nombre', 'varchar(120)', 'NO'], ['contacto', 'varchar(100)', 'YES'], ['telefono', 'varchar(30)', 'YES'], ['direccion', 'varchar(200)', 'YES'], ['estado', 'varchar(20)', 'NO']];
    const ordinary = columns.filter(row => row.name !== 'nit').map(row => [row.name, row.type, row.nullable]);
    if (JSON.stringify(ordinary) !== JSON.stringify(expected)) throw new Error('La tabla proveedor tiene otra estructura. No se modifica.');
    const [engines] = await c.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('proveedor','compra')");
    const [primary] = await c.query("SELECT COLUMN_NAME AS name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='proveedor' AND index_name='PRIMARY' ORDER BY SEQ_IN_INDEX");
    const [foreign] = await c.query("SELECT k.COLUMN_NAME AS name, k.REFERENCED_COLUMN_NAME AS target, r.DELETE_RULE AS rule FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='compra' AND k.REFERENCED_TABLE_NAME='proveedor'");
    if (engines.length !== 2 || engines.some(row => row.engine !== 'InnoDB') || primary.map(row => row.name).join(',') !== 'id_proveedor' || foreign.length !== 1 || foreign[0].name !== 'id_proveedor' || foreign[0].target !== 'id_proveedor' || !['RESTRICT', 'NO ACTION'].includes(foreign[0].rule)) throw new Error('Proveedores o Compras tienen claves o motor distintos. No se modifica.');
    const [index] = await c.query("SELECT COLUMN_NAME AS name, NON_UNIQUE AS nonUnique, SUB_PART AS prefix FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='proveedor' AND index_name='uq_proveedor_nit' ORDER BY SEQ_IN_INDEX");
    const nit = columns.find(row => row.name === 'nit');
    if (!nit && !index.length) return false;
    if (!nit || nit.type !== 'varchar(30)' || nit.nullable !== 'YES' || index.length !== 1 || index[0].name !== 'nit' || Number(index[0].nonUnique) !== 0 || index[0].prefix !== null) throw new Error('El campo NIT o su índice tiene otra definición. No se reemplaza.');
    return true;
  }
  async run({ check = false } = {}) {
    await new ProductsSetup(this.pool).run({ check: true });
    const c = await this.pool.getConnection(); let lockName, acquired = false;
    try {
      const [[info]] = await c.query('SELECT DATABASE() AS name');
      lockName = 'paris_U023_' + crypto.createHash('sha256').update(info.name).digest('hex').slice(0, 32);
      const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
      acquired = Number(lock.acquired) === 1;
      if (!acquired) throw new Error('Otra instalación de Proveedores está en curso.');
      const [[installed]] = await c.query("SELECT checksum FROM app_migration WHERE id='U023'");
      const checksum = this.checksum('U023');
      if (installed && installed.checksum !== checksum) throw new Error('Existe una migración U023 diferente. No se reemplaza.');
      const ready = await this.schema(c);
      if (!ready) {
        if (check || installed) throw new Error('Falta preparar el NIT. Ejecuta node scripts/setup-suppliers.js con una cuenta de instalación.');
        for (const sql of readSql(path.join(__dirname, '../database/migrations/U023.sql'))) await c.query(sql);
        await this.schema(c);
      }
      if (!installed) {
        if (check) throw new Error('U023 todavía no está registrada. Ejecuta node scripts/setup-suppliers.js.');
        await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)', ['U023', checksum]);
      }
      for (const table of ['proveedor', 'compra']) await c.query('SELECT * FROM ' + table + ' LIMIT 0');
      return { database: info.name, installed: true };
    } finally { try { if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [lockName]); } finally { c.release(); } }
  }
}
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const pool = require('../src/config/database').getPool();
  new SuppliersSetup(pool).run({ check: process.argv.includes('--comprobar') }).then(result => {
    console.log('PROVEEDORES U023 PREPARADO en ' + result.database + '. Se conservaron los datos existentes.');
  }).catch(error => {
    require('../src/utils/safeLog')('SUPPLIERS_SETUP', error);
    console.error(error.code ? 'No se pudo preparar Proveedores. Revisa conexión y permisos; consulta docs/35_PROVEEDORES_U023.md.' : error.message); process.exitCode = 1;
  }).finally(() => pool.end());
}
module.exports = SuppliersSetup;
