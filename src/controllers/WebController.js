class WebController {
  constructor(licenseService, activationService) {
    this.licenseService = licenseService;
    this.activationService = activationService;

    this.home = this.home.bind(this);
    this.login = this.login.bind(this);
    this.activation = this.activation.bind(this);
    this.inicio = this.inicio.bind(this);
  }

  home(req, res) {
    const license = this.licenseService.getStatus();
    const activation = this.activationService.getStatus();

    if (license.valida === true && activation.activada === true) {
      return res.redirect("/login");
    }

    return res.redirect("/activar");
  }

  login(req, res) {
    const license = this.licenseService.getStatus();
    const activation = this.activationService.getStatus();

    if (license.valida !== true || activation.activada !== true) {
      return res.redirect("/activar");
    }

    return res.render("auth/login", { title: "Iniciar sesion" });
  }

  activation(req, res) {
    const license = this.licenseService.getStatus();
    const activation = this.activationService.getStatus();

    if (license.valida === true && activation.activada === true) {
      return res.redirect("/login");
    }

    return res.render("auth/activation", {
      title: "Activar equipo",
      license,
      activation
    });
  }

  inicio(req, res) {
    return res.render("auth/inicio", {
      title: "Acceso autorizado",
      usuario: req.authUser
    });
  }
}

module.exports = WebController;
