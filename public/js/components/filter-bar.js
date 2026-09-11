/**
 * Conecta el buscador del módulo con filtros configurables, chips y limpieza.
 * Reutiliza Modal, FormController, DateRange y SearchSelect; solo comunica una consulta al módulo.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class FilterBar {
    constructor({ container, searchInput, filterButton, fields = [], value = {}, debounce = 250, onChange } = {}) {
      if (!(container instanceof HTMLElement) || !(searchInput instanceof HTMLInputElement) ||
          !(filterButton instanceof HTMLButtonElement) || typeof onChange !== 'function' || !Array.isArray(fields)) {
        throw new TypeError('El buscador necesita sus controles y una función de consulta.');
      }
      if (fields.some(field => !field.name || field.name === 'term' || !field.label || !['select', 'search', 'dates'].includes(field.type)) ||
          new Set(fields.map(field => field.name)).size !== fields.length) throw new TypeError('Filtros no válidos o repetidos.');
      Object.assign(this, { container, searchInput, filterButton, fields, debounce, onChange });
      this.events = new AbortController(); this.labels = new Map(); this.value = {};
      this.summary = UI.element('div', 'app-filter-summary');
      this.summary.setAttribute('role', 'group'); this.summary.setAttribute('aria-label', 'Filtros activos'); container.append(this.summary);
      this.status = UI.element('p', 'app-sr-only'); this.status.setAttribute('role', 'status'); container.append(this.status);
      this.setValue(value, false);
      const options = { signal: this.events.signal };
      searchInput.addEventListener('input', () => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.value.term = searchInput.value.trim(); this.renderSummary(); this.emit();
        }, debounce);
      }, options);
      searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); this.flushSearch(); this.emit(); }
      }, options);
      filterButton.addEventListener('click', () => this.open(), options);
    }
    getValue() { return structuredClone(this.value); }
    setValue(value = {}, notify = true) {
      window.clearTimeout(this.timer);
      this.value = { term: String(value.term || '') };
      for (const field of this.fields) {
        this.value[field.name] = field.type === 'dates' ? { from: value[field.name]?.from || '', to: value[field.name]?.to || '' } : String(value[field.name] || '');
      }
      this.searchInput.value = this.value.term; this.renderSummary();
      return notify ? this.emit() : Promise.resolve();
    }
    flushSearch() { window.clearTimeout(this.timer); this.value.term = this.searchInput.value.trim(); this.renderSummary(); }
    async emit() {
      if (this.destroyed) return;
      try { await this.onChange(this.getValue()); }
      catch (_) { window.ParisModule?.showMessage('error', 'No se pudieron aplicar los filtros. Inténtalo nuevamente.'); }
    }
    activeEntries() {
      const entries = this.value.term ? [{ key: 'term', label: 'Buscar', text: this.value.term }] : [];
      for (const field of this.fields) {
        const value = this.value[field.name];
        if (field.type === 'dates') {
          if (value.from || value.to) entries.push({ key: field.name, label: field.label,
            text: (value.from || 'Sin inicio') + ' — ' + (value.to || 'Sin fin') });
        } else if (value) {
          const option = field.options?.find(item => String(item.value) === value);
          entries.push({ key: field.name, label: field.label, text: this.labels.get(field.name + ':' + value) || option?.label || value });
        }
      }
      return entries;
    }
    renderSummary() {
      this.summary.replaceChildren();
      const entries = this.activeEntries();
      this.status.textContent = entries.length ? entries.length + ' filtros activos.' : 'Sin filtros activos.';
      for (const item of entries) {
        const button = UI.Button.create({ label: item.label + ': ' + item.text, icon: 'close' });
        button.setAttribute('aria-label', 'Quitar filtro ' + item.label + ': ' + item.text);
        button.addEventListener('click', () => {
          const query = this.getValue(); query[item.key] = this.fields.find(field => field.name === item.key)?.type === 'dates' ? {} : '';
          this.setValue(query); this.searchInput.focus();
        }, { once: true });
        this.summary.append(button);
      }
      if (entries.length) {
        const clear = UI.Button.create({ label: 'Limpiar filtros' });
        clear.addEventListener('click', () => { this.setValue({}); this.searchInput.focus(); }, { once: true });
        this.summary.append(clear);
      }
    }
    open() {
      if (this.destroyed || this.modal?.element.open) return;
      const previousTerm = this.value.term;
      this.flushSearch();
      if (previousTerm !== this.value.term) this.emit();
      const form = UI.element('form', 'app-form'); form.id = 'paris-filters-' + (++sequence);
      const controls = new Map(), enhanced = [];
      for (const field of this.fields) {
        const host = UI.element('div', 'app-field'); form.append(host);
        if (field.type === 'dates') {
          const range = new UI.DateRange({ container: host, name: field.name, label: field.label, value: this.value[field.name], showError: false });
          controls.set(field.name, range); enhanced.push(range);
          continue;
        }
        const label = UI.element('label', 'app-label', field.label), select = UI.element('select', 'app-input');
        select.name = field.name; select.id = label.htmlFor = form.id + '-' + field.name;
        const options = [{ value: '', label: 'Todos' }, ...(field.options || [])];
        const current = this.value[field.name];
        if (current && !options.some(item => String(item.value) === current)) {
          options.push({ value: current, label: this.labels.get(field.name + ':' + current) || current });
        }
        for (const item of options) { const option = UI.element('option', '', item.label); option.value = String(item.value); select.append(option); }
        select.value = current; host.append(label, select); controls.set(field.name, select);
        if (field.type === 'search') enhanced.push(new UI.SearchSelect({ select, load: field.load, pageSize: field.pageSize || 20 }));
      }
      let controller;
      const modal = this.modal = new UI.Modal({ title: 'Filtros', content: form,
        isDirty: () => controller?.isDirty(),
        onClose: () => { controller?.destroy(); enhanced.forEach(control => control.destroy()); modal.destroy(); this.modal = null; }
      });
      const cancel = UI.Button.create({ label: 'Cancelar' });
      cancel.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      const apply = UI.Button.create({ label: 'Aplicar filtros', variant: 'primary', type: 'submit' }); apply.setAttribute('form', form.id);
      modal.footer.append(cancel, apply); modal.open(this.filterButton);
      controller = new UI.FormController({ form, modal,
        onSubmit: async () => {
          const value = { term: this.value.term };
          for (const [name, control] of controls) {
            value[name] = control instanceof UI.DateRange ? control.getValue() : control.value;
            if (control instanceof HTMLSelectElement && control.value) this.labels.set(name + ':' + control.value, control.selectedOptions[0].textContent);
          }
          return value;
        },
        onSuccess: value => { modal.close(); return this.setValue(value); }
      });
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; window.clearTimeout(this.timer); this.events.abort(); this.modal?.destroy(); this.summary.remove(); this.status.remove();
    }
  }
  UI.FilterBar = FilterBar;
})();
