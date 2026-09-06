class RoleMiddleware {
  allow(...roles) {
    const rolesPermitidos = roles.map((rol) => String(rol).trim().toUpperCase());

    return (req, res, next) => {
      const rolUsuario = req.authUser?.rol;

      if (!rolUsuario) {
        return res.status(401).json({
          error: 'Debe iniciar sesion'
        });
      }

      if (!rolesPermitidos.includes(String(rolUsuario).toUpperCase())) {
        return res.status(403).json({
          error: 'No tiene permisos para acceder a este recurso'
        });
      }

      return next();
    };
  }
}

module.exports = RoleMiddleware;
