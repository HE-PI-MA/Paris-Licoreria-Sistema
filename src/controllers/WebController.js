const navigation = require('../config/navigation');
const moduleLayouts = require('../config/module-layouts');

/** Renderiza las páginas; la licencia y la sesión se exigen en web.routes.js. */
class WebController {
  constructor(activationService) {
    this.activationService = activationService;
    for (const name of ['home', 'login', 'activation', 'inicio', 'perfil']) {
      this[name] = this[name].bind(this);
    }
  }

  async home(req, res) {
    const status = await this.activationService.getSystemStatus();
    return res.redirect(status.accesoSistema ? '/login' : '/activar');
  }

  async login(req, res) {
    const status = await this.activationService.getSystemStatus();
    if (!status.accesoSistema) return res.redirect('/activar');
    req.csrfToken();
    return res.render('auth/login', {
      title: 'Iniciar sesion',
      sesionVencida: req.query.sesion === 'vencida'
    });
  }

  async activation(req, res) {
    const status = await this.activationService.getSystemStatus();
    if (status.accesoSistema) return res.redirect('/login');
    req.csrfToken();
    return res.render('auth/activation', {
      title: 'Activar equipo',
      license: status.licencia,
      activation: status.activacion
    });
  }

  inicio(req, res) {
    return this.renderWorkspace(req, res, navigation.modules[0]);
  }

  perfil(req, res) {
    return this.renderWorkspace(req, res, {
      id: 'perfil', label: 'Mi perfil', icon: 'user'
    });
  }

  /**
   * Compone sidebar, perfil y contenido usando el usuario revalidado en MySQL.
   * page procede de la configuración del servidor, nunca de una ruta de vista
   * enviada por el navegador. status permite conservar el layout en un HTTP 403.
   */
  renderWorkspace(req, res, page, status = 200) {
    req.csrfToken();
    const usuario = req.authUser;
    const nameParts = [usuario.nombre, usuario.apellido]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const initials = nameParts
      .map(part => Array.from(part)[0])
      .join('').slice(0, 2).toUpperCase() || 'U';

    return res.status(status).render('layouts/workspace', {
      title: page.label,
      page,
      usuario,
      moduleUi: moduleLayouts.forPage(page),
      navigation: navigation.forUser(usuario.rol),
      profile: {
        name: nameParts.join(' ') || usuario.nombreUsuario,
        initials,
        role: navigation.roleLabel(usuario.rol)
      }
    });
  }
}

module.exports = WebController;
