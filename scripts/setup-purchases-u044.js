/** U044: preparación reanudable de Compras simplificadas. No borra historial. */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { readSql } = require('./sql');

class PurchasesU044Setup {
  constructor(pool) {
    this.pool = pool;
    this.file = path.join(__dirname, '../database/migrations/U044.sql');
  }
  checksum() {
    return crypto.createHash('sha256').update(fs.readFileSync(this.file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  }
  async column(c, table, name) {
    const [[row]] = await c.query(`SELECT COLUMN_NAME AS name,IS_NULLABLE AS nullable,COLUMN_TYPE AS type
      FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`, [table, name]);
    return row || null;
  }
  async constraint(c, table, name) {
    const [[row]] = await c.query(`SELECT CONSTRAINT_NAME AS name FROM information_schema.table_constraints
      WHERE table_schema=DATABASE() AND table_name=? AND constraint_name=?`, [table, name]);
    return Boolean(row);
  }
  async index(c, table, name) {
    const [[row]] = await c.query(`SELECT INDEX_NAME AS name FROM information_schema.statistics
      WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1`, [table, name]);
    return Boolean(row);
  }
  async prerequisites(c) {
    const [[row]] = await c.query("SELECT id FROM app_migration WHERE id='U039'");
    if (!row) throw new Error('Antes de U044 debes tener U039 instalada.');
  }
  async structural(c) {
    const supplier = await this.column(c, 'compra', 'id_proveedor');
    if (!supplier) throw new Error('Falta compra.id_proveedor.');
    if (supplier.nullable !== 'YES') await c.query('ALTER TABLE compra MODIFY COLUMN id_proveedor INT UNSIGNED NULL');

    if (!await this.column(c, 'detalle_compra', 'id_producto')) {
      await c.query('ALTER TABLE detalle_compra ADD COLUMN id_producto INT UNSIGNED NULL AFTER id_compra');
    }
    if (!await this.column(c, 'detalle_compra', 'forma_ingreso')) {
      await c.query('ALTER TABLE detalle_compra ADD COLUMN forma_ingreso VARCHAR(80) NULL AFTER id_presentacion');
    }
    if (!await this.column(c, 'detalle_compra', 'factor_ingreso')) {
      await c.query('ALTER TABLE detalle_compra ADD COLUMN factor_ingreso DECIMAL(15,3) NULL AFTER forma_ingreso');
    }

    await c.query(`UPDATE detalle_compra dc
      JOIN presentacion_producto pp ON pp.id_presentacion=dc.id_presentacion
      SET dc.id_producto=COALESCE(dc.id_producto,pp.id_producto),
          dc.forma_ingreso=COALESCE(dc.forma_ingreso,pp.nombre_presentacion),
          dc.factor_ingreso=COALESCE(dc.factor_ingreso,pp.factor_conversion)
      WHERE dc.id_producto IS NULL OR dc.forma_ingreso IS NULL OR dc.factor_ingreso IS NULL`);

    const [[missing]] = await c.query(`SELECT COUNT(*) AS total FROM detalle_compra
      WHERE id_producto IS NULL OR forma_ingreso IS NULL OR TRIM(forma_ingreso)='' OR factor_ingreso IS NULL OR factor_ingreso<=0`);
    if (Number(missing.total)) throw new Error('Hay compras históricas que no pudieron convertirse al nuevo formato. No se continúa.');

    const presentation = await this.column(c, 'detalle_compra', 'id_presentacion');
    if (!presentation) throw new Error('Falta detalle_compra.id_presentacion.');
    if (presentation.nullable !== 'YES') await c.query('ALTER TABLE detalle_compra MODIFY COLUMN id_presentacion INT UNSIGNED NULL');

    if (!await this.constraint(c, 'detalle_compra', 'fk_detalle_compra_producto')) {
      await c.query(`ALTER TABLE detalle_compra ADD CONSTRAINT fk_detalle_compra_producto
        FOREIGN KEY (id_producto) REFERENCES producto(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT`);
    }
    if (!await this.constraint(c, 'detalle_compra', 'chk_detalle_compra_forma_ingreso')) {
      await c.query(`ALTER TABLE detalle_compra ADD CONSTRAINT chk_detalle_compra_forma_ingreso
        CHECK (forma_ingreso IS NULL OR TRIM(forma_ingreso)<>'')`);
    }
    if (!await this.constraint(c, 'detalle_compra', 'chk_detalle_compra_factor_ingreso')) {
      await c.query(`ALTER TABLE detalle_compra ADD CONSTRAINT chk_detalle_compra_factor_ingreso
        CHECK (factor_ingreso IS NULL OR factor_ingreso>0)`);
    }
    if (!await this.index(c, 'detalle_compra', 'idx_detalle_compra_producto')) {
      await c.query('ALTER TABLE detalle_compra ADD INDEX idx_detalle_compra_producto (id_producto,id_compra)');
    }
  }
  async objects(c) {
    const statements = readSql(this.file).filter(sql =>
      /^(DROP TRIGGER|CREATE TRIGGER|DROP PROCEDURE|CREATE PROCEDURE|CREATE OR REPLACE VIEW)/i.test(sql)
    );
    for (const sql of statements) await c.query(sql);
  }
  async verify(c) {
    const supplier = await this.column(c, 'compra', 'id_proveedor');
    if (!supplier || supplier.nullable !== 'YES') return false;
    for (const name of ['id_producto','forma_ingreso','factor_ingreso']) if (!await this.column(c, 'detalle_compra', name)) return false;
    const presentation = await this.column(c, 'detalle_compra', 'id_presentacion');
    if (!presentation || presentation.nullable !== 'YES') return false;
    if (!await this.constraint(c, 'detalle_compra', 'fk_detalle_compra_producto')) return false;
    if (!await this.index(c, 'detalle_compra', 'idx_detalle_compra_producto')) return false;

    const [triggers] = await c.query(`SELECT TRIGGER_NAME AS name FROM information_schema.triggers
      WHERE trigger_schema=DATABASE() AND TRIGGER_NAME IN
      ('trg_producto_bu_unidad_base','trg_presentacion_bu_conversion','trg_detalle_compra_bi_u044',
       'trg_detalle_compra_bu_lotes','trg_lote_producto_bi_conversion','trg_lote_producto_bu_conversion',
       'trg_dvl_bi_integridad')`);
    if (triggers.length !== 7) return false;

    const [[integrity]] = await c.query(`SELECT ACTION_STATEMENT AS body FROM information_schema.triggers
      WHERE trigger_schema=DATABASE() AND trigger_name='trg_dvl_bi_integridad'`);
    if (!integrity || !/dc\.id_producto/.test(String(integrity.body || '')) || /dc\.id_presentacion/.test(String(integrity.body || ''))) return false;

    const [views] = await c.query(`SELECT TABLE_NAME AS name FROM information_schema.views
      WHERE table_schema=DATABASE() AND TABLE_NAME IN ('vw_stock_lote_ubicacion','vw_stock_producto','vw_compras_totales')`);
    if (views.length !== 3) return false;

    const [[routine]] = await c.query(`SELECT ROUTINE_NAME AS name FROM information_schema.routines
      WHERE routine_schema=DATABASE() AND routine_type='PROCEDURE' AND routine_name='sp_registrar_venta'`);
    if (!routine) return false;

    const [[missing]] = await c.query(`SELECT COUNT(*) AS total FROM detalle_compra
      WHERE id_producto IS NULL OR forma_ingreso IS NULL OR factor_ingreso IS NULL OR factor_ingreso<=0`);
    return Number(missing.total) === 0;
  }
  async run({ check = false } = {}) {
    const c = await this.pool.getConnection();
    let lockName, acquired = false;
    try {
      await this.prerequisites(c);
      const [[db]] = await c.query('SELECT DATABASE() AS name');
      lockName = 'paris_U044_' + crypto.createHash('sha256').update(db.name).digest('hex').slice(0, 32);
      const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
      acquired = Number(lock.acquired) === 1;
      if (!acquired) throw new Error('Otra instalación U044 está en curso.');

      const checksum = this.checksum();
      const [[installed]] = await c.query("SELECT checksum FROM app_migration WHERE id='U044'");
      if (installed && installed.checksum !== checksum) throw new Error('Existe una versión U044 diferente. No se reemplaza.');
      if (installed) {
        if (!await this.verify(c)) throw new Error('U044 está registrada pero su estructura está incompleta.');
        return { database: db.name, installed: true };
      }
      if (check) throw new Error('U044 todavía no está instalada. Ejecuta node scripts/setup-purchases-u044.js con el servidor detenido.');

      await this.structural(c);
      await this.objects(c);
      if (!await this.verify(c)) throw new Error('La verificación final de U044 no coincide con la estructura esperada.');
      await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)', ['U044', checksum]);
      return { database: db.name, installed: true };
    } finally {
      try { if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [lockName]); }
      finally { c.release(); }
    }
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const pool = require('../src/config/database').getPool();
  new PurchasesU044Setup(pool).run({ check: process.argv.includes('--comprobar') })
    .then(result => console.log('U044 PREPARADA en ' + result.database + '. Compras usa productos existentes, factor de ingreso propio y lote automático.'))
    .catch(error => {
      require('../src/utils/safeLog')('PURCHASES_U044_SETUP', error);
      console.error(error.code ? 'No se pudo preparar U044. Revisa conexión/permisos y vuelve a ejecutar el mismo comando.' : error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
module.exports = PurchasesU044Setup;
