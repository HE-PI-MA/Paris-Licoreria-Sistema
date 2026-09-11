/** Aplica o reanuda U004 con registro y verificación de su huella; requiere respaldo y servidor detenido. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const database = require('../src/config/database');
const { readSql } = require('./sql');
const safeLog = require('../src/utils/safeLog');
const required = ['rol','usuario','producto','presentacion_producto','categoria','unidad_medida','proveedor','compra','detalle_compra','lote_producto','ubicacion','lote_ubicacion','ajuste_inventario','sesion_caja','venta','detalle_venta','detalle_venta_lote','pago','denominacion','arqueo_caja','detalle_arqueo'];
async function migrate() {
  const file = path.join(__dirname, '../database/migrations/U004.sql');
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  const c = await database.getPool().getConnection();
  const lockName = 'paris_U004_' + crypto.createHash('sha256').update(process.env.DB_NAME || '').digest('hex').slice(0,32);
  let locked = false;
  try {
    const [[lock]] = await c.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Otra migracion esta en ejecucion.');
    locked = true;
    const [tables] = await c.query('SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = ?', ['BASE TABLE']);
    const found = new Set(tables.map(t => t.name.toLowerCase()));
    if (required.some(name => !found.has(name))) throw new Error('La base no coincide con las 21 tablas V2. No se aplico el parche.');
    let resuming = false;
    if (found.has('app_migration')) {
      const [versions] = await c.execute('SELECT checksum FROM app_migration WHERE id = ?', ['U004']);
      if (versions.length) {
        if (versions[0].checksum !== checksum) throw new Error('Existe otra migracion U004. No se sobrescribe.');
        console.log('U004 ya esta aplicada.'); return;
      }
      const [started] = await c.execute('SELECT checksum FROM app_migration WHERE id = ?', ['U004_STARTED']);
      if (started.length) {
        if (started[0].checksum !== checksum) throw new Error('La migracion incompleta corresponde a otro contenido. No se sobrescribe.');
        resuming = true;
      }
    }
    const index = process.argv.indexOf('--backup');
    const backup = index >= 0 ? process.argv[index + 1] : null;
    if (!backup || !backup.toLowerCase().endsWith('.sql') || !fs.statSync(backup).isFile() || fs.statSync(backup).size < 1024) {
      throw new Error('Primero respalda la base y ejecuta: npm run db:migrate -- --backup RUTA.sql');
    }
    const [[schema]] = await c.query('SELECT DATABASE() AS name');
    console.log('Base objetivo: ' + schema.name + '. Debes haber detenido el servidor y respaldado esta base.');
    const [routines] = await c.query("SELECT ROUTINE_NAME AS name FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE'");
    for (const name of ['sp_registrar_compra','sp_registrar_venta','sp_anular_venta','sp_registrar_ajuste_inventario','sp_cerrar_sesion_caja']) {
      if (!resuming && !routines.some(v => v.name === name)) throw new Error('Falta una rutina V2 requerida. No se aplico el parche.');
    }
    const [[version]] = await c.query('SELECT VERSION() AS version');
    if (!/^8\./.test(version.version) || /mariadb/i.test(version.version)) throw new Error('Esta migracion requiere MySQL 8.');
    // DDL commits independently in MySQL. If any statement fails, stop without recording success.
    const statements = readSql(file);
    // Infrastructure is created before replacing any routine. Record the exact
    // payload so an interrupted DROP/CREATE can resume without a missing-routine gate.
    for (let i = 0; i < statements.length; i++) {
      try {
        await c.query(statements[i]);
        if (/^CREATE TABLE IF NOT EXISTS app_migration\s*\(/i.test(statements[i])) {
          await c.execute('INSERT INTO app_migration (id, checksum) VALUES (?, ?) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum)', ['U004_STARTED', checksum]);
        }
      }
      catch (error) { safeLog('MIGRATION_STATEMENT_' + (i+1), error); throw new Error('Migracion incompleta en sentencia ' + (i+1) + '. Mantener el servidor detenido y revisar el respaldo.'); }
    }
    await c.execute('INSERT INTO app_migration (id, checksum) VALUES (?, ?)', ['U004', checksum]);
    await c.execute('DELETE FROM app_migration WHERE id = ?', ['U004_STARTED']);
    console.log('Migracion U004 completada. Se conservaron las tablas y sus datos.');
  } finally {
    if (locked) await c.query('SELECT RELEASE_LOCK(?)', [lockName]);
    c.release();
  }
}
if (require.main === module) migrate().catch(error => {
  safeLog('MIGRATION_FAILED', error);
  // Only show our own fixed messages; MySQL messages can contain confidential SQL.
  console.error(error.constructor === Error && !error.code ? error.message : 'No se pudo migrar. Revisa conexion, permisos y version de MySQL.');
  process.exitCode = 1;
}).finally(() => database.getPool().end());
module.exports = migrate;
