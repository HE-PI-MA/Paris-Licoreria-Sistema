const database = require("../config/database");

class SystemRepository {
  async checkDatabaseConnection() {
    await database.getPool().query("SELECT 1 AS ok");
    return true;
  }
}

module.exports = SystemRepository;
