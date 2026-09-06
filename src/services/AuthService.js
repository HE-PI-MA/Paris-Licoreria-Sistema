const bcrypt = require('bcrypt');

class AuthService {
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  async authenticate(username, password) {
    const normalizedUsername = String(username || '').trim();
    const plainPassword = String(password || '');

    if (!normalizedUsername || !plainPassword) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }

    const usuario = await this.authRepository.findByUsername(normalizedUsername);

    if (!usuario) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new Error('USUARIO_INACTIVO');
    }

    const passwordValida = await bcrypt.compare(plainPassword, usuario.contrasena);

    if (!passwordValida) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }

    return {
      idUsuario: usuario.id_usuario,
      idRol: usuario.id_rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      nombreUsuario: usuario.nombre_usuario,
      rol: usuario.rol
    };
  }

  async getAuthenticatedUser(idUsuario) {
    const usuario = await this.authRepository.findById(idUsuario);

    if (!usuario || usuario.estado !== 'ACTIVO') {
      return null;
    }

    return {
      idUsuario: usuario.id_usuario,
      idRol: usuario.id_rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      nombreUsuario: usuario.nombre_usuario,
      rol: usuario.rol
    };
  }
}

module.exports = AuthService;
