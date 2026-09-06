class AuthController {
  constructor(authService) {
    this.authService = authService;

    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.me = this.me.bind(this);
  }

  async login(req, res) {
    try {
      const { nombre_usuario, contrasena } = req.body;

      const usuario = await this.authService.authenticate(
        nombre_usuario,
        contrasena
      );

      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) return reject(error);
          resolve();
        });
      });

      req.session.usuario = {
        idUsuario: usuario.idUsuario,
        idRol: usuario.idRol,
        rol: usuario.rol
      };

      await new Promise((resolve, reject) => {
        req.session.save((error) => {
          if (error) return reject(error);
          resolve();
        });
      });

      return res.status(200).json({
        message: 'Inicio de sesion correcto',
        usuario
      });
    } catch (error) {
      if (
        error.message === 'CREDENCIALES_INVALIDAS' ||
        error.message === 'USUARIO_INACTIVO'
      ) {
        return res.status(401).json({
          error: 'Usuario o contrasena incorrectos'
        });
      }

      console.error('Error durante el inicio de sesion:', error.message);

      return res.status(500).json({
        error: 'No se pudo iniciar sesion'
      });
    }
  }

  me(req, res) {
    return res.status(200).json({
      autenticado: true,
      usuario: req.authUser
    });
  }
  logout(req, res) {
    req.session.destroy((error) => {
      if (error) {
        console.error('Error cerrando sesion:', error.message);

        return res.status(500).json({
          error: 'No se pudo cerrar la sesion'
        });
      }

      res.clearCookie('paris.sid');

      return res.status(200).json({
        message: 'Sesion cerrada correctamente'
      });
    });
  }
}

module.exports = AuthController;
