/** U039: instala el núcleo de Caja/Ventas/Reportes/Usuarios sin tocar operaciones históricas ni migraciones anteriores. */
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { readSql } = require('./sql');

class CoreSetup {
  constructor(pool) { this.pool = pool; this.file = path.join(__dirname, '../database/migrations/U039.sql'); }
  checksum() { return crypto.createHash('sha256').update(fs.readFileSync(this.file, 'utf8').replace(/\r\n/g, '\n')).digest('hex'); }
  async column(c, table, name) {
    const [[row]] = await c.query('SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?', [table, name]);
    return Boolean(row);
  }
  async constraint(c, table, name) {
    const [[row]] = await c.query('SELECT CONSTRAINT_NAME AS name FROM information_schema.table_constraints WHERE table_schema=DATABASE() AND table_name=? AND constraint_name=?', [table, name]);
    return Boolean(row);
  }
  async index(c, table, name) {
    const [[row]] = await c.query('SELECT INDEX_NAME AS name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1', [table, name]);
    return Boolean(row);
  }
  async table(c, name) {
    const [[row]] = await c.query('SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?', [name]);
    return row || null;
  }
  async prerequisites(c) {
    const required = ['U004','U012','U023','U030','U031'];
    const [rows] = await c.query('SELECT id FROM app_migration WHERE id IN (?,?,?,?,?)', required);
    const found = new Set(rows.map(row => row.id));
    const missing = required.filter(id => !found.has(id));
    if (missing.length) throw new Error('Antes de U039 faltan estas preparaciones: ' + missing.join(', ') + '.');
  }
  async structural(c) {
    const statements = readSql(this.file);
    if (!await this.table(c, 'caja')) await c.query(statements[0]);
    await c.query(statements[1]);

    if (!await this.column(c, 'sesion_caja', 'id_caja')) {
      await c.query('ALTER TABLE sesion_caja ADD COLUMN id_caja TINYINT UNSIGNED NULL AFTER id_sesion_caja');
    }
    if (!await this.constraint(c, 'sesion_caja', 'fk_sesion_caja_fisica')) {
      await c.query('ALTER TABLE sesion_caja ADD CONSTRAINT fk_sesion_caja_fisica FOREIGN KEY (id_caja) REFERENCES caja(id_caja) ON UPDATE CASCADE ON DELETE RESTRICT');
    }
    if (!await this.index(c, 'sesion_caja', 'idx_sesion_caja_estado')) {
      await c.query('ALTER TABLE sesion_caja ADD INDEX idx_sesion_caja_estado (id_caja,estado,fecha_hora_apertura)');
    }
    // Solo una sesión actualmente abierta necesita caja física para continuar. No se inventa una caja para cierres históricos.
    await c.query("UPDATE sesion_caja sc JOIN (SELECT id_caja FROM caja WHERE nombre='Caja 1' LIMIT 1) ca SET sc.id_caja=ca.id_caja WHERE sc.estado='ABIERTA' AND sc.id_caja IS NULL");

    const saleColumns = [
      ['fecha_hora_anulacion', 'ALTER TABLE venta ADD COLUMN fecha_hora_anulacion DATETIME NULL AFTER motivo_anulacion'],
      ['id_usuario_anulacion', 'ALTER TABLE venta ADD COLUMN id_usuario_anulacion INT UNSIGNED NULL AFTER fecha_hora_anulacion'],
      ['operacion_clave', "ALTER TABLE venta ADD COLUMN operacion_clave CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id_usuario_anulacion"],
      ['solicitud_hash', "ALTER TABLE venta ADD COLUMN solicitud_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER operacion_clave"]
    ];
    for (const [name, sql] of saleColumns) if (!await this.column(c, 'venta', name)) await c.query(sql);
    if (!await this.constraint(c, 'venta', 'fk_venta_usuario_anulacion')) {
      await c.query('ALTER TABLE venta ADD CONSTRAINT fk_venta_usuario_anulacion FOREIGN KEY (id_usuario_anulacion) REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT');
    }
    if (!await this.index(c, 'venta', 'uq_venta_operacion')) {
      await c.query('ALTER TABLE venta ADD CONSTRAINT uq_venta_operacion UNIQUE (id_sesion_caja,operacion_clave)');
    }
    if (!await this.constraint(c, 'venta', 'chk_venta_operacion')) {
      await c.query('ALTER TABLE venta ADD CONSTRAINT chk_venta_operacion CHECK ((operacion_clave IS NULL AND solicitud_hash IS NULL) OR (operacion_clave IS NOT NULL AND solicitud_hash IS NOT NULL))');
    }
    if (!await this.table(c, 'devolucion_pago')) await c.query(statements[4]);
    if (!await this.index(c, 'catalogo_operacion', 'idx_catalogo_operacion_creada')) await c.query(statements[5]);
  }
  async verify(c) {
    const caja = await this.table(c, 'caja'), devolucion = await this.table(c, 'devolucion_pago');
    if (!caja || caja.engine !== 'InnoDB' || !devolucion || devolucion.engine !== 'InnoDB' || !await this.index(c, 'catalogo_operacion', 'idx_catalogo_operacion_creada')) return false;
    for (const name of ['id_caja']) if (!await this.column(c, 'sesion_caja', name)) return false;
    for (const name of ['fecha_hora_anulacion','id_usuario_anulacion','operacion_clave','solicitud_hash']) if (!await this.column(c, 'venta', name)) return false;
    const [routines] = await c.query("SELECT ROUTINE_NAME AS name FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='PROCEDURE' AND ROUTINE_NAME IN ('sp_registrar_venta','sp_anular_venta','sp_cerrar_sesion_caja','sp_limpiar_catalogo_operacion')");
    if (routines.length !== 4) return false;
    const [triggers] = await c.query("SELECT TRIGGER_NAME AS name FROM information_schema.triggers WHERE trigger_schema=DATABASE() AND TRIGGER_NAME IN ('trg_sesion_bi_fecha_u039','trg_sesion_bu_historial_u039','trg_venta_bi_u039','trg_venta_bu_u039','trg_caja_bu_u039','trg_caja_bd_u039','trg_devolucion_pago_bi_u039','trg_devolucion_pago_bu_u039','trg_devolucion_pago_bd_u039')");
    if (triggers.length !== 9) return false;
    const [views] = await c.query("SELECT TABLE_NAME AS name FROM information_schema.views WHERE table_schema=DATABASE() AND TABLE_NAME IN ('vw_ventas_totales','vw_efectivo_esperado_sesion','vw_diferencias_caja','vw_reembolsos_venta')");
    if (views.length !== 4) return false;
    const [[boxes]] = await c.query("SELECT COUNT(*) AS total FROM caja WHERE nombre IN ('Caja 1','Caja 2')");
    return Number(boxes.total) === 2;
  }
  async run({ check = false } = {}) {
    const c = await this.pool.getConnection(); let lockName, acquired = false;
    try {
      await this.prerequisites(c);
      const [[db]] = await c.query('SELECT DATABASE() AS name');
      lockName = 'paris_U039_' + crypto.createHash('sha256').update(db.name).digest('hex').slice(0, 32);
      const [[lock]] = await c.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]); acquired = Number(lock.acquired) === 1;
      if (!acquired) throw new Error('Otra instalación U039 está en curso.');
      const checksum = this.checksum();
      const [[installed]] = await c.query("SELECT checksum FROM app_migration WHERE id='U039'");
      if (installed && installed.checksum !== checksum) throw new Error('Existe una versión U039 diferente. No se reemplaza.');
      if (installed) {
        if (!await this.verify(c)) throw new Error('U039 está registrada pero su estructura está incompleta. Revisa la base antes de continuar.');
        return { database: db.name, installed: true };
      }
      if (check) throw new Error('U039 todavía no está instalada. Ejecuta node scripts/setup-core.js con una cuenta de instalación y el servidor detenido.');

      await this.structural(c);
      const statements = readSql(this.file);
      // Las seis primeras sentencias son estructura e índice y se aplican de forma reanudable arriba.
      for (const sql of statements.slice(6)) await c.query(sql);
      if (!await this.verify(c)) throw new Error('La verificación final de U039 no coincide con la estructura esperada.');
      await c.query('INSERT INTO app_migration(id,checksum) VALUES(?,?)', ['U039', checksum]);
      return { database: db.name, installed: true };
    } finally {
      try { if (acquired) await c.query('SELECT RELEASE_LOCK(?)', [lockName]); } finally { c.release(); }
    }
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const pool = require('../src/config/database').getPool();
  new CoreSetup(pool).run({ check: process.argv.includes('--comprobar') })
    .then(result => console.log('U039 PREPARADA en ' + result.database + '. Caja física, FEFO y devoluciones auditadas activas.'))
    .catch(error => { require('../src/utils/safeLog')('CORE_U039_SETUP', error); console.error(error.code ? 'No se pudo preparar U039. Revisa conexión, permisos y docs/52_NUCLEO_OPERATIVO_U039.md.' : error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = CoreSetup;
