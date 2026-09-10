const database = require('../config/database');

class AuthRepository {
  async findByUsername(username) {
    const [rows] = await database.getPool().query(
      'SELECT u.id_usuario, u.id_rol, u.nombre, u.apellido, u.nombre_usuario, u.contrasena, u.estado, r.nombre AS rol FROM usuario u INNER JOIN rol r ON r.id_rol = u.id_rol WHERE u.nombre_usuario = ? LIMIT 1',
      [username]
    );

    return rows[0] || null;
  }

  async findById(idUsuario) {
    const [rows] = await database.getPool().query(
      'SELECT u.id_usuario, u.id_rol, u.nombre, u.apellido, u.nombre_usuario, u.estado, r.nombre AS rol FROM usuario u INNER JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? LIMIT 1',
      [idUsuario]
    );

    return rows[0] || null;
  }
}

module.exports = AuthRepository;
