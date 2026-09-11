/** Página Productos: coordina consultas, filtros y acciones. La tabla y los formularios conservan responsabilidades independientes. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  class ProductsPage {
    constructor(element) {
      this.element = element; this.api = new Catalog.ProductsApi(); this.notifications = new UI.NotificationCenter();
      this.events = new AbortController(); this.operations = new Map(); this.dialogs = new Set();
      this.table = new UI.DataTable({ container: element, caption: 'Productos', load: params => this.api.list(params), actionDisplay: 'menu',
        columns: [
          { key: 'name', label: 'Producto', sortable: true }, { key: 'category', label: 'Categoría', sortable: true },
          { key: 'unit', label: 'Unidad base' }, { key: 'presentations', label: 'Presentaciones', type: 'number' },
          { key: 'stock', label: 'Stock disponible', type: 'quantity', sortable: true },
          { key: 'minimum', label: 'Stock mínimo', type: 'quantity', sortable: true }, { key: 'state', label: 'Estado', type: 'state', sortable: true, states: { ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'neutral' } } }
        ], sort: { key: 'name', direction: 'asc' },
        actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }, { id: 'edit', label: 'Editar', icon: 'edit' },
          { id: 'presentations', label: 'Presentaciones', icon: 'box' }, ...this.stateActions()],
        onAction: item => this.handle(() => this.action(item))
      });
      this.filters = new UI.FilterBar({ container: document.querySelector('[data-module-region="controls"]'),
        searchInput: document.getElementById('module-search'), filterButton: document.querySelector('.module-filter-button'),
        fields: [{ name: 'categoryId', label: 'Categoría', type: 'search', load: params => this.api.options('categories', params) },
          { name: 'state', label: 'Estado', type: 'select', options: [{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }] },
          { name: 'lowStock', label: 'Stock mínimo', type: 'select', options: [{ value: 'SI', label: 'En el mínimo o por debajo' }, { value: 'NO', label: 'Por encima del mínimo' }] }],
        onChange: query => this.table.setQuery(query)
      });
      document.querySelector('[data-module-primary]').addEventListener('click', event => this.openProduct(null, event.currentTarget), { signal: this.events.signal });
      window.addEventListener('pagehide', () => this.destroy(), { once: true, signal: this.events.signal });
    }
    stateActions() { return [
      { id: 'state', label: row => row.state === 'ACTIVO' ? 'Desactivar' : 'Activar', icon: 'refresh' },
      { id: 'delete', label: 'Eliminar', icon: 'trash', variant: 'danger' }
    ]; }
    async handle(task, alert) {
      try { await task(); }
      catch (error) {
        if (this.destroyed || error.name === 'AbortError') return;
        const text = error.userMessage || 'No se pudo completar la operación. Actualiza el listado e inténtalo nuevamente.';
        if (alert) alert.show('error', text); else window.ParisModule.showMessage('error', text);
      }
    }
    async saved(message) {
      window.ParisModule.resetMessage(); this.notifications.show('success', message); await this.table.refresh();
    }
    openProduct(record, opener) {
      const form = new Catalog.ProductForm({ api: this.api, record, opener, onSaved: () => this.saved(record ? 'Producto actualizado correctamente.' : 'Producto guardado. Ya puedes agregar sus presentaciones.') });
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
      const content = UI.element('dl', 'product-details');
      const values = [['Producto', row.name], ['Categoría', row.category], ['Unidad base', row.unit], ['Stock disponible', row.stock],
        ['Stock físico', row.physicalStock], ['Stock mínimo', row.minimum], ['Presentaciones', row.presentations], ['Estado', row.state === 'ACTIVO' ? 'Activo' : 'Inactivo'], ['Descripción', row.description || 'Sin descripción']];
      for (const [label, value] of values) { const group = UI.element('div'); group.append(UI.element('dt', '', label), UI.element('dd', '', value)); content.append(group); }
      const modal = new UI.Modal({ title: 'Detalle del producto', content, onClose: () => { modal.destroy(); this.dialogs.delete(modal); } });
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    presentations(product, opener) {
      const content = UI.element('div'), toolbar = UI.element('div', 'product-presentations-toolbar');
      const help = UI.element('p', 'app-field-help', product.state === 'ACTIVO' ? 'Equivalencias en ' + product.unit + '. Los precios se expresan en bolivianos.' : 'Producto inactivo. Actívalo para agregar o activar presentaciones.');
      const add = UI.Button.create({ label: 'Nueva presentación', icon: 'plus', variant: 'primary', disabled: product.state !== 'ACTIVO' });
      toolbar.append(help, add); const host = UI.element('div'); content.append(toolbar, host);
      const alert = UI.Message.create(content);
      let table;
      const modal = new UI.Modal({ title: 'Presentaciones: ' + product.name, size: 'large', content,
        onClose: () => { table?.destroy(); modal.destroy(); this.dialogs.delete(modal); }
      });
      const saved = async () => { alert.show('success', 'Presentación guardada correctamente.'); await table.refresh(); await this.table.refresh(); };
      const edit = (row, button) => {
        const form = new Catalog.PresentationForm({ api: this.api, product, record: row, opener: button, onSaved: saved });
        const onClose = form.modal.onClose;
      form.modal.onClose = value => { onClose(value); this.dialogs.delete(form.modal); };
      this.dialogs.add(form.modal);
      };
      add.addEventListener('click', () => edit(null, add), { signal: modal.events.signal });
      table = new UI.DataTable({ container: host, caption: 'Presentaciones de ' + product.name, load: params => this.api.presentations(product.id, params),
        columns: [{ key: 'name', label: 'Presentación', sortable: true }, { key: 'factor', label: 'Equivalencia', type: 'quantity', sortable: true },
          { key: 'barcode', label: 'Código de barras' }, { key: 'price', label: 'Precio (Bs)', type: 'price', sortable: true }, { key: 'state', label: 'Estado', type: 'state', sortable: true, states: { ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'neutral' } } }],
        sort: { key: 'name', direction: 'asc' }, actionDisplay: 'menu', actions: [{ id: 'edit', label: 'Editar', icon: 'edit' }, ...this.stateActions()],
        onAction: ({ action, record, button }) => this.handle(async () => {
          alert.clear();
          if (action === 'edit') return edit(await this.api.presentation(product.id, record.id), button);
          return this.change(action, record, '/' + product.id + '/presentaciones/' + record.id, async () => {
            alert.show('success', action === 'delete' ? 'Presentación eliminada.' : 'Estado de la presentación actualizado.'); await table.refresh(); await this.table.refresh();
          });
        }, alert)
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
