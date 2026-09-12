/**
 * Tabla compartida con paginación o scroll continuo, numeración y prioridades de columnas.
 * Carga el servidor por bloques; las columnas secundarias se consultan en el detalle de la fila.
 * Presenta valores como texto. Las acciones se delegan a la clase del módulo mediante onAction.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;

  class DataTable {
    constructor({ container, columns, records = [], load, actions = [], onAction,
      getRowId = record => record.id, pageSize = 10, pageSizes = [5, 10, 25, 50],
      caption = 'Listado de registros', locale = 'es-BO', currency = 'BOB', actionDisplay = 'buttons', sort = null, mode = 'pages', numbered = false, fillHeight = true } = {}) {
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
      if (!['pages', 'scroll'].includes(mode) || typeof numbered !== 'boolean' || typeof fillHeight !== 'boolean' || !['buttons', 'menu'].includes(actionDisplay) || new Set(columns.map(column => column.key)).size !== columns.length) {
        throw new TypeError('Presentación de acciones o columnas no válida.');
      }
      if (columns.some(column => ![0, 1, 2, 3].includes(column.priority ?? 0)) || (columns[0].priority ?? 0) !== 0) {
        throw new TypeError('La primera columna debe ser principal; las prioridades van de 0 a 3.');
      }
      Object.assign(this, { container, columns, load, actions, onAction, getRowId, pageSize, pageSizes, locale, currency, actionDisplay, mode, numbered });
      this.visibleKeys = new Set(columns.map(column => column.key));
      this.expanded = new Set();
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
      container.classList.toggle('app-data-table--scroll', mode === 'scroll');
      // En modales cortos, la tabla ajusta su alto a las filas; los listados de módulo llenan el espacio.
      container.classList.toggle('app-data-table--fit', !fillHeight);
      this.observer = new ResizeObserver(() => this.updatePriorities());
      this.observer.observe(container);
      this.scroll.addEventListener('scroll', () => {
        if (this.mode === 'scroll' && this.scroll.scrollTop > 0 && this.scroll.scrollHeight - this.scroll.scrollTop - this.scroll.clientHeight < 120) this.loadMore();
      }, { signal: this.events.signal });
      container.addEventListener('click', event => this.onClick(event), { signal: this.events.signal });
      this.sizeSelect?.addEventListener('change', () => {
        this.pageSize = Number(this.sizeSelect.value);
        this.page = 1;
        this.refresh();
      }, { signal: this.events.signal });
      this.ready = this.refresh();
    }

    build(caption) {
      const id = this.id = 'paris-table-' + (++sequence);
      this.scroll = UI.element('div', 'app-table-scroll');
      this.scroll.tabIndex = 0;
      this.scroll.setAttribute('role', 'region');
      this.scroll.setAttribute('aria-label', caption + '. Área desplazable');
      this.table = UI.element('table', 'app-table');
      this.table.append(UI.element('caption', 'app-sr-only', caption));
      const head = UI.element('thead'), row = UI.element('tr');
      if (this.numbered) { const cell = UI.element('th', 'app-table-sequence', 'N.º'); cell.scope = 'col'; row.append(cell); }
      for (const column of this.columns) {
        const cell = UI.element('th', ['number', 'quantity', 'price'].includes(column.type) ? 'app-table-number' : '', column.label);
        cell.scope = 'col'; cell.dataset.columnKey = column.key;
        // El encabezado solo identifica la columna. El módulo decide el orden de consulta.
        if (column.sortable) cell.dataset.sortColumn = column.key;
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
      this.summary = UI.element('p', 'app-sr-only');
      this.summary.setAttribute('role', 'status');
      this.summary.setAttribute('aria-live', 'polite');
      this.summary.setAttribute('aria-atomic', 'true');
      if (this.mode === 'scroll') {
        this.more = UI.Button.create({ label: 'Cargar más', icon: 'plus' }); this.more.classList.add('app-table-more'); this.more.dataset.tableMore = '';
        this.continuation = UI.element('div', 'app-table-continuation');
        this.continuationMessage = UI.Message.create(this.continuation); this.continuation.hidden = true;
        const refresh = UI.Button.create({ label: 'Actualizar lista', icon: 'refresh' }); refresh.dataset.tableRetry = ''; this.continuation.append(refresh);
        this.footer.append(this.more, this.continuation);
      } else {
        // El modo continuo no crea controles ni eventos de paginación que nunca se mostrarán.
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
        this.footer.append(sizeGroup, nav);
      }
      // El estado accesible permanece fuera del pie para anunciar resultados sin mostrar el contador.
      this.container.replaceChildren(this.scroll, this.summary, this.footer);
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
      const first = this.total ? (this.mode === 'scroll' ? 1 : (this.page - 1) * this.pageSize + 1) : 0;
      const last = this.total ? first + this.rows.length - 1 : 0;
      this.summary.textContent = this.state === 'loading' ? 'Cargando registros…' :
        this.state === 'error' ? 'La carga no se completó.' :
        'Mostrando ' + first + '–' + last + ' de ' + this.total + ' registros';
      if (this.more) {
        const hadFocus = document.activeElement === this.more;
        this.more.hidden = this.state !== 'ready' || this.rows.length >= this.total;
        if (hadFocus && this.more.hidden) this.scroll.focus({ preventScroll: true });
        this.more.disabled = Boolean(this.loadingMore);
        this.more.textContent = this.loadingMore ? 'Cargando…' : this.appendError ? 'Reintentar' : 'Cargar más';
        this.more.setAttribute('aria-busy', String(Boolean(this.loadingMore)));
        this.footer.hidden = this.more.hidden && this.continuation.hidden;
      } else {
        this.pageLabel.textContent = 'Página ' + this.page + ' de ' + this.totalPages;
        const blocked = this.state === 'loading' || this.state === 'error';
        this.previous.disabled = blocked || this.page <= 1;
        this.next.disabled = blocked || this.page >= this.totalPages;
        this.sizeSelect.disabled = blocked;
      }
    }

    showState(kind, message) {
      this.clearMenus();
      this.state = kind;
      this.container.setAttribute('aria-busy', String(kind === 'loading'));
      const row = UI.element('tr'), cell = UI.element('td', 'app-table-state');
      cell.colSpan = this.columnCount;
      const content = UI.element('div', 'app-table-state-content'); cell.append(content);
      const status = UI.Message.create(content);
      status.element.classList.add('app-table-state-message');
      const copy = UI.element('div', 'app-table-state-copy'); status.text.replaceWith(copy);
      const titles = { empty: 'Sin resultados', loading: 'Cargando listado', error: 'No se pudo cargar' };
      copy.append(UI.element('strong', 'app-table-state-title', titles[kind] || 'Listado'), status.text);
      status.show(kind, message);
      if (kind === 'error') {
        const retry = UI.Button.create({ label: 'Reintentar', icon: 'refresh' });
        retry.dataset.tableRetry = '';
        content.append(retry);
      }
      row.append(cell);
      this.body.replaceChildren(row);
      this.updateFooter();
    }

    /** Reinicia búsquedas/orden; un append fallido conserva las filas que ya estaban disponibles. */
    async refresh({ corrected = false, append = false } = {}) {
      if (this.destroyed) return;
      const requestId = ++this.requestId, requestedPage = append ? this.page + 1 : this.page;
      const restoreMore = append && document.activeElement === this.more;
      this.request?.abort(); this.request = new AbortController();
      if (append) {
        this.loadingMore = true; this.appendError = false; this.clearContinuation(); this.updateFooter();
      } else {
        if (this.mode === 'scroll') this.page = 1;
        this.loadingMore = false; this.appendError = false; this.rows = []; this.expanded.clear();
        this.clearContinuation(); this.scroll.scrollTop = 0; this.showState('loading', 'Cargando…');
      }
      const queryPage = append ? requestedPage : this.page;
      try {
        let result;
        if (this.load) {
          result = await this.load({ page: queryPage, pageSize: this.pageSize, query: structuredClone(this.query), sort: this.sort && { ...this.sort }, signal: this.request.signal });
        } else {
          const term = String(this.query.term || '').toLocaleLowerCase(this.locale);
          const filtered = this.records.filter(record => !term || this.columns.some(
            column => String(record[column.key] ?? '').toLocaleLowerCase(this.locale).includes(term)
          ));
          const sorted = this.sortRecords(filtered);
          result = { records: sorted.slice((queryPage - 1) * this.pageSize, queryPage * this.pageSize), total: filtered.length };
        }
        if (this.destroyed || requestId !== this.requestId) return;
        if (!result || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 ||
            result.records.length > this.pageSize || result.records.length > result.total ||
            result.records.some(record => !record || typeof record !== 'object')) throw new TypeError('Respuesta de listado no válida.');
        if (this.actions.length || this.mode === 'scroll') {
          const ids = [...(append ? this.rows : []), ...result.records].map(record => this.getRowId(record));
          if (ids.some(id => !['string', 'number'].includes(typeof id) || String(id) === '') ||
              new Set(ids.map(String)).size !== ids.length) throw new TypeError('Cada fila necesita un identificador único.');
        }
        if (this.mode === 'scroll' && (result.records.length !== Math.max(0, Math.min(this.pageSize, result.total - (queryPage - 1) * this.pageSize)) ||
            (append && result.total !== this.total))) throw new Error('El listado cambió o llegó incompleto.');
        this.total = result.total;
        if (this.mode === 'pages' && this.page > this.totalPages) {
          if (corrected) throw new Error('El listado cambió durante la consulta.');
          this.page = this.totalPages; return this.refresh({ corrected: true });
        }
        const from = append ? this.rows.length : 0;
        this.rows = append ? [...this.rows, ...result.records] : result.records;
        this.page = queryPage; this.loadingMore = false;
        if (this.total > 0 && !this.rows.length) throw new Error('Página incompleta.');
        if (!this.rows.length) return this.showState('empty', 'No hay registros para mostrar.');
        this.renderRows({ append, from });
        this.restoreMoreFocus(restoreMore);
      } catch (error) {
        if (!this.destroyed && requestId === this.requestId) {
          this.loadingMore = false;
          if (append) {
            this.appendError = true; this.continuation.hidden = false;
            this.continuationMessage.show('error', 'No se pudo continuar el listado. Reintenta o actualiza la lista si cambió.');
            this.updateFooter(); this.restoreMoreFocus(restoreMore);
          } else this.showState('error', 'No se pudo cargar el listado. Inténtalo nuevamente.');
        }
      }
    }
    restoreMoreFocus(hadFocus) {
      if (hadFocus && !UI.Modal?.top && document.activeElement === document.body) (this.more.hidden ? this.scroll : this.more).focus({ preventScroll: true });
    }
    clearContinuation() { if (this.continuation) { this.continuationMessage.clear(); this.continuation.hidden = true; } }
    loadMore({ retry = false } = {}) {
      if (this.destroyed || this.mode !== 'scroll' || this.state !== 'ready' || this.loadingMore ||
          (this.appendError && !retry) || this.rows.length >= this.total) return Promise.resolve();
      return this.refresh({ append: true });
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
        return UI.ValueFormat.number(value, { type: column.type, locale: this.locale,
          currency: column.currency || this.currency, decimals: column.decimals ?? 0 });
      }
      return String(value);
    }

    renderRows({ append = false, from = 0 } = {}) {
      if (!append) this.clearMenus();
      this.state = 'ready';
      this.container.setAttribute('aria-busy', 'false');
      const fragment = document.createDocumentFragment();
      this.rows.slice(from).forEach((record, offset) => {
        const index = from + offset;
        const row = UI.element('tr');
        row.dataset.rowIndex = String(index);
        if (this.numbered) row.append(UI.element('td', 'app-table-sequence', this.rowNumber(index)));
        for (const column of this.columns) {
          const cell = UI.element('td', ['number', 'quantity', 'price'].includes(column.type) ? 'app-table-number' : '');
          cell.dataset.columnKey = column.key;
          this.fillCell(cell, column, record);
          if (column === this.columns[0] && this.columns.some(item => (item.priority ?? 0) > 0)) {
            cell.classList.add('app-table-primary');
            const toggle = UI.element('button', 'app-table-details-toggle', 'Ver más'); toggle.type = 'button';
            toggle.dataset.tableDetails = String(index); toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', this.id + '-details-' + index);
            toggle.setAttribute('aria-label', 'Ver más datos de la fila ' + this.rowNumber(index));
            toggle.hidden = true; cell.append(toggle);
          }
          row.append(cell);
        }
        if (this.actions.length) {
          const cell = UI.element('td'), group = UI.element('div', 'app-table-actions');
          const menuItems = [];
          this.actions.forEach((action, actionIndex) => {
            if (action.visible && !action.visible(record)) return;
            const label = typeof action.label === 'function' ? action.label(record) : action.label;
            const disabled = this.pendingRows.has(String(this.getRowId(record))) || Boolean(typeof action.disabled === 'function' ? action.disabled(record) : action.disabled);
            const definition = { ...action, label, disabled, tone: typeof action.tone === 'function' ? action.tone(record) : action.tone };
            if (this.actionDisplay === 'menu') { menuItems.push({ ...definition, iconOnly: false, actionIndex }); return; }
            const button = UI.Button.create(definition);
            button.dataset.tableAction = String(actionIndex);
            button.dataset.rowIndex = String(index);
            group.append(button);
          });
          if (this.actionDisplay === 'menu' && menuItems.length) {
            const menu = new UI.ActionMenu({ container: group, triggerLabel: 'Acciones', label: 'Acciones del registro ' + this.getRowId(record), items: menuItems,
              onSelect: (item, { button }) => this.runAction(item.actionIndex, index, button) });
            menu.trigger.dataset.tableMenuRow = String(index);
            menu.trigger.disabled = this.pendingRows.has(String(this.getRowId(record)));
            this.menus.push(menu);
          }
          cell.append(group); row.append(cell);
        }
        fragment.append(row);
        if (!this.columns.some(item => (item.priority ?? 0) > 0)) return;
        const details = UI.element('tr', 'app-table-details'); details.id = this.id + '-details-' + index;
        details.dataset.detailsIndex = String(index); details.hidden = true;
        const detailsCell = UI.element('td'); detailsCell.colSpan = this.columnCount;
        const list = UI.element('dl');
        for (const column of this.columns.filter(item => (item.priority ?? 0) > 0)) {
          const group = UI.element('div'); group.dataset.detailColumn = column.key;
          const value = UI.element('dd'); this.fillCell(value, column, record);
          group.append(UI.element('dt', '', column.label), value); list.append(group);
        }
        detailsCell.append(list); details.append(detailsCell); fragment.append(details);
      });
      if (append) this.body.append(fragment); else this.body.replaceChildren(fragment);
      this.updatePriorities(true); this.updateFooter();
    }

    /** Un único formateador sirve para celdas y detalles; ningún valor del usuario se interpreta como HTML. */
    fillCell(cell, column, record) {
      const value = record[column.key];
      if (column.type === 'state') {
        const state = column.states && Object.hasOwn(column.states, value) ? column.states[value] : null;
        const tone = state && ['success', 'inactive', 'warning', 'error', 'info', 'neutral'].includes(state.tone) ? state.tone : 'neutral';
        cell.append(UI.element('span', 'app-badge app-badge--' + tone, state?.label || this.format(value, column, record)));
      } else cell.textContent = this.format(value, column, record);
    }
    rowNumber(index) { return (this.mode === 'scroll' ? 0 : (this.page - 1) * this.pageSize) + index + 1; }
    get columnCount() { return this.visibleKeys.size + Number(this.numbered) + (this.actions.length ? 1 : 0); }
    /** Prioridad 0 siempre visible; 1, 2 y 3 aparecen a partir de 520, 780 y 1100 px disponibles. */
    updatePriorities(force = false) {
      if (this.destroyed) return;
      const width = this.container.getBoundingClientRect().width;
      const visible = new Set(this.columns.filter(column => width >= [0, 520, 780, 1100][column.priority ?? 0]).map(column => column.key));
      if (!force && [...visible].join('|') === [...this.visibleKeys].join('|')) return;
      this.visibleKeys = visible;
      for (const cell of this.table.querySelectorAll('[data-column-key]')) {
        if (!visible.has(cell.dataset.columnKey) && cell.contains(document.activeElement)) this.scroll.focus({ preventScroll: true });
        cell.hidden = !visible.has(cell.dataset.columnKey);
      }
      const hasDetails = visible.size < this.columns.length;
      for (const button of this.body.querySelectorAll('[data-table-details]')) {
        if (!hasDetails && button === document.activeElement) this.scroll.focus({ preventScroll: true });
        button.hidden = !hasDetails;
        const open = this.expanded.has(Number(button.dataset.tableDetails));
        button.textContent = open ? 'Ver menos' : 'Ver más'; button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', (open ? 'Ocultar' : 'Ver más') + ' datos de la fila ' + this.rowNumber(Number(button.dataset.tableDetails)));
      }
      for (const row of this.body.querySelectorAll('[data-details-index]')) {
        row.hidden = !hasDetails || !this.expanded.has(Number(row.dataset.detailsIndex));
        row.firstElementChild.colSpan = this.columnCount;
        for (const group of row.querySelectorAll('[data-detail-column]')) group.hidden = visible.has(group.dataset.detailColumn);
      }
      const state = this.body.querySelector('.app-table-state'); if (state) state.colSpan = this.columnCount;
    }
    toggleDetails(button) {
      const index = Number(button.dataset.tableDetails), open = !this.expanded.has(index);
      if (open) this.expanded.add(index); else this.expanded.delete(index);
      this.updatePriorities(true);
    }

    async onClick(event) {
      const button = event.target.closest('button');
      if (!button || !this.container.contains(button) || button.disabled) return;
      if (button.hasAttribute('data-table-details')) return this.toggleDetails(button);
      if (button.hasAttribute('data-table-more')) return this.loadMore({ retry: true });
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
      this.observer?.disconnect();
      this.clearMenus();
      this.events.abort();
      delete this.container.dataset.dataTableMounted;
      this.container.classList.remove('app-data-table', 'app-data-table--scroll', 'app-data-table--fit');
      this.container.removeAttribute('aria-busy');
      this.container.replaceChildren();
    }
  }
  UI.DataTable = DataTable;
})();
