/** Define los campos y las acciones propias de la página de inicio de sesión. */
(() => {
  'use strict';

  class LoginPage extends window.ParisUI.AuthForm {
    constructor(form) {
      super({
        form,
        submit: document.querySelector('[data-login-submit]'),
        errorBox: document.querySelector('[data-login-error]'),
        successBox: document.querySelector('[data-login-success]'),
        endpoint: '/api/auth/login',
        busyText: 'Verificando...',
        successText: 'Inicio de sesion correcto. Redirigiendo...',
        networkError: 'No fue posible comunicarse con el servidor. Intenta nuevamente.',
        destination: '/inicio', delay: 450
      });
      this.password = document.querySelector('#contrasena');
      this.toggle = document.querySelector('[data-password-toggle]');
    }

    init() {
      if (this.initialized) return;
      super.init();
      this.toggle?.addEventListener('click', () => this.togglePassword());
    }

    togglePassword() {
      if (!this.password) return;
      const visible = this.password.type === 'text';
      this.password.type = visible ? 'password' : 'text';
      this.toggle.classList.toggle('is-visible', !visible);
      this.toggle.setAttribute('aria-pressed', String(!visible));
      this.toggle.setAttribute('aria-label', visible ? 'Mostrar contrasena' : 'Ocultar contrasena');
      this.password.focus();
    }

    getPayload() {
      const nombre_usuario = this.form.elements.namedItem('nombre_usuario').value.trim();
      const contrasena = this.form.elements.namedItem('contrasena').value;
      if (!nombre_usuario || !contrasena) {
        this.show(this.errorBox, 'Completa el usuario y la contrasena.');
        return null;
      }
      return { nombre_usuario, contrasena };
    }

    getErrorMessage(data) {
      if (data?.error === 'SISTEMA_NO_ACTIVADO') return 'Este equipo no se encuentra activado.';
      return typeof data?.error === 'string' ? data.error : 'No se pudo iniciar sesion.';
    }

    clearSensitiveInput() { this.form.elements.namedItem('contrasena').value = ''; }
  }

  const form = document.querySelector('[data-login-form]');
  if (form) new LoginPage(form).init();
})();
