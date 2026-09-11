/** Coordina los avisos y el estado de carga del módulo mediante el presentador Message. */
(() => {
  'use strict';

  /** Controla los mensajes del módulo sin conocer sus futuras operaciones de negocio. */
  class ModuleLayout {
    constructor(element) {
      this.element = element;
      this.id = element.dataset.moduleLayout;
      this.content = element.querySelector('[data-module-region="content"]');
      this.status = element.querySelector('[data-module-status]');
      this.statusText = element.querySelector('[data-module-status-text]');
      this.error = element.querySelector('[data-module-error]');
      this.errorText = element.querySelector('[data-module-error-text]');
      this.statusMessage = new window.ParisUI.Message(this.status, { text: this.statusText, icons: element.querySelectorAll('[data-message-icon]') });
      this.errorMessage = new window.ParisUI.Message(this.error, { text: this.errorText, icons: [] });
      this.defaultMessage = this.statusText.textContent;
      this.defaults = { ...window.ParisUI.Message.defaults, info: this.defaultMessage };
    }

    clearMessage() {
      this.statusMessage.clear();
      this.errorMessage.clear();
      this.content.setAttribute('aria-busy', 'false');
    }

    /** Usa texto plano; los errores se anuncian en una región accesible separada. */
    showMessage(kind = 'info', message) {
      if (!Object.hasOwn(this.defaults, kind)) throw new TypeError('Tipo de mensaje no válido.');
      const text = typeof message === 'string' && message.trim() ? message : this.defaults[kind];
      this.clearMessage();
      this.content.setAttribute('aria-busy', String(kind === 'loading'));
      if (kind === 'error') {
        this.errorMessage.show('error', text);
        return;
      }
      this.statusMessage.show(kind, text);
    }

    resetMessage() { this.showMessage('info', this.defaultMessage); }

    /** Conserva la interfaz pública documentada y el contexto de cada método. */
    getApi() {
      return Object.freeze({
        id: this.id,
        showMessage: this.showMessage.bind(this),
        clearMessage: this.clearMessage.bind(this),
        resetMessage: this.resetMessage.bind(this)
      });
    }
  }

  window.ParisUI.ModuleLayout = ModuleLayout;
  const element = document.querySelector('[data-module-layout]');
  if (element) window.ParisModule = new ModuleLayout(element).getApi();
})();
