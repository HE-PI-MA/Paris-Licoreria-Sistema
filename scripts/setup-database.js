/** Instalación NUEVA únicamente: crea la base V2 oficial y aplica todas las preparaciones hasta U044. */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const database = require('../src/config/database');
const { readSql } = require('./sql');
const ProductsSetup = require('./setup-products');
const SuppliersSetup = require('./setup-suppliers');
const InventorySetup = require('./setup-inventory');
const MediaSetup = require('./setup-media');
const CoreSetup = require('./setup-core');
const PurchasesU044Setup = require('./setup-purchases-u044');

const bootstrap = ['01_tablas_v2.sql','02_datos_iniciales_v2.sql','03_rutinas_v2.sql','04_vistas_v2.sql'];
function checksum(file) { return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g,'\n')).digest('hex'); }
async function install() {
  const pool = database.getPool(), c = await pool.getConnection(); let lockName, acquired = false;
  try {
    const [[info]] = await c.query('SELECT DATABASE() AS name,VERSION() AS version');
    if (!info.name || !/^8\./.test(info.version) || /mariadb/i.test(info.version)) throw new Error('La instalación requiere una base vacía en MySQL 8.');
    lockName = 'paris_fresh_' + crypto.createHash('sha256').update(info.name).digest('hex').slice(0,32);
    const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired',[lockName]); acquired = Number(lock.acquired) === 1;
    if (!acquired) throw new Error('Otra instalación está en curso.');
    const [existing] = await c.query("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'");
    if (existing.length) throw new Error('db:install solo se ejecuta en una base completamente vacía. Para una base existente usa las migraciones, nunca la reconstruyas.');
    for (const name of bootstrap) for (const sql of readSql(path.join(__dirname,'../database/bootstrap',name))) await c.query(sql);
    const u004 = path.join(__dirname,'../database/migrations/U004.sql');
    for (const sql of readSql(u004)) await c.query(sql);
    await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)',['U004',checksum(u004)]);
  } finally { try { if (acquired) await c.query('SELECT RELEASE_LOCK(?)',[lockName]); } finally { c.release(); } }
  // Cada instalador verifica su propia estructura antes de registrar la versión.
  await new ProductsSetup(pool).run();
  await new SuppliersSetup(pool).run();
  await new InventorySetup(pool).run();
  await new MediaSetup(pool).run();
  await new CoreSetup(pool).run();
  await new PurchasesU044Setup(pool).run();
  await database.assertSchema();
  return { database: process.env.DB_NAME };
}
if (require.main === module) install().then(result => console.log(`Instalación nueva completada en ${result.database}. Ejecuta npm run admin:create para crear el primer administrador.`))
  .catch(error => { require('../src/utils/safeLog')('DATABASE_FRESH_INSTALL',error); console.error(error.code ? 'No se pudo completar la instalación nueva. Revisa MySQL, permisos y la documentación U039.' : error.message); process.exitCode=1; })
  .finally(() => database.getPool().end());
module.exports = install;
