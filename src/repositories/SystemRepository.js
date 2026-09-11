/** Comprueba disponibilidad de MySQL con una consulta mínima, sin leer registros del negocio. */
const database = require("../config/database");

class SystemRepository {
  async checkDatabaseConnection() {
    await database.getPool().query("SELECT 1 AS ok");
    return true;
  }
}

module.exports = SystemRepository;
