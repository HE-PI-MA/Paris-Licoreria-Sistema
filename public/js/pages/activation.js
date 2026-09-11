/** Especializa el formulario común con el código y los mensajes de licencia. */
(() => {
  'use strict';

  class ActivationPage extends window.ParisUI.AuthForm {
    constructor(form) {
      super({
        form,
        submit: document.querySelector('[data-activation-submit]'),
        errorBox: document.querySelector('[data-activation-error]'),
        successBox: document.querySelector('[data-activation-success]'),
        endpoint: '/api/licencia/activar',
        busyText: 'Activando...',
        successText: 'Equipo activado. Abriendo el Login...',
        networkError: 'No fue posible comunicarse con el servidor.',
        destination: '/login', delay: 650
      });
    }

    getPayload() {
      const codigo = this.form.elements.namedItem('codigo').value.trim();
      if (!codigo) {
        this.show(this.errorBox, 'Introduce el codigo de activacion.');
        return null;
      }
      return { codigo };
    }

    getErrorMessage(data) {
      const messages = {
        ACTIVACION_CODIGO_INVALIDO: 'El codigo de activacion no es valido.',
        ACTIVACION_CODIGO_REQUERIDO: 'Introduce el codigo de activacion.',
        LICENCIA_NO_INSTALADA: 'No existe una licencia instalada.',
        LICENCIA_FIRMA_INVALIDA: 'La licencia instalada no es autentica.',
        LICENCIA_EQUIPO_NO_AUTORIZADO: 'La licencia no corresponde a esta computadora.',
        LICENCIA_EXPIRADA: 'La licencia instalada ha expirado.'
      };
      return Object.hasOwn(messages, data?.error) ? messages[data.error] : 'No se pudo completar la activacion.';
    }

    clearSensitiveInput() { this.form.elements.namedItem('codigo').value = ''; }
  }

  const form = document.querySelector('[data-activation-form]');
  if (form) new ActivationPage(form).init();
})();
