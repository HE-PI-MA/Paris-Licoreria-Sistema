/** Comportamiento compartido por login y activación: mensajes, envío y espera. */
(() => {
  'use strict';

  class AuthForm {
    constructor({ form, submit, errorBox, successBox, endpoint, busyText, successText, networkError, destination, delay }) {
      Object.assign(this, { form, submit, errorBox, successBox, endpoint, busyText, successText, networkError, destination, delay });
      this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
      this.submitDefaultHtml = submit.innerHTML;
      this.busy = false;
      this.completed = false;
    }

    init() {
      // La función conserva el objeto al recibir un evento del formulario.
      if (this.initialized) return;
      this.initialized = true;
      this.form.addEventListener('submit', event => this.onSubmit(event));
    }

    show(element, message) {
      element.textContent = message;
      element.hidden = false;
    }

    clearMessages() {
      for (const element of [this.errorBox, this.successBox]) {
        element.textContent = '';
        element.hidden = true;
      }
    }

    /** Cada formulario define sus campos y valida antes de solicitar el envío. */
    getPayload() { throw new Error('El formulario debe implementar getPayload.'); }
    getErrorMessage() { return 'No se pudo completar la operación.'; }
    clearSensitiveInput() {}

    async onSubmit(event) {
      event.preventDefault();
      if (this.busy || this.submit.disabled) return;
      this.clearMessages();
      const payload = this.getPayload();
      if (!payload) return;
      this.busy = true;
      this.submit.disabled = true;
      this.submit.textContent = this.busyText;
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrfToken },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          this.show(this.errorBox, this.getErrorMessage(data));
          return;
        }
        this.completed = true;
        this.clearSensitiveInput();
        this.show(this.successBox, this.successText);
        window.setTimeout(() => window.location.assign(this.destination), this.delay);
      } catch (_) {
        this.show(this.errorBox, this.networkError);
      } finally {
        // Tras un éxito, mantener el bloqueo hasta que termine la redirección.
        if (!this.completed) {
          this.busy = false;
          this.submit.disabled = false;
          // Recupera únicamente el contenido original del botón.
          this.submit.innerHTML = this.submitDefaultHtml;
        }
      }
    }
  }

  window.ParisUI = window.ParisUI || {};
  window.ParisUI.AuthForm = AuthForm;
})();
