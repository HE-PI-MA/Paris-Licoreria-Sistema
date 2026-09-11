/**
 * Selector con búsqueda local o por páginas del servidor. Conserva el select original para FormData.
 * El cuadro visible controla teclado y foco; las respuestas antiguas se cancelan y nunca pisan la búsqueda actual.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class SearchSelect {
    static controls = new WeakMap();
    constructor({ select, load, pageSize = 20, debounce = 250 } = {}) {
      if (!(select instanceof HTMLSelectElement) || select.multiple || SearchSelect.controls.has(select)) {
        throw new TypeError('Se necesita un select simple sin inicializar.');
      }
      if ((load !== undefined && typeof load !== 'function') || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new TypeError('Consulta o tamaño de página no válido.');
      }
      Object.assign(this, { select, load, pageSize, debounce });
      this.events = new AbortController(); this.requestId = 0; this.options = []; this.active = -1;
      this.original = { id: select.id, hidden: select.hidden, tabindex: select.getAttribute('tabindex') };
      this.localOptions = Array.from(select.options).filter(option => option.value && !option.disabled)
        .map(option => ({ value: option.value, label: option.textContent }));
      const id = 'paris-select-' + (++sequence);
      this.root = UI.element('div', 'app-search-select');
      this.input = UI.element('input', 'app-input');
      this.input.id = select.id || id; select.id = id + '-source';
      this.input.type = 'text'; this.input.autocomplete = 'off'; this.input.spellcheck = false;
      this.input.setAttribute('role', 'combobox');
      this.input.setAttribute('aria-autocomplete', 'list');
      this.input.setAttribute('aria-expanded', 'false');
      for (const name of ['aria-label', 'aria-labelledby', 'aria-describedby']) {
        if (select.hasAttribute(name)) this.input.setAttribute(name, select.getAttribute(name));
      }
      this.input.setAttribute('aria-required', String(select.required));
      this.input.placeholder = 'Buscar y seleccionar…';
      this.clear = UI.Button.create({ label: 'Limpiar selección', icon: 'close', iconOnly: true });
      const control = UI.element('div', 'app-search-select-control'); control.append(this.input, this.clear);
      this.panel = UI.element('div', 'app-search-select-panel'); this.panel.hidden = true;
      this.list = UI.element('div', 'app-search-select-list'); this.list.id = id + '-list';
      this.list.setAttribute('role', 'listbox'); this.list.setAttribute('aria-label', 'Opciones disponibles');
      this.input.setAttribute('aria-controls', this.list.id);
      this.message = UI.Message.create(this.panel);
      this.more = UI.Button.create({ label: 'Cargar más opciones' }); this.more.hidden = true;
      this.retry = UI.Button.create({ label: 'Reintentar opciones', icon: 'refresh' }); this.retry.hidden = true;
      this.panel.append(this.list, this.more, this.retry); this.root.append(control, this.panel);
      select.insertAdjacentElement('afterend', this.root); select.hidden = true; select.tabIndex = -1;
      if (!Array.from(select.options).some(option => option.value === '')) {
        const empty = UI.element('option', '', 'Sin selección'); empty.value = ''; select.prepend(empty); this.emptyOption = empty;
      }
      SearchSelect.controls.set(select, this);
      this.syncLabel(); this.syncDisabled();
      this.observer = new MutationObserver(() => this.syncDisabled());
      this.observer.observe(select, { attributes: true, attributeFilter: ['disabled', 'required'] });
      const settings = { signal: this.events.signal };
      this.input.addEventListener('click', () => { if (!this.opened) this.open(); }, settings);
      this.input.addEventListener('input', () => {
        const term = this.input.value;
        this.opened = true;
        if (select.value) { select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); }
        this.opened = true; this.panel.hidden = false; this.input.setAttribute('aria-expanded', 'true');
        this.cancel(); this.options = []; this.renderOptions();
        this.message.show('loading', 'Buscando opciones…');
        this.timer = window.setTimeout(() => this.fetchOptions(term), this.debounce);
      }, settings);
      this.input.addEventListener('keydown', event => this.onKeyDown(event), settings);
      this.root.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.opened) { event.preventDefault(); event.stopPropagation(); this.close(); this.input.focus(); }
      }, settings);
      this.clear.addEventListener('click', () => { this.setValue(null, true); this.close(); this.input.focus(); }, settings);
      this.more.addEventListener('click', () => this.fetchOptions(this.term, this.page + 1), settings);
      this.retry.addEventListener('click', () => this.fetchOptions(this.term, this.failedPage), settings);
      this.list.addEventListener('pointerdown', event => event.preventDefault(), settings);
      this.list.addEventListener('click', event => {
        const item = event.target.closest('[data-option-index]');
        if (item) this.choose(Number(item.dataset.optionIndex));
      }, settings);
      document.addEventListener('pointerdown', event => { if (!this.root.contains(event.target)) this.close(); }, settings);
      document.addEventListener('focusin', event => { if (!this.root.contains(event.target)) this.close(); }, settings);
      select.addEventListener('change', () => { if (!this.opened) this.syncLabel(); }, settings);
      select.form?.addEventListener('reset', () => queueMicrotask(() => { if (!this.destroyed) { this.close(); this.syncLabel(); } }), settings);
    }
    syncDisabled() {
      this.input.disabled = this.clear.disabled = this.select.disabled;
      this.input.setAttribute('aria-required', String(this.select.required));
      if (this.select.disabled) this.close();
    }
    syncLabel() { this.input.value = this.select.value ? this.select.selectedOptions[0]?.textContent || '' : ''; }
    setValue(option, notify = false) {
      if (option && String(option.value)) {
        const value = String(option.value);
        let node = Array.from(this.select.options).find(item => item.value === value);
        if (!node) { node = UI.element('option', '', option.label); node.value = value; this.select.append(node); }
        this.select.value = value;
      } else this.select.value = '';
      this.syncLabel();
      if (notify) this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    open() {
      if (this.destroyed || this.select.disabled) return;
      this.opened = true; this.panel.hidden = false; this.input.setAttribute('aria-expanded', 'true');
      this.ready = this.fetchOptions(''); return this.ready;
    }
    cancel() { window.clearTimeout(this.timer); this.request?.abort(); ++this.requestId; }
    close() {
      if (!this.opened) return;
      this.opened = false; this.cancel(); this.panel.hidden = true;
      this.input.setAttribute('aria-expanded', 'false'); this.input.removeAttribute('aria-activedescendant'); this.syncLabel();
    }
    async fetchOptions(term, page = 1) {
      if (this.destroyed || !this.opened) return;
      this.cancel(); const id = this.requestId;
      this.request = new AbortController(); this.term = term; this.failedPage = page;
      this.more.hidden = this.retry.hidden = true; this.busy = true;
      if (page === 1) { this.options = []; this.renderOptions(); }
      this.list.setAttribute('aria-busy', 'true'); this.message.show('loading', 'Buscando opciones…');
      try {
        let result;
        if (this.load) result = await this.load({ term, page, pageSize: this.pageSize, signal: this.request.signal });
        else {
          const filtered = this.localOptions.filter(item => item.label.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es')));
          result = { options: filtered.slice((page - 1) * this.pageSize, page * this.pageSize), total: filtered.length };
        }
        if (id !== this.requestId || this.destroyed || !this.opened) return;
        if (!result || !Array.isArray(result.options) || !Number.isSafeInteger(result.total) || result.total < 0 || result.options.length > this.pageSize ||
            result.options.some(item => !item || !['number', 'string'].includes(typeof item.value) || String(item.value) === '' || typeof item.label !== 'string')) {
          throw new TypeError('Respuesta de opciones no válida.');
        }
        const options = [...(page === 1 ? [] : this.options), ...result.options.map(item => ({ value: String(item.value), label: item.label }))];
        if (new Set(options.map(item => item.value)).size !== options.length || options.length > result.total ||
            (!result.options.length && result.total > options.length)) throw new TypeError('Página de opciones no válida.');
        this.options = options; this.page = page; this.renderOptions();
        this.message.show(options.length ? 'info' : 'empty', options.length ? options.length + ' de ' + result.total + ' opciones.' : 'No se encontraron opciones.');
        this.more.hidden = options.length >= result.total;
      } catch (_) {
        if (id !== this.requestId || this.destroyed || !this.opened) return;
        this.message.show('error', 'No se pudieron cargar las opciones.'); this.retry.hidden = false;
      } finally {
        if (id === this.requestId) { this.busy = false; this.list.setAttribute('aria-busy', 'false'); }
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
      } else if (this.opened && event.key === 'Enter') {
        event.preventDefault(); if (this.active >= 0) this.choose(this.active);
      } else if (this.opened && event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); this.close();
      } else if (event.key === 'Tab') this.close();
    }
    destroy() {
      if (this.destroyed) return;
      this.close(); this.destroyed = true; this.cancel(); this.events.abort(); this.observer.disconnect();
      this.root.remove(); this.select.id = this.original.id; this.select.hidden = this.original.hidden;
      if (this.original.tabindex === null) this.select.removeAttribute('tabindex'); else this.select.setAttribute('tabindex', this.original.tabindex);
      SearchSelect.controls.delete(this.select);
    }
  }
  UI.SearchSelect = SearchSelect;
})();
