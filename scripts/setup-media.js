/** U031 explícita, aditiva y reanudable. No instala nada al iniciar el servidor. */
const path = require('node:path'), crypto = require('node:crypto');
const ProductsSetup = require('./setup-products'), { readSql } = require('./sql');
class MediaSetup extends ProductsSetup {
  async verify(c) {
    const [rows] = await c.query("SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLLATION_NAME AS collation FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='producto_imagen' ORDER BY ORDINAL_POSITION");
    if (!rows.length) return false;
    const expected = [['id_producto','int unsigned','NO',null],['contenido','mediumblob','NO',null],['hash','char(64)','NO','ascii_bin']];
    const [[table]] = await c.query("SELECT ENGINE AS engine FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='producto_imagen'");
    const [keys] = await c.query("SELECT COLUMN_NAME AS name,REFERENCED_TABLE_NAME AS target,REFERENCED_COLUMN_NAME AS targetColumn FROM information_schema.key_column_usage WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='producto_imagen' AND REFERENCED_TABLE_NAME IS NOT NULL");
    const [primary] = await c.query("SELECT COLUMN_NAME AS name FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='producto_imagen' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX");
    const [foreign] = await c.query("SELECT DELETE_RULE AS rule FROM information_schema.referential_constraints WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='producto_imagen'");
    const [checks] = await c.query("SELECT cc.CHECK_CLAUSE AS clause,tc.ENFORCED AS enforced FROM information_schema.table_constraints tc JOIN information_schema.check_constraints cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='producto_imagen' AND tc.CONSTRAINT_TYPE='CHECK'");
    const check = checks[0]?.clause.replace(/[\s`()]/g, '').toLowerCase();
    if (JSON.stringify(rows.map(r=>[r.name,r.type,r.nullable,r.collation])) !== JSON.stringify(expected) || table.engine !== 'InnoDB' || primary.map(r=>r.name).join(',') !== 'id_producto' || JSON.stringify(keys.map(r=>[r.name,r.target,r.targetColumn])) !== JSON.stringify([['id_producto','producto','id_producto']]) || foreign.length !== 1 || foreign[0].rule !== 'CASCADE' || checks.length !== 1 || checks[0].enforced !== 'YES' || !['lengthcontenidobetween1and262144','octet_lengthcontenidobetween1and262144'].includes(check)) throw new Error('producto_imagen tiene otra estructura. No se sobrescribe.');
    return true;
  }
  async run({ check = false } = {}) {
    await new ProductsSetup(this.pool).run({ check: true });
    const c = await this.pool.getConnection(); let lockName, acquired = false;
    try {
      const [[info]] = await c.query('SELECT DATABASE() AS name');
      lockName = 'paris_U031_' + crypto.createHash('sha256').update(info.name).digest('hex').slice(0, 32);
      const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]); acquired = Number(lock.acquired) === 1;
      if (!acquired) throw new Error('Otra instalación U031 está en curso.');
      const [[installed]] = await c.query("SELECT checksum FROM app_migration WHERE id='U031'");
      if (installed && installed.checksum !== this.checksum('U031')) throw new Error('Existe una versión U031 diferente. No se reemplaza.');
      if (!await this.verify(c)) {
        if (check || installed) throw new Error('Falta preparar las fotos. Ejecuta node scripts/setup-media.js con una cuenta de instalación.');
        for (const sql of readSql(path.join(__dirname, '../database/migrations/U031.sql'))) await c.query(sql);
        await this.verify(c);
      }
      if (!installed) {
        if (check) throw new Error('U031 está pendiente de registrar. Ejecuta node scripts/setup-media.js.');
        await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)', ['U031', this.checksum('U031')]);
      }
      await c.query('SELECT id_producto,contenido,hash FROM producto_imagen LIMIT 0');
      return { database: info.name, installed: true };
    } finally { try { if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [lockName]); } finally { c.release(); } }
  }
}
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const pool = require('../src/config/database').getPool();
  new MediaSetup(pool).run({ check: process.argv.includes('--comprobar') }).then(() => console.log('FOTOS U031 PREPARADAS. Se conservaron productos, compras y existencias.'))
    .catch(error => { require('../src/utils/safeLog')('MEDIA_SETUP', error); console.error(error.code ? 'No se pudo preparar U031. Revisa conexión y permisos en docs/43_AUDITORIA_FOTOS_CODIGOS_U031.md.' : error.message); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = MediaSetup;
