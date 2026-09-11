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
    const [rows] = await this.pool.execute("SELECT id FROM app_migration WHERE id = ?", ['U004']);
    if (rows.length !== 1) throw new Error('MIGRACION_U004_REQUERIDA');
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
