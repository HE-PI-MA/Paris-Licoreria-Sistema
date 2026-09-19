/** Mantiene un único pool MySQL configurado desde el entorno; los repositorios reutilizan sus conexiones. */
const mysql = require('mysql2/promise');

class Database {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 100,
      connectTimeout: 10000,
      charset: 'utf8mb4'
    });
  }

  async assertSchema() {
    const required = ['U004', 'U012', 'U023', 'U030', 'U031', 'U039'];
    const placeholders = required.map(() => '?').join(',');
    const [rows] = await this.pool.query(`SELECT id FROM app_migration WHERE id IN (${placeholders})`, required);
    const found = new Set(rows.map(row => row.id));
    const missing = required.filter(id => !found.has(id));
    if (missing.length) throw new Error('MIGRACIONES_REQUERIDAS:' + missing.join(','));
    // La marca de versión no basta: comprobar los objetos que usan los módulos activos.
    for (const object of ['caja', 'devolucion_pago', 'catalogo_operacion', 'inventario_movimiento', 'producto_imagen',
      'vw_stock_producto', 'vw_ventas_totales', 'vw_efectivo_esperado_sesion', 'vw_diferencias_caja']) {
      await this.pool.query('SELECT * FROM ' + object + ' LIMIT 0');
    }
    const [columns] = await this.pool.query("SELECT table_name AS tableName,column_name AS columnName FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='sesion_caja' AND column_name='id_caja') OR (table_name='venta' AND column_name IN ('fecha_hora_anulacion','id_usuario_anulacion','operacion_clave','solicitud_hash')))");
    if (columns.length !== 5) throw new Error('ESQUEMA_U039_INCOMPLETO');
  }

  getPool() {
    return this.pool;
  }

  async testConnection() {
    const connection = await this.pool.getConnection();
    try {
      await connection.query('SELECT 1');
      return true;
    } finally {
      connection.release();
    }
  }
}

module.exports = new Database();
