/** Página Productos: coordina consultas, filtros y acciones. La tabla y los formularios conservan responsabilidades independientes. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  class ProductsPage {
    constructor(element) {
      this.api = new Catalog.ProductsApi(); this.notifications = UI.NotificationCenter.shared();
      this.events = new AbortController(); this.operations = new Map(); this.dialogs = new Set();
      this.table = new UI.DataTable({ container: element, caption: 'Productos', mode: 'scroll', numbered: true, pageSize: 50, load: params => this.api.list(params), actionDisplay: 'menu',
        columns: [
          { key: 'photoHash', label: 'Foto', type: 'photo' },
          { key: 'name', label: 'Producto', sortable: true }, { key: 'category', label: 'Categoría', sortable: true, priority: 2 },
          { key: 'unit', label: 'Se cuenta en', priority: 2 },
          { key: 'stock', label: 'Disponible', type: 'quantity', sortable: true, priority: 1 },
          { key: 'presentations', label: 'Formas de venta', type: 'number', priority: 1 },
          { key: 'state', label: 'Estado', type: 'state', sortable: true, priority: 1, states: { ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'inactive' } } }
        ], sort: { key: 'name', direction: 'asc' },
        actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }, { id: 'edit', label: 'Editar', icon: 'edit', tone: 'edit' },
          { id: 'presentations', label: row => Number(row.presentations) > 0 ? 'Presentaciones' : 'Configurar venta', icon: 'box', tone: 'catalog' }, ...this.stateActions()],
        onAction: item => this.handle(() => this.action(item))
      });
      this.filters = new UI.FilterBar({ container: document.querySelector('[data-module-region="controls"]'),
        mode: 'inline', searchInput: document.getElementById('module-search'),
        fields: [{ name: 'categoryId', label: 'Categoría', type: 'select', control: document.getElementById('module-category'),
          emptyLabel: 'Todas las categorías', load: params => this.api.options('categories', params) }],
        onChange: query => this.table.setQuery(query)
      });
      window.addEventListener('pagehide', () => this.destroy(), { once: true, signal: this.events.signal });
    }
    stateActions() { return [
      { id: 'state', label: row => row.state === 'ACTIVO' ? 'Desactivar' : 'Activar', icon: 'refresh', tone: row => row.state === 'ACTIVO' ? 'warning' : 'success' },
      { id: 'delete', label: 'Eliminar', icon: 'trash', variant: 'danger' }
    ]; }
    async handle(task) {
      try { await task(); }
      catch (error) {
        if (this.destroyed || error.name === 'AbortError') return;
        const text = error.userMessage || 'No se pudo completar la operación. Actualiza el listado e inténtalo nuevamente.';
        this.notifications.show('error', text);
      }
    }
    /** Confirma el resultado con la notificación compartida y actualiza los listados afectados. */
    async saved(message, table = this.table) {
      window.ParisModule.resetMessage(); this.notifications.show('success', message);
      await table.refresh();
      if (table !== this.table) await this.table.refresh();
    }
    openProduct(record, opener) {
      if (!record) return;
      const form = new Catalog.ProductForm({
        api: this.api,
        record,
        opener,
        onSaved: () => this.saved('Producto actualizado correctamente.')
      });
      const onClose = form.modal.onClose;
      form.modal.onClose = value => { onClose(value); this.dialogs.delete(form.modal); };
      this.dialogs.add(form.modal);
    }
    async action({ action, record, button }) {
      if (action === 'edit') return this.openProduct(await this.api.detail(record.id), button);
      if (action === 'detail') return this.detail(await this.api.detail(record.id), button);
      if (action === 'presentations') return this.presentations(await this.api.detail(record.id), button);
      return this.change(action, record, '/' + record.id, () => this.saved(action === 'delete' ? 'Producto eliminado.' : 'Estado del producto actualizado.'));
    }
    /** El mismo identificador se reutiliza al repetir una acción cuya respuesta pudo perderse. */
    async change(action, row, base, onSaved) {
      const deleting = action === 'delete', state = row.state === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const label = deleting ? 'Eliminar' : state === 'ACTIVO' ? 'Activar' : 'Desactivar';
      const confirmed = await UI.Confirm.ask({ title: label + ' ' + row.name,
        message: deleting ? 'Se eliminará este registro y, si es un producto, sus presentaciones sin uso. Si tiene compras o ventas, se conservará y podrás desactivarlo.' :
          state === 'INACTIVO' ? 'El registro dejará de estar disponible para nuevas operaciones. Se conservará su historial.' : 'El registro volverá a estar disponible para nuevas operaciones.',
        confirmLabel: label, danger: deleting || state === 'INACTIVO'
      });
      if (!confirmed || this.destroyed) return;
      const path = base + (deleting ? '/eliminar' : '/estado');
      if (!this.operations.has(path)) this.operations.set(path, this.api.operation(path));
      // El modal padre, si existe, permanece visible y bloqueado mientras termina la escritura.
      const parent = UI.Modal.top; parent?.setBusy(true);
      try {
        await this.operations.get(path)({ version: row.version, ...(deleting ? {} : { state }) });
        this.operations.delete(path); await onSaved();
      } finally { parent?.setBusy(false); }
    }
    detail(row, opener) {
      const details = new UI.RecordDetails({ record: row, fields: [
        { key: 'photoHash', label: 'Foto', type: 'photo', wide: true },
        { key: 'name', label: 'Producto', wide: true }, { key: 'category', label: 'Categoría' },
        { key: 'unit', label: 'Se cuenta en' }, { key: 'stock', label: 'Disponible', type: 'quantity' },
        { key: 'physicalStock', label: 'Stock físico', type: 'quantity' },
        { key: 'presentations', label: 'Formas de venta', type: 'number' },
        { key: 'state', label: 'Estado', type: 'state', wide: true }
      ] });
      const modal = new UI.Modal({ title: 'Detalle del producto', icon: 'box', content: details.element,
        onClose: () => { modal.destroy(); this.dialogs.delete(modal); } });
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    presentations(product, opener) {
      const content = UI.element('div'), toolbar = UI.element('div', 'app-section-toolbar');
      const help = UI.element('p', 'app-field-help', product.state === 'ACTIVO' ? 'Se cuenta en ' + product.unit + '. Cada forma de venta tiene su propio precio y código de barras.' : 'Producto inactivo. Actívalo para agregar o activar presentaciones.');
      const add = UI.Button.create({ label: 'Nueva presentación', icon: 'plus', variant: 'primary', disabled: product.state !== 'ACTIVO' });
      toolbar.append(help, add); const host = UI.element('div'); content.append(toolbar, host);
      let table;
      const modal = new UI.Modal({ title: 'Presentaciones: ' + product.name, icon: 'box', size: 'large', content,
        onClose: () => { table?.destroy(); modal.destroy(); this.dialogs.delete(modal); }
      });
      // Los resultados y errores utilizan la misma instancia global, sobre el modal activo.
      const saved = (message = 'Presentación guardada correctamente.') => this.saved(message, table);
      const edit = (row, button) => {
        const form = new Catalog.PresentationForm({ api: this.api, product, record: row, opener: button, onSaved: () => saved() });
        const onClose = form.modal.onClose;
        form.modal.onClose = value => { onClose(value); this.dialogs.delete(form.modal); };
        this.dialogs.add(form.modal);
      };
      const detail = (row, button) => {
        const details = new UI.RecordDetails({ record: row, fields: [
          { key: 'name', label: 'Presentación', wide: true },
          { key: 'factor', label: 'Cuánto trae', type: 'quantity' },
          { key: 'barcode', label: 'Código de barras', empty: 'Sin registrar' },
          { key: 'price', label: 'Precio de venta', type: 'price' },
          { key: 'state', label: 'Estado', type: 'state' }
        ] });
        const detailModal = new UI.Modal({ title: 'Detalle de presentación', icon: 'box', content: details.element,
          onClose: () => { detailModal.destroy(); this.dialogs.delete(detailModal); } });
        const close = UI.Button.create({ label: 'Cerrar' });
        close.addEventListener('click', () => detailModal.requestClose(), { signal: detailModal.events.signal });
        detailModal.footer.append(close); this.dialogs.add(detailModal); detailModal.open(button);
      };
      add.addEventListener('click', () => edit(null, add), { signal: modal.events.signal });
      table = new UI.DataTable({ container: host, caption: 'Presentaciones de ' + product.name, numbered: true, mode: 'scroll', fillHeight: false, pageSize: 50, load: params => this.api.presentations(product.id, params),
        columns: [{ key: 'name', label: 'Presentación', sortable: true }, { key: 'factor', label: 'Cuánto trae', type: 'quantity', sortable: true, priority: 1 },
          { key: 'barcode', label: 'Código de barras', priority: 2 }, { key: 'price', label: 'Precio (Bs)', type: 'price', sortable: true }, { key: 'state', label: 'Estado', type: 'state', sortable: true, priority: 1, states: { ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'inactive' } } }],
        sort: { key: 'name', direction: 'asc' }, actionDisplay: 'menu', actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }, { id: 'edit', label: 'Editar', icon: 'edit', tone: 'edit' }, ...this.stateActions()],
        onAction: ({ action, record, button }) => this.handle(async () => {
          if (action === 'detail') return detail(await this.api.presentation(product.id, record.id), button);
          if (action === 'edit') return edit(await this.api.presentation(product.id, record.id), button);
          return this.change(action, record, '/' + product.id + '/presentaciones/' + record.id,
            () => saved(action === 'delete' ? 'Presentación eliminada.' : 'Estado de la presentación actualizado.'));
        })
      });
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; this.events.abort(); this.filters.destroy(); this.table.destroy(); this.notifications.destroy();
      for (const modal of this.dialogs) modal.destroy(); this.dialogs.clear(); this.operations.clear();
    }
  }
  Catalog.ProductsPage = ProductsPage;
  const element = document.getElementById('products-table');
  if (element) new ProductsPage(element);
})();
