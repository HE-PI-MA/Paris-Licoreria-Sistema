/** Rango de fechas sin dependencias: usa controles nativos y valores YYYY-MM-DD, sin convertir zonas horarias. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class DateRange {
    constructor({ container, name = 'dates', label = 'Fechas', value = {}, showError = true, onChange = () => {} } = {}) {
      if (!(container instanceof HTMLElement)) throw new TypeError('El rango necesita un contenedor.');
      this.events = new AbortController(); this.showError = showError;
      this.element = UI.element('fieldset', 'app-date-range');
      this.element.append(UI.element('legend', 'app-label', label));
      this.inputs = {};
      for (const [part, text] of [['from', 'Desde'], ['to', 'Hasta']]) {
        const field = UI.element('div', 'app-field');
        const caption = UI.element('label', 'app-label', text), input = UI.element('input', 'app-input');
        input.type = 'date'; input.name = name + (part === 'from' ? 'From' : 'To');
        input.id = caption.htmlFor = 'paris-date-' + (++sequence);
        field.append(caption, input); this.element.append(field); this.inputs[part] = input;
        input.addEventListener('change', () => { this.validate(); onChange(this.getValue()); }, { signal: this.events.signal });
      }
      this.error = UI.element('p', 'app-field-error');
      this.error.id = 'paris-date-error-' + sequence; this.error.hidden = true;
      for (const input of Object.values(this.inputs)) input.setAttribute('aria-describedby', this.error.id);
      this.element.append(this.error); container.append(this.element); this.setValue(value);
    }
    getValue() { return { from: this.inputs.from.value, to: this.inputs.to.value }; }
    setValue({ from = '', to = '' } = {}) {
      this.inputs.from.value = from; this.inputs.to.value = to; this.validate();
    }
    validate() {
      const { from, to } = this.getValue();
      const message = from && to && from > to ? 'La fecha Hasta debe ser igual o posterior a Desde.' : '';
      this.inputs.to.setCustomValidity(message);
      this.error.textContent = message; this.error.hidden = !message || !this.showError;
      if (this.showError) this.inputs.to.setAttribute('aria-invalid', String(Boolean(message)));
      return !message;
    }
    destroy() { this.events.abort(); this.element.remove(); }
  }
  UI.DateRange = DateRange;
})();
