/** Autentica con bcrypt y obtiene la identidad pública actualizada; nunca devuelve el hash al cliente. */
const bcrypt = require('bcrypt');

class AuthService {
  // Hash ficticio con el coste del alta: evita omitir bcrypt si el usuario no existe.
  static DUMMY_HASH = '$2b$12$lUI4RlPoYTNxMLCWDIItUOaq0FNuJLxbm9MmFOdbD19KNONuEoa0C';

  constructor(authRepository, { hasher = bcrypt } = {}) {
    this.hasher = hasher;
    this.authRepository = authRepository;
  }

  async authenticate(username, password) {
    // bcrypt utiliza hasta 72 bytes, que no equivalen a 72 caracteres Unicode.
    if (typeof username !== 'string' || typeof password !== 'string' ||
        username.length > 50 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }
    const normalizedUsername = username.trim();
    const plainPassword = password;

    if (!normalizedUsername || !plainPassword) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }

    const usuario = await this.authRepository.findByUsername(normalizedUsername);

    const passwordValida = await this.hasher.compare(plainPassword, usuario?.contrasena || AuthService.DUMMY_HASH);
    if (!usuario || usuario.estado !== 'ACTIVO' || !passwordValida) throw new Error('CREDENCIALES_INVALIDAS');

    return this.toPublicUser(usuario);
  }

  /** Una sola conversión pública para login y revalidación; excluye el hash. */
  toPublicUser(usuario) {
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

    return this.toPublicUser(usuario);
  }
}

module.exports = AuthService;
