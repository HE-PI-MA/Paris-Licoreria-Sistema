/**
 * Demostración de componentes compartidos; todos los datos son ficticios y viven en memoria.
 * Simula consultas por página y operaciones lentas sin acceder a APIs de negocio ni a MySQL.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;

  class ComponentsDemo {
    constructor(element) {
      this.element = element;
      this.events = new AbortController();
      this.notifications = new UI.NotificationCenter();
      this.resetRecords();
      this.failNext = false;
      this.table = new UI.DataTable({
        container: element.querySelector('[data-demo-table]'),
        caption: 'Registros ficticios de la demostración',
        columns: [
          { key: 'id', label: 'Código', type: 'number', sortable: true },
          { key: 'name', label: 'Nombre', type: 'text', sortable: true },
          { key: 'quantity', label: 'Cantidad', type: 'quantity' },
          { key: 'price', label: 'Precio', type: 'price', sortable: true },
          { key: 'date', label: 'Fecha', type: 'date', sortable: true },
          { key: 'state', label: 'Estado', type: 'state', states: {
            ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'inactive' }
          } }
        ],
        actions: [
          { id: 'edit', label: row => 'Editar ' + row.name, icon: 'edit', iconOnly: true },
          { id: 'toggle', label: row => row.state === 'ACTIVO' ? 'Desactivar' : 'Activar', icon: 'success' },
          { id: 'delete', label: row => 'Eliminar ' + row.name, icon: 'trash', iconOnly: true, variant: 'danger' }
        ],
        load: request => this.loadPage(request),
        onAction: event => this.onAction(event)
      });
      document.querySelector('[data-module-primary]').addEventListener('click', event => this.openForm(null, false, event.currentTarget), { signal: this.events.signal });
      this.filters = new UI.FilterBar({
        container: document.querySelector('[data-module-region="controls"]'),
        searchInput: document.getElementById('module-search'), filterButton: document.querySelector('.module-filter-button'),
        fields: [
          { name: 'state', label: 'Estado', type: 'select', options: [{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }] },
          { name: 'provider', label: 'Proveedor de ejemplo', type: 'search', load: request => this.loadProviders(request) },
          { name: 'dates', label: 'Fecha de ejemplo', type: 'dates' }
        ],
        onChange: query => this.table.setQuery(query)
      });
      element.querySelector('[data-demo-menu]').addEventListener('change', event => {
        this.table.setActionDisplay(event.target.checked ? 'menu' : 'buttons');
      }, { signal: this.events.signal });
      element.addEventListener('click', event => this.onDemoClick(event), { signal: this.events.signal });
    }

    resetRecords() {
      this.records = Array.from({ length: 37 }, (_, index) => ({
        id: index + 1, name: 'Producto de ejemplo ' + String(index + 1).padStart(2, '0'),
        quantity: 10 + index * 2, price: 12.5 + index * 3.25,
        state: index % 5 === 0 ? 'INACTIVO' : 'ACTIVO', description: '',
        provider: 'p' + (index % 3 + 1), date: '2026-09-' + String(index % 30 + 1).padStart(2, '0')
      }));
      this.nextId = 38;
    }

    wait(signal, delay = this.element.querySelector('[data-demo-slow]').checked ? 600 : 0) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
        const abort = () => { window.clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
        const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
        signal.addEventListener('abort', abort, { once: true });
      });
    }

    async loadPage({ page, pageSize, query, sort, signal }) {
      await this.wait(signal);
      if (this.failNext) { this.failNext = false; throw new Error('Fallo de demostración.'); }
      const filtered = this.records.filter(row =>
        (!query.term || row.name.toLocaleLowerCase('es').includes(query.term.toLocaleLowerCase('es'))) &&
        (!query.state || row.state === query.state) &&
        (!query.provider || row.provider === query.provider) &&
        (!query.dates?.from || row.date >= query.dates.from) && (!query.dates?.to || row.date <= query.dates.to)
      );
      // Representa el trabajo del servidor: filtrar y ordenar ANTES de extraer la página.
      if (sort) {
        if (!['id', 'name', 'price', 'date'].includes(sort.key) || !['asc', 'desc'].includes(sort.direction)) throw new Error('Orden no permitido.');
        filtered.sort((a, b) => (typeof a[sort.key] === 'number' ? a[sort.key] - b[sort.key] :
          String(a[sort.key]).localeCompare(String(b[sort.key]), 'es', { numeric: true })) * (sort.direction === 'asc' ? 1 : -1));
      }
      return { records: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
    }

    onDemoClick(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.demoNotification) {
        this.notifications.show(button.dataset.demoNotification, 'Aviso de prueba: ' + button.textContent.trim() + '.');
        return;
      }
      switch (button.dataset.demo) {
        case 'long': this.openForm(null, true, button); break;
        case 'empty': this.records = []; this.table.refresh(); break;
        case 'error': this.failNext = true; this.table.refresh(); break;
        case 'reset':
          this.resetRecords();
          this.table.sort = null; this.table.updateSortHeaders();
          this.filters.setValue({});
          window.ParisModule.resetMessage();
          break;
      }
    }

    openForm(record, long, opener) {
      if (this.modal?.element.open) return;
      const form = document.getElementById('demo-form-template').content.firstElementChild.cloneNode(true);
      form.id = 'demo-form';
      for (const key of ['name', 'price', 'state', 'description']) {
        form.elements.namedItem(key).value = record?.[key] ?? (key === 'state' ? 'ACTIVO' : '');
      }
      const provider = new UI.SearchSelect({ select: form.querySelector('[name=provider]'), load: request => this.loadProviders(request) });
      if (record?.provider) provider.setValue({ value: record.provider, label: 'Proveedor ficticio ' + record.provider.slice(1).padStart(2, '0') });
      if (long) {
        for (let index = 1; index <= 12; index++) {
          const field = UI.element('div', 'app-field'), label = UI.element('label', 'app-label', 'Observación de prueba ' + index);
          const input = UI.element('textarea', 'app-input');
          input.id = label.htmlFor = 'demo-long-' + index; input.name = 'note' + index;
          field.append(label, input); form.querySelector('.app-form-grid').append(field);
        }
      }
      let controller;
      const modal = this.modal = new UI.Modal({
        title: record ? 'Editar registro ficticio' : 'Nuevo registro ficticio',
        size: long ? 'large' : 'medium', content: form,
        isDirty: () => controller?.isDirty(),
        onClose: () => { controller?.destroy(); provider.destroy(); modal.destroy(); this.modal = null; }
      });
      const cancel = UI.Button.create({ label: 'Cancelar' });
      cancel.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      const save = UI.Button.create({ label: 'Guardar', icon: 'success', type: 'submit', variant: 'primary' });
      save.setAttribute('form', form.id);
      modal.footer.append(cancel, save);
      // El formulario debe estar conectado para asociar el botón Guardar mediante su atributo form.
      modal.open(opener);
      controller = new UI.FormController({
        form, modal, alert: UI.Message.create(form.querySelector('[data-demo-form-alert]')),
        validate: values => values.name.trim().length < 2 ? { name: 'Escribe al menos 2 caracteres.' } : {},
        onSubmit: async (values, { signal }) => {
          await this.wait(signal, 900);
          if (values.fail) throw new Error('Fallo simulado al guardar.');
          const row = { id: record?.id || this.nextId++, name: values.name.trim(), price: Number(values.price),
            state: values.state, description: values.description, quantity: record?.quantity || 0,
            provider: values.provider, date: record?.date || '2026-09-11' };
          if (record) this.records = this.records.map(item => item.id === record.id ? row : item);
          else this.records.unshift(row);
          return row;
        },
        onSuccess: async () => {
          modal.close();
          this.notifications.show('success', 'Registro ficticio guardado correctamente.');
          await this.table.refresh();
        }
      });
    }

    /** Fuente ficticia paginada para probar SearchSelect; no consulta proveedores reales. */
    async loadProviders({ term, page, pageSize, signal }) {
      await this.wait(signal);
      const options = Array.from({ length: 63 }, (_, index) => ({ value: 'p' + (index + 1), label: 'Proveedor ficticio ' + String(index + 1).padStart(2, '0') }))
        .filter(item => item.label.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es')));
      return { options: options.slice((page - 1) * pageSize, page * pageSize), total: options.length };
    }

    async onAction({ action, record, button }) {
      if (action === 'edit') return this.openForm(record, false, button);
      const removing = action === 'delete';
      const verb = removing ? 'Eliminar' : record.state === 'ACTIVO' ? 'Desactivar' : 'Activar';
      if (!await UI.Confirm.ask({ title: verb + ' registro ficticio',
        message: '¿Quieres ' + verb.toLowerCase() + ' “' + record.name + '” en esta demostración?',
        confirmLabel: verb, danger: removing })) return;
      if (removing) this.records = this.records.filter(row => row.id !== record.id);
      else record.state = record.state === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      this.notifications.show('success', 'Acción de prueba completada.');
      await this.table.refresh();
    }

    destroy() {
      this.events.abort();
      this.filters.destroy();
      this.modal?.destroy();
      this.table.destroy();
      this.notifications.destroy();
    }
  }

  const element = document.querySelector('[data-components-demo]');
  if (element) {
    const demo = new ComponentsDemo(element);
    window.addEventListener('pagehide', event => { if (!event.persisted) demo.destroy(); }, { once: true });
  }
})();
