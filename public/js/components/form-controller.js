/**
 * Controla formularios de módulos: validación por campo, cambios pendientes y envío único.
 * La función onSubmit pertenece al módulo; esta clase no conoce rutas ni escribe datos.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;

  class FormController {
    constructor({ form, onSubmit, onSuccess = () => {}, validate = () => ({}), alert, modal } = {}) {
      if (!(form instanceof HTMLFormElement) || typeof onSubmit !== 'function') {
        throw new TypeError('Se requiere un formulario y una función de envío.');
      }
      Object.assign(this, { form, onSubmit, onSuccess, validate, modal });
      this.events = new AbortController();
      this.errors = new Map();
      this.busy = false;
      this.destroyed = false;
      this.originalNoValidate = form.noValidate;
      form.noValidate = true;
      this.alert = alert || UI.Message.create(form);
      this.ownsAlert = !alert;
      this.submitHandler = event => { event.preventDefault(); this.submit(); };
      form.addEventListener('submit', this.submitHandler, { signal: this.events.signal });
      form.addEventListener('input', event => this.clearFieldError(event.target.name), { signal: this.events.signal });
      form.addEventListener('change', event => this.clearFieldError(event.target.name), { signal: this.events.signal });
      this.markPristine();
    }

    getValues() { return Object.fromEntries(new FormData(this.form)); }

    snapshot() {
      return JSON.stringify(Array.from(new FormData(this.form), ([key, value]) => [
        key, typeof value === 'string' ? value : [value.name, value.size, value.lastModified]
      ]));
    }

    markPristine() { this.initial = this.snapshot(); }
    isDirty() { return this.snapshot() !== this.initial; }

    fields(name) {
      // Un selector con búsqueda conserva la validación del select y presenta el error en el cuadro visible.
      return Array.from(this.form.elements).filter(field => field.name === name && field.matches('input, select, textarea'))
        .flatMap(field => { const enhanced = UI.SearchSelect?.controls.get(field); return enhanced ? [enhanced.input, field] : [field]; });
    }

    clearFieldError(name) {
      const error = this.errors.get(name);
      if (!error) return;
      for (const state of error.fields) {
        for (const [attr, value] of [['aria-describedby', state.description], ['aria-invalid', state.invalid]]) {
          if (value === null) state.field.removeAttribute(attr);
          else state.field.setAttribute(attr, value);
        }
      }
      error.node.remove();
      this.errors.delete(name);
    }

    clearErrors() {
      for (const name of this.errors.keys()) this.clearFieldError(name);
      this.alert.clear();
    }

    /** Las ayudas originales se conservan en aria-describedby al añadir un error. */
    setErrors(errors = {}) {
      for (const [name, text] of Object.entries(errors)) {
        const fields = this.fields(name);
        if (!fields.length || !text) continue;
        this.clearFieldError(name);
        const node = UI.element('p', 'app-field-error', text);
        node.id = 'paris-field-error-' + (++sequence);
        const states = fields.map(field => ({
          field, description: field.getAttribute('aria-describedby'), invalid: field.getAttribute('aria-invalid')
        }));
        for (const state of states) {
          state.field.setAttribute('aria-invalid', 'true');
          state.field.setAttribute('aria-describedby', [state.description, node.id].filter(Boolean).join(' '));
        }
        const host = fields[0].closest('.app-field');
        if (host) host.append(node);
        else fields[0].insertAdjacentElement('afterend', node);
        this.errors.set(name, { node, fields: states });
      }
      if (this.errors.size) {
        this.alert.show('error', 'Revisa los campos señalados antes de guardar.');
        this.errors.values().next().value.fields[0].field.focus();
      }
    }

    validationErrors(values) {
      const errors = Object.create(null);
      for (const field of Array.from(this.form.elements)) {
        if (!field.name || !field.willValidate || field.validity.valid) continue;
        const v = field.validity;
        errors[field.name] = v.valueMissing ? 'Completa este campo.' :
          v.typeMismatch ? 'Introduce un valor con el formato correcto.' :
          v.rangeUnderflow ? 'El valor mínimo es ' + field.min + '.' :
          v.rangeOverflow ? 'El valor máximo es ' + field.max + '.' :
          v.tooLong ? 'Reduce el texto a ' + field.maxLength + ' caracteres.' :
          v.stepMismatch ? 'Revisa los decimales permitidos.' : 'Revisa el valor de este campo.';
      }
      return Object.assign(errors, this.validate(values) || {});
    }

    /** Congela los campos durante el envío para no perder cambios hechos mientras se guardaba. */
    setBusy(busy) {
      this.busy = busy;
      this.form.setAttribute('aria-busy', String(busy));
      this.modal?.setBusy(busy);
      if (busy) {
        this.disabledBefore = Array.from(this.form.elements).map(field => ({ field, disabled: field.disabled }));
        this.submitButtons = this.disabledBefore.filter(({ field }) => field.type === 'submit').map(({ field }) => field);
        this.submitButtons.forEach(button => UI.Button.setBusy(button, true, 'Guardando…'));
        this.disabledBefore.forEach(({ field }) => { field.disabled = true; });
      } else {
        this.submitButtons?.forEach(button => UI.Button.setBusy(button, false));
        this.disabledBefore?.forEach(({ field, disabled }) => { field.disabled = disabled; });
      }
    }

    async submit() {
      if (this.busy || this.destroyed) return false;
      const buttons = Array.from(this.form.elements).filter(field => field.type === 'submit');
      if (buttons.length && buttons.every(button => button.disabled)) return false;
      this.clearErrors();
      const values = this.getValues();
      this.setErrors(this.validationErrors(values));
      if (this.errors.size) return false;
      this.setBusy(true);
      this.request = new AbortController();
      let result, succeeded = false;
      try {
        result = await this.onSubmit(values, { signal: this.request.signal });
        succeeded = !this.destroyed;
      } catch (error) {
        if (!this.destroyed) {
          this.setErrors(error?.fieldErrors || {});
          if (!this.errors.size) this.alert.show('error', error?.userMessage || 'No se pudo guardar. Revisa la conexión e inténtalo nuevamente.');
        }
      } finally { this.setBusy(false); }
      if (succeeded) {
        this.markPristine();
        try { await this.onSuccess(result, values); }
        catch (_) {
          // El guardado terminó: no invitar al usuario a repetir una operación ya completada.
          window.ParisModule?.showMessage('warning', 'Se guardó la información, pero no se pudo actualizar la vista. Recarga el módulo.');
        }
      }
      return succeeded;
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.request?.abort();
      if (this.busy) this.setBusy(false);
      this.events.abort();
      this.clearErrors();
      if (this.ownsAlert) this.alert.element.remove();
      this.form.noValidate = this.originalNoValidate;
    }
  }
  UI.FormController = FormController;
})();
