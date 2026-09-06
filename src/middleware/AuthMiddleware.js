class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
    this.requireAuth = this.requireAuth.bind(this);
  }

  async requireAuth(req, res, next) {
    try {
      const idUsuario = req.session?.usuario?.idUsuario;

      if (!idUsuario) {
        return res.status(401).json({
          error: 'Debe iniciar sesion'
        });
      }

      const usuario = await this.authService.getAuthenticatedUser(idUsuario);

      if (!usuario) {
        req.session.destroy(() => {});

        return res.status(401).json({
          error: 'Sesion no valida'
        });
      }

      req.authUser = usuario;

      req.session.usuario = {
        idUsuario: usuario.idUsuario,
        idRol: usuario.idRol,
        rol: usuario.rol
      };

      return next();
    } catch (error) {
      console.error('Error verificando autenticacion:', error.message);

      return res.status(500).json({
        error: 'No se pudo verificar la sesion'
      });
    }
  }
}

module.exports = AuthMiddleware;
