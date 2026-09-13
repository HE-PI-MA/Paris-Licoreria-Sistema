/** Formulario compartido de catálogos: campos, modal, validación, bloqueo de envío y aviso de cambios pendientes. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class CatalogForm {
    constructor({ title, icon, api, record, onSaved, opener }) {
      Object.assign(this, { api, record, onSaved, opener }); this.selectors = [];
      this.form = UI.element('form', 'app-form'); this.form.autocomplete = 'off'; this.form.id = 'catalog-form-' + (++sequence);
      this.grid = UI.element('div', 'app-form-grid'); this.form.append(this.grid);
      this.modal = new UI.Modal({ title, icon, content: this.form, isDirty: () => this.controller?.isDirty(),
        onClose: () => { this.controller?.destroy(); this.selectors.forEach(item => item.destroy()); this.modal.destroy(); }
      });
    }
    field(name, labelText, { type = 'text', value = '', required = false, maxLength, min, max, step, help, wide = false, options, uppercase = ['name', 'description'].includes(name), pattern, inputMode } = {}) {
      const host = UI.element('div', 'app-field' + (wide ? ' app-field--wide' : ''));
      const label = UI.element('label', 'app-label', labelText + (required ? ' *' : ''));
      const input = UI.element(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input', 'app-input');
      if (input instanceof HTMLInputElement) input.type = type;
      // El catálogo usa las sugerencias de SearchSelect, no el historial del navegador.
      input.autocomplete = 'off'; input.spellcheck = false;
      input.id = label.htmlFor = this.form.id + '-' + name; input.name = name; input.required = required;
      for (const [key, item] of Object.entries({ maxLength, min, max, step, pattern, inputMode })) if (item !== undefined) input[key] = item;
      if (type === 'textarea') input.rows = 3;
      for (const item of options || []) { const option = UI.element('option', '', item.label); option.value = item.value; input.append(option); }
      // Nombres y descripciones se guardan en mayúsculas al editarlos; los códigos se conservan exactos.
      if (uppercase) input.dataset.uppercase = '';
      input.value = value ?? '';
      host.append(label, input);
      if (help) { const text = UI.element('p', 'app-field-help', help); text.id = input.id + '-help'; input.setAttribute('aria-describedby', text.id); host.append(text); }
      this.grid.append(host); return input;
    }
    /** Estado utiliza el selector global sin búsqueda; el select original conserva validación y FormData. */
    state(value = 'ACTIVO') {
      const select = this.field('state', 'Estado', { type: 'select', value, required: true,
        options: [{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }] });
      this.selectors.push(new UI.SearchSelect({ select, searchable: false }));
      return select;
    }
    selector(name, label, kind, selected, help) {
      const input = this.field(name, label, { type: 'select', required: true, help, options: [{ value: '', label: 'Seleccionar' }] });
      const enhanced = new UI.SearchSelect({ select: input, load: params => this.api.options(kind, params) });
      if (selected) enhanced.setValue(selected);
      this.selectors.push(enhanced); return input;
    }
    start(path, payload) {
      const cancel = UI.Button.create({ label: 'Cancelar' });
      cancel.addEventListener('click', () => this.modal.requestClose(), { signal: this.modal.events.signal });
      const save = UI.Button.create({ label: 'Guardar', icon: 'success', variant: 'primary', type: 'submit' }); save.setAttribute('form', this.form.id);
      this.modal.footer.append(cancel, save);
      const send = this.api.operation(path);
      this.controller = new UI.FormController({ form: this.form, modal: this.modal,
        onSubmit: (values, options) => send(payload(values), options),
        onSuccess: async result => { this.modal.close(); await this.onSaved(result); }
      });
      this.modal.open(this.opener);
      this.form.querySelector('[name="name"]').focus();
    }
  }
  UI.CatalogForm = CatalogForm;
})();
