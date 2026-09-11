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
      this.defaultMessage = this.statusText.textContent;
      this.defaults = {
        info: this.defaultMessage,
        loading: 'Cargando…',
        success: 'Operación completada.',
        warning: 'Revisa la información antes de continuar.',
        error: 'No se pudo completar la acción. Inténtalo nuevamente.',
        empty: 'No hay registros para mostrar.'
      };
    }

    clearMessage() {
      this.status.hidden = true;
      this.error.hidden = true;
      this.statusText.textContent = '';
      this.errorText.textContent = '';
      this.content.setAttribute('aria-busy', 'false');
    }

    /** Usa texto plano; los errores se anuncian en una región accesible separada. */
    showMessage(kind = 'info', message) {
      if (!Object.hasOwn(this.defaults, kind)) throw new TypeError('Tipo de mensaje no válido.');
      const text = typeof message === 'string' && message.trim() ? message : this.defaults[kind];
      this.clearMessage();
      this.content.setAttribute('aria-busy', String(kind === 'loading'));
      if (kind === 'error') {
        this.error.hidden = false;
        this.errorText.textContent = text;
        return;
      }
      this.status.dataset.kind = kind;
      this.element.querySelectorAll('[data-message-icon]').forEach(icon => { icon.hidden = icon.dataset.messageIcon !== kind; });
      this.status.hidden = false;
      this.statusText.textContent = text;
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

  const element = document.querySelector('[data-module-layout]');
  if (element) window.ParisModule = new ModuleLayout(element).getApi();
})();
