class WebController {
  constructor(licenseService, activationService) {
    Object.assign(this, { licenseService, activationService });
    for (const name of ['home', 'login', 'activation', 'inicio']) this[name] = this[name].bind(this);
  }
  async home(req, res) {
    const status = await this.activationService.getSystemStatus();
    return res.redirect(status.accesoSistema ? '/login' : '/activar');
  }
  async login(req, res) {
    const status = await this.activationService.getSystemStatus();
    if (!status.accesoSistema) return res.redirect('/activar');
    req.csrfToken();
    return res.render('auth/login', { title: 'Iniciar sesion', sesionVencida: req.query.sesion === 'vencida' });
  }
  async activation(req, res) {
    const status = await this.activationService.getSystemStatus();
    if (status.accesoSistema) return res.redirect('/login');
    req.csrfToken();
    return res.render('auth/activation', { title: 'Activar equipo', license: status.licencia, activation: status.activacion });
  }
  inicio(req, res) {
    req.csrfToken();
    return res.render('auth/inicio', { title: 'Acceso autorizado', usuario: req.authUser });
  }
}
module.exports = WebController;
