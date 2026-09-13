/**
 * Selector con búsqueda local o por páginas del servidor. Conserva el select original para FormData.
 * Los controles con búsqueda sugieren al escribir. Todos los paneles flotan sin desplazar el formulario.
 * searchable=false permite elegir por clic; todos los selectores usan el mismo panel flotante.
 * El cuadro visible controla teclado y foco; las respuestas antiguas se cancelan y nunca pisan la búsqueda actual.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class SearchSelect {
    static controls = new WeakMap();
    constructor({ select, load, pageSize = 20, debounce = 250, searchable = true, allowCustom = false } = {}) {
      if (!(select instanceof HTMLSelectElement) || select.multiple || SearchSelect.controls.has(select)) {
        throw new TypeError('Se necesita un select simple sin inicializar.');
      }
      if ((load !== undefined && typeof load !== 'function') || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new TypeError('Consulta o tamaño de página no válido.');
      }
      Object.assign(this, { select, load, pageSize, debounce, searchable, allowCustom });
      this.events = new AbortController(); this.requestId = 0; this.options = []; this.active = -1;
      this.original = { id: select.id, hidden: select.hidden, tabindex: select.getAttribute('tabindex') };
      this.localOptions = this.readOptions();
      const id = 'paris-select-' + (++sequence);
      this.root = UI.element('div', 'app-search-select' + (!searchable ? ' app-search-select--choice' : ''));
      this.input = UI.element('input', 'app-input');
      this.input.id = select.id || id; select.id = id + '-source';
      this.input.readOnly = !searchable;
      // El alta integrada puede conservar texto libre; el catálogo se crea solo al guardar la operación principal.
      if (allowCustom) { this.input.name = select.name + 'Text'; this.input.dataset.uppercase = ''; }
      this.input.type = 'text'; this.input.autocomplete = 'off'; this.input.spellcheck = false;
      this.input.setAttribute('role', 'combobox');
      this.input.setAttribute('aria-autocomplete', searchable ? 'list' : 'none');
      this.input.setAttribute('aria-expanded', 'false');
      for (const name of ['aria-label', 'aria-labelledby', 'aria-describedby']) {
        if (select.hasAttribute(name)) this.input.setAttribute(name, select.getAttribute(name));
      }
      this.input.setAttribute('aria-required', String(select.required));
      this.input.placeholder = 'Buscar y seleccionar…';
      // El usuario edita o borra el texto para buscar; no hay botón X junto al campo.
      const control = UI.element('div', 'app-search-select-control'); control.append(this.input);
      this.panel = UI.element('div', 'app-search-select-panel'); this.panel.hidden = true;
      this.panel.setAttribute('popover', 'manual');
      this.list = UI.element('div', 'app-search-select-list'); this.list.id = id + '-list';
      this.list.setAttribute('role', 'listbox'); this.list.setAttribute('aria-label', 'Opciones disponibles');
      this.input.setAttribute('aria-controls', this.list.id);
      this.message = UI.Message.create(this.panel);
      this.more = UI.Button.create({ label: 'Cargar más opciones' }); this.more.hidden = true;
      this.retry = UI.Button.create({ label: 'Reintentar opciones', icon: 'refresh' }); this.retry.hidden = true;
      this.panel.append(this.list, this.more, this.retry); this.root.append(control, this.panel);
      select.insertAdjacentElement('afterend', this.root); select.hidden = true; select.tabIndex = -1;
      // La búsqueda necesita poder vaciar el valor al escribir. Una elección fija conserva solo sus opciones declaradas.
      if (searchable && !Array.from(select.options).some(option => option.value === '')) {
        const empty = UI.element('option', '', 'Sin selección'); empty.value = ''; select.prepend(empty);
      }
      SearchSelect.controls.set(select, this);
      this.syncLabel(); this.syncDisabled();
      this.observer = new MutationObserver(() => { this.syncDisabled(); if (!this.load) this.syncOptions(); });
      this.observer.observe(select, { attributes: true, childList: true, subtree: true, characterData: true, attributeFilter: ['disabled', 'required', 'aria-busy', 'label', 'value'] });
      const settings = { signal: this.events.signal };
      this.input.addEventListener('click', () => {
        if (!this.searchable) this.opened ? this.close() : this.open();
      }, settings);
      this.input.addEventListener('input', () => {
        if (!this.searchable) return;
        const term = this.input.value.trim();
        if (select.value) { select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); this.input.value = term; }
        this.cancel();
        if (!term) { this.close(); return; }
        this.showPanel(); this.options = []; this.renderOptions();
        this.more.hidden = this.retry.hidden = true;
        this.message.show('loading', 'Buscando opciones…'); this.position();
        this.timer = window.setTimeout(() => this.fetchOptions(term), this.debounce);
      }, settings);
      this.input.addEventListener('keydown', event => this.onKeyDown(event), settings);
      this.panel.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.opened) { event.preventDefault(); event.stopPropagation(); this.close(); this.input.focus(); }
      }, settings);
      this.more.addEventListener('click', () => this.fetchOptions(this.term, this.page + 1), settings);
      this.retry.addEventListener('click', () => this.fetchOptions(this.term, this.failedPage), settings);
      this.list.addEventListener('pointerdown', event => event.preventDefault(), settings);
      this.list.addEventListener('click', event => {
        const item = event.target.closest('[data-option-index]');
        if (item) this.choose(Number(item.dataset.optionIndex));
      }, settings);
      document.addEventListener('pointerdown', event => { if (!this.contains(event.target)) this.close(); }, settings);
      document.addEventListener('focusin', event => { if (!this.contains(event.target)) this.close(); }, settings);
      select.addEventListener('change', () => { if (!this.opened) this.syncLabel(); }, settings);
      select.form?.addEventListener('reset', () => queueMicrotask(() => { if (!this.destroyed) { this.close(); this.syncLabel(); } }), settings);
    }
    /** Lee opciones válidas tanto al montar como cuando cambia el select original. */
    readOptions() {
      return Array.from(this.select.options).filter(option => (option.value || !this.searchable) && !option.disabled)
        .map(option => ({ value: option.value, label: option.textContent }));
    }
    /** Actualiza el catálogo del select original sin instalar nuevas escuchas ni perder su valor. */
    syncOptions() {
      this.localOptions = this.readOptions();
      if (this.opened) this.ready = this.fetchOptions(this.searchable ? this.input.value : '');
      else this.syncLabel();
    }
    syncDisabled() {
      this.input.disabled = this.select.disabled;
      this.input.setAttribute('aria-required', String(this.select.required));
      this.input.setAttribute('aria-busy', this.select.getAttribute('aria-busy') || 'false');
      if (this.select.disabled) this.close();
    }
    syncLabel() { if (this.allowCustom && !this.select.value) return; this.input.value = this.select.value || !this.searchable ? this.select.selectedOptions[0]?.textContent || '' : ''; }
    setValue(option, notify = false) {
      if (option && String(option.value)) {
        const value = String(option.value);
        let node = Array.from(this.select.options).find(item => item.value === value);
        if (!node) { node = UI.element('option', '', option.label); node.value = value; this.select.append(node); }
        this.select.value = value;
      } else { this.select.value = ''; this.input.value = ''; }
      this.syncLabel();
      if (notify) this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    contains(target) { return this.root.contains(target) || this.panel.contains(target); }
    /** Popover evita recortes por el scroll del modal; el fallback mantiene el panel dentro del diálogo. */
    showPanel() {
      if (this.opened) return;
      this.opened = true; this.panel.hidden = false;
      if (this.panel.showPopover) this.panel.showPopover();
      else (this.input.closest('dialog') || document.body).append(this.panel);
      this.input.setAttribute('aria-expanded', 'true');
      this.openEvents = new AbortController();
      const settings = { signal: this.openEvents.signal };
      window.addEventListener('resize', () => this.position(), settings);
      document.addEventListener('scroll', event => {
        if (!this.panel.contains(event.target)) this.position();
      }, { ...settings, capture: true });
      this.position();
    }
    /** Posición respecto al campo, con apertura hacia arriba cuando el espacio inferior no alcanza. */
    position() {
      if (!this.opened) return;
      const rect = this.input.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const body = this.input.closest('.app-modal-body')?.getBoundingClientRect();
      if (rect.bottom <= (body?.top ?? 0) || rect.top >= (body?.bottom ?? viewport.height) ||
          rect.right <= 0 || rect.left >= viewport.width) { this.close(); return; }
      const below = Math.max(0, viewport.height - rect.bottom - 12), above = Math.max(0, rect.top - 12);
      const upwards = below < 240 && above > below;
      this.panel.style.width = Math.min(rect.width, viewport.width - 20) + 'px';
      this.panel.style.maxHeight = Math.min(300, upwards ? above : below) + 'px';
      const height = this.panel.getBoundingClientRect().height;
      this.panel.style.left = Math.max(10, Math.min(rect.left, viewport.width - this.panel.offsetWidth - 10)) + 'px';
      this.panel.style.top = Math.max(10, upwards ? rect.top - height - 6 : rect.bottom + 6) + 'px';
    }
    open() {
      if (this.destroyed || this.select.disabled) return Promise.resolve();
      const term = this.searchable ? this.input.value.trim() : '';
      if (this.searchable && !term) return Promise.resolve();
      this.showPanel();
      this.ready = this.fetchOptions(term); return this.ready;
    }
    cancel() { window.clearTimeout(this.timer); this.request?.abort(); ++this.requestId; }
    close() {
      if (!this.opened) return;
      this.opened = false; this.cancel(); this.openEvents?.abort();
      if (this.panel.hidePopover && this.panel.matches(':popover-open')) this.panel.hidePopover();
      this.panel.hidden = true;
      this.input.setAttribute('aria-expanded', 'false'); this.input.removeAttribute('aria-activedescendant'); this.syncLabel();
    }
    async fetchOptions(term, page = 1) {
      if (this.destroyed || !this.opened) return;
      this.cancel(); const id = this.requestId;
      this.request = new AbortController(); this.term = term; this.failedPage = page;
      this.more.hidden = this.retry.hidden = true;
      if (page === 1) { this.options = []; this.renderOptions(); }
      this.list.setAttribute('aria-busy', 'true'); this.message.show('loading', 'Buscando opciones…'); this.position();
      try {
        let result;
        if (this.load) result = await this.load({ term, page, pageSize: this.pageSize, signal: this.request.signal });
        else {
          const filtered = this.localOptions.filter(item => item.label.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es')));
          result = { options: filtered.slice((page - 1) * this.pageSize, page * this.pageSize), total: filtered.length };
        }
        if (id !== this.requestId || this.destroyed || !this.opened) return;
        if (!result || !Array.isArray(result.options) || !Number.isSafeInteger(result.total) || result.total < 0 || result.options.length > this.pageSize ||
            result.options.some(item => !item || !['number', 'string'].includes(typeof item.value) || (this.searchable && String(item.value) === '') || typeof item.label !== 'string')) {
          throw new TypeError('Respuesta de opciones no válida.');
        }
        const options = [...(page === 1 ? [] : this.options), ...result.options.map(item => ({ value: String(item.value), label: item.label }))];
        if (new Set(options.map(item => item.value)).size !== options.length || options.length > result.total ||
            (!result.options.length && result.total > options.length)) throw new TypeError('Página de opciones no válida.');
        this.options = options; this.page = page; this.renderOptions();
        // Las opciones se anuncian mediante listbox; no se agrega un contador visual.
        if (options.length) this.message.clear();
        else this.message.show('empty', 'No se encontraron opciones.');
        this.more.hidden = options.length >= result.total;
      } catch (_) {
        if (id !== this.requestId || this.destroyed || !this.opened) return;
        this.message.show('error', 'No se pudieron cargar las opciones.'); this.retry.hidden = false;
      } finally {
        if (id === this.requestId) { this.list.setAttribute('aria-busy', 'false'); this.position(); }
      }
    }
    renderOptions() {
      this.list.replaceChildren(); this.active = -1; this.input.removeAttribute('aria-activedescendant');
      this.options.forEach((item, index) => {
        const node = UI.element('div', 'app-search-select-option', item.label);
        node.id = this.list.id + '-' + index; node.dataset.optionIndex = String(index);
        node.setAttribute('role', 'option'); node.setAttribute('aria-selected', String(item.value === this.select.value));
        this.list.append(node);
      });
    }
    move(index) {
      if (!this.options.length) return;
      this.active = (index + this.options.length) % this.options.length;
      Array.from(this.list.children).forEach((node, i) => { node.dataset.active = String(i === this.active); });
      const active = this.list.children[this.active]; this.input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
    choose(index) {
      if (this.select.disabled || !this.options[index]) return;
      this.setValue(this.options[index], true); this.close(); this.input.focus();
    }
    onKeyDown(event) {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        if (!this.opened) this.open().then(() => { if (this.opened) this.move(event.key === 'ArrowDown' ? 0 : this.options.length - 1); });
        else this.move(this.active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (this.opened && ['Home', 'End'].includes(event.key)) {
        event.preventDefault(); this.move(event.key === 'Home' ? 0 : this.options.length - 1);
      } else if (!this.searchable && !this.opened && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); this.open().then(() => { if (this.opened) this.move(Math.max(0, this.options.findIndex(option => option.value === this.select.value))); });
      } else if (this.opened && (event.key === 'Enter' || (!this.searchable && event.key === ' '))) {
        event.preventDefault(); if (this.active >= 0) this.choose(this.active);
      } else if (this.opened && event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); this.close();
      } else if (!this.searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const time = Date.now(); this.prefix = time - (this.typedAt || 0) < 700 ? (this.prefix || '') + event.key : event.key; this.typedAt = time;
        const find = () => { const index = this.options.findIndex(option => option.label.toLocaleLowerCase('es').startsWith(this.prefix.toLocaleLowerCase('es'))); if (index >= 0) this.move(index); };
        if (this.opened) find(); else this.open().then(() => { if (this.opened) find(); });
      }
    }
    destroy() {
      if (this.destroyed) return;
      this.close(); this.destroyed = true; this.cancel(); this.events.abort(); this.observer.disconnect();
      this.panel.remove(); this.root.remove(); this.select.id = this.original.id; this.select.hidden = this.original.hidden;
      if (this.original.tabindex === null) this.select.removeAttribute('tabindex'); else this.select.setAttribute('tabindex', this.original.tabindex);
      SearchSelect.controls.delete(this.select);
    }
  }
  UI.SearchSelect = SearchSelect;
})();
