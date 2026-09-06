const database = require('../config/database');

class SystemRepository {
  async getDatabaseStatus() {
    const [rows] = await database.getPool().query(
      'SELECT DATABASE() AS database_name, VERSION() AS mysql_version, CURRENT_TIMESTAMP AS server_time'
    );

    return rows[0];
  }
}

module.exports = SystemRepository;
