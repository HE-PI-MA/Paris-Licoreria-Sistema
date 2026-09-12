/**
 * Conecta el buscador con selectores directos o filtros en un modal.
 * El modo directo conserva búsqueda, paginación remota de opciones y errores reintentables.
 * Reutiliza Modal, FormController, DateRange y SearchSelect; solo comunica una consulta al módulo.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class FilterBar {
    constructor({ container, searchInput, filterButton, fields = [], value = {}, debounce = 250, mode = 'modal', onChange } = {}) {
      if (!(container instanceof HTMLElement) || !(searchInput instanceof HTMLInputElement) ||
          !['modal', 'inline'].includes(mode) || (mode === 'modal' && !(filterButton instanceof HTMLButtonElement)) || typeof onChange !== 'function' || !Array.isArray(fields)) {
        throw new TypeError('El buscador necesita sus controles y una función de consulta.');
      }
      if (fields.some(field => !field.name || field.name === 'term' || !field.label || !['select', 'search', 'dates'].includes(field.type)) ||
          new Set(fields.map(field => field.name)).size !== fields.length) throw new TypeError('Filtros no válidos o repetidos.');
      if (mode === 'inline' && fields.some(field => field.type !== 'select' || !(field.control instanceof HTMLSelectElement) ||
          (field.load !== undefined && typeof field.load !== 'function'))) throw new TypeError('El modo directo necesita selectores nativos.');
      Object.assign(this, { container, searchInput, filterButton, fields, debounce, onChange, mode });
      this.inline = new Map();
      this.events = new AbortController(); this.labels = new Map(); this.value = {};
      this.summary = UI.element('div', 'app-filter-summary');
      this.summary.setAttribute('role', 'group'); this.summary.setAttribute('aria-label', 'Filtros activos'); if (mode === 'modal') container.append(this.summary);
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
      if (mode === 'modal') filterButton.addEventListener('click', () => this.open(), options);
      this.ready = mode === 'inline' ? Promise.all(fields.map(field => this.bindInline(field))) : Promise.resolve();
    }
    getValue() { return structuredClone(this.value); }
    setValue(value = {}, notify = true) {
      window.clearTimeout(this.timer);
      this.value = { term: String(value.term || '') };
      for (const field of this.fields) {
        this.value[field.name] = field.type === 'dates' ? { from: value[field.name]?.from || '', to: value[field.name]?.to || '' } : String(value[field.name] || '');
      }
      this.searchInput.value = this.value.term;
      if (this.mode === 'inline') for (const field of this.fields) { field.control.value = this.value[field.name]; this.inline.get(field.name)?.enhanced.syncLabel(); }
      this.renderSummary();
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
      if (this.mode === 'inline') return;
      for (const item of entries) {
        const button = UI.Button.create({ label: item.label + ': ' + item.text, icon: 'close' });
        button.setAttribute('aria-label', 'Quitar filtro ' + item.label + ': ' + item.text);
        button.addEventListener('click', () => {
          // Conservar la escritura reciente aunque todavía no termine la espera del buscador.
          this.flushSearch();
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
    /** Instala una sola escucha por selector. Las opciones remotas se cargan fuera del renderizado del servidor. */
    bindInline(field) {
      const select = field.control;
      const feedback = UI.element('div', 'app-filter-feedback'); feedback.hidden = true;
      const message = UI.Message.create(feedback);
      const retry = UI.Button.create({ label: 'Reintentar ' + field.label.toLocaleLowerCase('es') });
      feedback.append(retry); this.container.append(feedback);
      this.inline.set(field.name, { feedback, message, retry, enhanced: new UI.SearchSelect({ select, searchable: false, popup: true, pageSize: 100 }), disabled: select.disabled, busy: select.getAttribute('aria-busy'),
        options: Array.from(select.options, option => option.cloneNode(true)) });
      select.addEventListener('change', () => {
        this.flushSearch(); this.value[field.name] = select.value;
        this.renderSummary(); this.emit();
      }, { signal: this.events.signal });
      retry.addEventListener('click', () => this.loadInline(field), { signal: this.events.signal });
      return this.loadInline(field);
    }
    /** Reúne todas las páginas antes de reemplazar las opciones; nunca muestra un catálogo incompleto como si estuviera completo. */
    async loadInline(field) {
      const entry = this.inline.get(field.name), select = field.control;
      if (this.destroyed || entry.loading) return;
      entry.loading = true; select.disabled = true; select.setAttribute('aria-busy', 'true');
      const restoreFocus = document.activeElement === entry.retry;
      UI.Button.setBusy(entry.retry, true, 'Cargando…');
      try {
        const items = [], seen = new Set();
        let page = 1, total;
        do {
          const result = field.load ? await field.load({ page, pageSize: 100, term: '', signal: this.events.signal }) :
            { options: field.options || [], total: (field.options || []).length };
          if (this.destroyed) return;
          if (!Array.isArray(result.options) || !Number.isSafeInteger(result.total) || result.total < 0 ||
              (total !== undefined && total !== result.total)) throw new Error('El catálogo cambió durante la consulta.');
          total = result.total;
          for (const item of result.options) {
            const value = String(item.value ?? '');
            if (!value || seen.has(value) || typeof item.label !== 'string') throw new Error('Opciones no válidas.');
            seen.add(value); items.push({ value, label: item.label });
          }
          if (items.length > total || (!result.options.length && items.length < total)) throw new Error('Catálogo incompleto.');
          page++;
        } while (items.length < total);
        const options = [ { value: '', label: field.emptyLabel || 'Todos' }, ...items ].map(item => {
          const option = UI.element('option', '', item.label); option.value = item.value; return option;
        });
        select.replaceChildren(...options);
        select.value = this.value[field.name];
        // Si una categoría seleccionada ya no existe, se conserva el filtro hasta que el usuario lo cambie.
        if (this.value[field.name] && !seen.has(this.value[field.name])) {
          const retained = UI.element('option', '', 'Categoría seleccionada (no disponible)'); retained.value = this.value[field.name];
          select.append(retained); select.value = retained.value;
        }
        entry.message.clear(); entry.feedback.hidden = true; select.disabled = entry.disabled;
        entry.enhanced.syncOptions(); entry.enhanced.syncDisabled();
        if (restoreFocus) entry.enhanced.input.focus();
      } catch (error) {
        if (this.destroyed || error.name === 'AbortError') return;
        entry.feedback.hidden = false;
        entry.message.show('error', 'No se pudo cargar ' + field.label.toLocaleLowerCase('es') + '. Puedes seguir buscando o reintentar.');
      } finally {
        entry.loading = false;
        if (!this.destroyed) { select.removeAttribute('aria-busy'); UI.Button.setBusy(entry.retry, false); }
      }
    }
    open() {
      if (this.destroyed || this.mode === 'inline' || this.modal?.element.open) return;
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
      for (const field of this.fields) {
        const entry = this.inline.get(field.name); if (!entry) continue;
        entry.enhanced.destroy();
        field.control.disabled = entry.disabled;
        if (entry.busy === null) field.control.removeAttribute('aria-busy'); else field.control.setAttribute('aria-busy', entry.busy);
        field.control.replaceChildren(...entry.options); entry.feedback.remove();
      }
      this.inline.clear();
    }
  }
  UI.FilterBar = FilterBar;
})();
