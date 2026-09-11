/**
 * Tabla compartida con paginación local o una función de consulta al servidor.
 * Presenta valores como texto. Las acciones se delegan a la clase del módulo mediante onAction.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;

  class DataTable {
    constructor({ container, columns, records = [], load, actions = [], onAction,
      getRowId = record => record.id, pageSize = 10, pageSizes = [5, 10, 25, 50],
      caption = 'Listado de registros', locale = 'es-BO', currency = 'BOB', actionDisplay = 'buttons', sort = null } = {}) {
      if (!(container instanceof HTMLElement) || !Array.isArray(columns) || !columns.length) {
        throw new TypeError('La tabla necesita un contenedor y columnas.');
      }
      if (container.dataset.dataTableMounted) throw new Error('Ya existe una tabla en este contenedor.');
      if (load !== undefined && typeof load !== 'function') throw new TypeError('load debe ser una función.');
      if (!Array.isArray(records) || !pageSizes.length || !pageSizes.includes(pageSize) ||
          pageSizes.some(n => !Number.isSafeInteger(n) || n < 1 || n > 100)) {
        throw new TypeError('Registros o tamaños de página no válidos.');
      }
      for (const column of columns) {
        if (typeof column.key !== 'string' || !column.key || !column.label || !['text', 'number', 'quantity', 'price', 'state', 'date'].includes(column.type || 'text')) {
          throw new TypeError('Columna no válida.');
        }
      }
      if (!Array.isArray(actions) || actions.some(action => !action.id || !action.label) ||
          new Set(actions.map(action => action.id)).size !== actions.length) {
        throw new TypeError('Las acciones necesitan nombres e identificadores únicos.');
      }
      if (!['buttons', 'menu'].includes(actionDisplay) || new Set(columns.map(column => column.key)).size !== columns.length) {
        throw new TypeError('Presentación de acciones o columnas no válida.');
      }
      Object.assign(this, { container, columns, load, actions, onAction, getRowId, pageSize, pageSizes, locale, currency, actionDisplay });
      this.sort = this.validateSort(sort);
      this.menus = [];
      this.collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
      this.records = records;
      this.page = 1;
      this.total = 0;
      this.query = {};
      this.rows = [];
      this.requestId = 0;
      this.pendingRows = new Set();
      this.events = new AbortController();
      container.dataset.dataTableMounted = 'true';
      container.classList.add('app-data-table');
      this.build(caption);
      container.addEventListener('click', event => this.onClick(event), { signal: this.events.signal });
      this.sizeSelect.addEventListener('change', () => {
        this.pageSize = Number(this.sizeSelect.value);
        this.page = 1;
        this.refresh();
      }, { signal: this.events.signal });
      this.ready = this.refresh();
    }

    build(caption) {
      const id = 'paris-table-' + (++sequence);
      this.scroll = UI.element('div', 'app-table-scroll');
      this.scroll.tabIndex = 0;
      this.scroll.setAttribute('role', 'region');
      this.scroll.setAttribute('aria-label', caption + '. Área desplazable');
      this.table = UI.element('table', 'app-table');
      this.table.append(UI.element('caption', 'app-sr-only', caption));
      const head = UI.element('thead'), row = UI.element('tr');
      for (const column of this.columns) {
        const cell = UI.element('th', ['number', 'quantity', 'price'].includes(column.type) ? 'app-table-number' : '', column.label);
        cell.scope = 'col';
        if (column.sortable) {
          const button = UI.element('button', 'app-table-sort', column.label); button.type = 'button';
          button.dataset.tableSort = column.key; button.setAttribute('aria-label', 'Ordenar por ' + column.label);
          const arrow = UI.element('span', '', '↕'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
          cell.dataset.sortColumn = column.key; cell.replaceChildren(button);
        }
        row.append(cell);
      }
      if (this.actions.length) {
        const cell = UI.element('th', '', 'Acciones'); cell.scope = 'col'; row.append(cell);
      }
      head.append(row);
      this.body = UI.element('tbody');
      this.table.append(head, this.body);
      this.scroll.append(this.table);
      this.footer = UI.element('footer', 'app-table-footer');
      this.summary = UI.element('p');
      this.summary.setAttribute('role', 'status');
      this.summary.setAttribute('aria-live', 'polite');
      this.summary.setAttribute('aria-atomic', 'true');
      const sizeGroup = UI.element('div', 'app-table-size');
      const sizeLabel = UI.element('label', '', 'Por página');
      sizeLabel.htmlFor = id + '-size';
      this.sizeSelect = UI.element('select', 'app-input');
      this.sizeSelect.id = sizeLabel.htmlFor;
      for (const size of this.pageSizes) {
        const option = UI.element('option', '', size); option.value = String(size); this.sizeSelect.append(option);
      }
      this.sizeSelect.value = String(this.pageSize);
      sizeGroup.append(sizeLabel, this.sizeSelect);
      const nav = UI.element('nav', 'app-table-pagination');
      nav.setAttribute('aria-label', 'Paginación de ' + caption);
      this.previous = UI.Button.create({ label: 'Anterior' });
      this.previous.dataset.tablePage = 'previous';
      this.next = UI.Button.create({ label: 'Siguiente' });
      this.next.dataset.tablePage = 'next';
      this.pageLabel = UI.element('span');
      nav.append(this.previous, this.pageLabel, this.next);
      this.footer.append(this.summary, sizeGroup, nav);
      this.container.replaceChildren(this.scroll, this.footer);
      this.updateSortHeaders();
    }

    /** Solo las columnas declaradas sortable pueden originar un orden, incluido el modo servidor. */
    validateSort(sort) {
      if (sort === null) return null;
      if (!sort || !this.columns.some(column => column.key === sort.key && column.sortable) || !['asc', 'desc'].includes(sort.direction)) {
        throw new TypeError('Orden no permitido.');
      }
      return { key: sort.key, direction: sort.direction };
    }
    setSort(sort) { this.sort = this.validateSort(sort); this.page = 1; this.updateSortHeaders(); return this.refresh(); }
    updateSortHeaders() {
      for (const cell of this.table.querySelectorAll('[data-sort-column]')) {
        const direction = this.sort?.key === cell.dataset.sortColumn ? this.sort.direction : null;
        cell.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');
        cell.querySelector('span').textContent = direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕';
      }
    }
    sortRecords(records) {
      if (!this.sort) return records;
      const column = this.columns.find(item => item.key === this.sort.key);
      const numeric = ['number', 'quantity', 'price'].includes(column.type);
      const value = record => {
        const raw = record[column.key];
        if (raw === null || raw === undefined || raw === '') return null;
        return numeric ? (Number.isFinite(Number(raw)) ? Number(raw) : null) : String(raw);
      };
      return [...records].sort((left, right) => {
        const a = value(left), b = value(right);
        if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
        const result = numeric ? a - b : this.collator.compare(a, b);
        return result * (this.sort.direction === 'asc' ? 1 : -1);
      });
    }
    setActionDisplay(mode) {
      if (!['buttons', 'menu'].includes(mode)) throw new TypeError('Presentación de acciones no válida.');
      this.actionDisplay = mode; if (this.state === 'ready') this.renderRows();
    }
    clearMenus() { this.menus.forEach(menu => menu.destroy()); this.menus = []; }

    get totalPages() { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

    updateFooter() {
      const first = this.total ? (this.page - 1) * this.pageSize + 1 : 0;
      const last = this.total ? first + this.rows.length - 1 : 0;
      this.summary.textContent = this.state === 'loading' ? 'Cargando registros…' :
        this.state === 'error' ? 'La carga no se completó.' :
        'Mostrando ' + first + '–' + last + ' de ' + this.total + ' registros';
      this.pageLabel.textContent = 'Página ' + this.page + ' de ' + this.totalPages;
      const blocked = this.state === 'loading' || this.state === 'error';
      this.previous.disabled = blocked || this.page <= 1;
      this.next.disabled = blocked || this.page >= this.totalPages;
      this.sizeSelect.disabled = blocked;
    }

    showState(kind, message) {
      this.clearMenus();
      this.state = kind;
      this.container.setAttribute('aria-busy', String(kind === 'loading'));
      const row = UI.element('tr'), cell = UI.element('td', 'app-table-state');
      cell.colSpan = this.columns.length + (this.actions.length ? 1 : 0);
      const status = UI.Message.create(cell);
      status.show(kind, message);
      if (kind === 'error') {
        const retry = UI.Button.create({ label: 'Reintentar', icon: 'refresh' });
        retry.dataset.tableRetry = '';
        cell.append(retry);
      }
      row.append(cell);
      this.body.replaceChildren(row);
      this.updateFooter();
    }

    /** Recibir consultas no implica cargar toda la base: load devuelve solo la página solicitada. */
    async refresh({ corrected = false } = {}) {
      if (this.destroyed) return;
      const requestId = ++this.requestId;
      this.request?.abort();
      this.request = new AbortController();
      this.showState('loading', 'Cargando…');
      try {
        let result;
        if (this.load) {
          result = await this.load({ page: this.page, pageSize: this.pageSize, query: structuredClone(this.query), sort: this.sort && { ...this.sort }, signal: this.request.signal });
        } else {
          const term = String(this.query.term || '').toLocaleLowerCase(this.locale);
          const filtered = this.records.filter(record => !term || this.columns.some(
            column => String(record[column.key] ?? '').toLocaleLowerCase(this.locale).includes(term)
          ));
          const sorted = this.sortRecords(filtered);
          result = { records: sorted.slice((this.page - 1) * this.pageSize, this.page * this.pageSize), total: filtered.length };
        }
        // Una búsqueda posterior tiene prioridad aunque la anterior ignore AbortSignal.
        if (this.destroyed || requestId !== this.requestId) return;
        if (!result || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 ||
            result.records.length > this.pageSize || result.records.length > result.total) {
          throw new TypeError('Respuesta de listado no válida.');
        }
        if (result.records.some(record => !record || typeof record !== 'object')) throw new TypeError('Registro no válido.');
        if (this.actions.length) {
          const ids = result.records.map(record => this.getRowId(record));
          if (ids.some(id => !['string', 'number'].includes(typeof id) || String(id) === '') ||
              new Set(ids.map(String)).size !== ids.length) throw new TypeError('Cada fila necesita un identificador único.');
        }
        this.total = result.total;
        if (this.page > this.totalPages) {
          if (corrected) throw new Error('El listado cambió durante la consulta.');
          this.page = this.totalPages;
          return this.refresh({ corrected: true });
        }
        this.rows = result.records;
        if (this.total > 0 && !this.rows.length) throw new Error('Página incompleta.');
        if (!this.rows.length) return this.showState('empty', 'No hay registros para mostrar.');
        this.renderRows();
      } catch (error) {
        if (!this.destroyed && requestId === this.requestId) {
          this.showState('error', 'No se pudo cargar el listado. Inténtalo nuevamente.');
        }
      }
    }

    setQuery(query = {}) { this.query = { ...query }; this.page = 1; return this.refresh(); }

    setData(records) {
      if (this.load) throw new Error('En modo servidor usa refresh para consultar de nuevo.');
      if (!Array.isArray(records)) throw new TypeError('Los registros deben ser una lista.');
      this.records = records;
      return this.refresh();
    }

    format(value, column, record) {
      if (typeof column.format === 'function') return String(column.format(value, record) ?? '');
      if (value === null || value === undefined || value === '') return '—';
      if (column.type === 'date') {
        const date = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return date ? date[3] + '/' + date[2] + '/' + date[1] : '—';
      }
      if (['number', 'quantity', 'price'].includes(column.type)) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        const options = column.type === 'price' ? { style: 'currency', currency: column.currency || this.currency } :
          { maximumFractionDigits: column.type === 'quantity' ? 3 : (column.decimals ?? 0) };
        return new Intl.NumberFormat(this.locale, options).format(number);
      }
      return String(value);
    }

    renderRows() {
      this.clearMenus();
      this.state = 'ready';
      this.container.setAttribute('aria-busy', 'false');
      const fragment = document.createDocumentFragment();
      this.rows.forEach((record, index) => {
        const row = UI.element('tr');
        row.dataset.rowIndex = String(index);
        for (const column of this.columns) {
          const cell = UI.element('td', ['number', 'quantity', 'price'].includes(column.type) ? 'app-table-number' : '');
          const value = record[column.key];
          if (column.type === 'state') {
            const state = column.states && Object.hasOwn(column.states, value) ? column.states[value] : null;
            const tone = state && ['success', 'warning', 'error', 'info', 'neutral'].includes(state.tone) ? state.tone : 'neutral';
            cell.append(UI.element('span', 'app-badge app-badge--' + tone, state?.label || this.format(value, column, record)));
          } else cell.textContent = this.format(value, column, record);
          row.append(cell);
        }
        if (this.actions.length) {
          const cell = UI.element('td'), group = UI.element('div', 'app-table-actions');
          const menuItems = [];
          this.actions.forEach((action, actionIndex) => {
            if (action.visible && !action.visible(record)) return;
            const label = typeof action.label === 'function' ? action.label(record) : action.label;
            const disabled = this.pendingRows.has(String(this.getRowId(record))) || Boolean(typeof action.disabled === 'function' ? action.disabled(record) : action.disabled);
            if (this.actionDisplay === 'menu') { menuItems.push({ ...action, label, disabled, iconOnly: false, actionIndex }); return; }
            const button = UI.Button.create({ ...action, label, disabled });
            button.dataset.tableAction = String(actionIndex);
            button.dataset.rowIndex = String(index);
            group.append(button);
          });
          if (this.actionDisplay === 'menu' && menuItems.length) {
            const menu = new UI.ActionMenu({ container: group, label: 'Acciones del registro ' + this.getRowId(record), items: menuItems,
              onSelect: (item, { button }) => this.runAction(item.actionIndex, index, button) });
            menu.trigger.dataset.tableMenuRow = String(index);
            menu.trigger.disabled = this.pendingRows.has(String(this.getRowId(record)));
            this.menus.push(menu);
          }
          cell.append(group); row.append(cell);
        }
        fragment.append(row);
      });
      this.body.replaceChildren(fragment);
      this.updateFooter();
    }

    async onClick(event) {
      const button = event.target.closest('button');
      if (!button || !this.container.contains(button) || button.disabled) return;
      if (button.hasAttribute('data-table-sort')) {
        const key = button.dataset.tableSort;
        return this.setSort({ key, direction: this.sort?.key === key && this.sort.direction === 'asc' ? 'desc' : 'asc' });
      }
      if (button.hasAttribute('data-table-retry')) return this.refresh();
      if (button.dataset.tablePage) {
        const page = this.page + (button.dataset.tablePage === 'next' ? 1 : -1);
        if (page >= 1 && page <= this.totalPages) { this.page = page; return this.refresh(); }
        return;
      }
      if (!button.hasAttribute('data-table-action') || this.state !== 'ready') return;
      return this.runAction(Number(button.dataset.tableAction), Number(button.dataset.rowIndex), button);
    }

    async runAction(actionIndex, rowIndex, button) {
      if (this.destroyed || this.state !== 'ready' || button.disabled) return;
      const record = this.rows[rowIndex];
      const action = this.actions[actionIndex];
      if (!record || !action || (action.visible && !action.visible(record)) ||
          (typeof action.disabled === 'function' ? action.disabled(record) : action.disabled)) return;
      const rowId = String(this.getRowId(record));
      if (this.pendingRows.has(rowId)) return;
      this.pendingRows.add(rowId);
      const siblings = Array.from(button.closest('tr').querySelectorAll('button'));
      const disabledBefore = siblings.map(item => item.disabled);
      UI.Button.setBusy(button, true);
      siblings.forEach(item => { item.disabled = true; });
      try {
        if (this.onAction) await this.onAction({ action: action.id, record, button, table: this });
        else this.container.dispatchEvent(new CustomEvent('datatable:action', { bubbles: true, detail: { action: action.id, record } }));
      } catch (_) {
        if (!this.destroyed) {
          if (window.ParisModule) window.ParisModule.showMessage('error', 'No se pudo completar la acción. Inténtalo nuevamente.');
          else this.showState('error', 'No se pudo completar la acción.');
        }
      } finally {
        this.pendingRows.delete(rowId);
        UI.Button.setBusy(button, false);
        siblings.forEach((item, index) => { item.disabled = disabledBefore[index]; });
        // El modal pudo devolver el foco al main mientras la fila seguía bloqueada.
        // Al cancelar, recuperar el botón ahora habilitado sin interrumpir otro diálogo o control.
        if (!this.destroyed && !UI.Modal?.top && button.isConnected && !button.disabled &&
            document.activeElement === document.getElementById('module-content')) button.focus({ preventScroll: true });
        // Una actualización durante la acción pudo crear botones nuevos para esa misma fila.
        if (!this.destroyed && this.state === 'ready') {
          for (const menu of this.menus) {
            const row = this.rows[Number(menu.trigger.dataset.tableMenuRow)];
            menu.trigger.disabled = this.pendingRows.has(String(this.getRowId(row)));
            menu.buttons.forEach((item, index) => {
              const definition = this.actions[menu.items[index].actionIndex];
              item.disabled = menu.trigger.disabled || Boolean(typeof definition.disabled === 'function' ? definition.disabled(row) : definition.disabled);
            });
          }
          for (const item of this.body.querySelectorAll('[data-table-action]')) {
            const current = this.rows[Number(item.dataset.rowIndex)], definition = this.actions[Number(item.dataset.tableAction)];
            item.disabled = this.pendingRows.has(String(this.getRowId(current))) || Boolean(typeof definition.disabled === 'function' ? definition.disabled(current) : definition.disabled);
          }
        }
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      ++this.requestId;
      this.request?.abort();
      this.clearMenus();
      this.events.abort();
      delete this.container.dataset.dataTableMounted;
      this.container.classList.remove('app-data-table');
      this.container.removeAttribute('aria-busy');
      this.container.replaceChildren();
    }
  }
  UI.DataTable = DataTable;
})();
