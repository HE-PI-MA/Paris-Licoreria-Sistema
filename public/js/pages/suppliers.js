/** Coordina Proveedores con las clases comunes. No define estilos ni modifica compras o existencias. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class SuppliersPage {
    constructor(element) {
      this.api = new UI.CatalogApi('/api/proveedores');
      this.notifications = new UI.NotificationCenter(); this.events = new AbortController();
      this.dialogs = new Set(); this.operations = new Map();
      this.table = new UI.DataTable({ container: element, caption: 'Proveedores', mode: 'scroll', numbered: true, pageSize: 50,
        load: params => this.api.list(params), sort: { key: 'name', direction: 'asc' }, actionDisplay: 'menu',
        columns: [
          { key: 'name', label: 'Proveedor', sortable: true },
          { key: 'phone', label: 'Teléfono', priority: 1 },
          { key: 'contact', label: 'Contacto', priority: 2 },
          { key: 'state', label: 'Estado', type: 'state', priority: 1, states: {
            ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'inactive' }
          } }
        ],
        actions: [
          { id: 'detail', label: 'Ver detalle', icon: 'info' },
          { id: 'edit', label: 'Editar', icon: 'edit', tone: 'edit' },
          { id: 'state', label: row => row.state === 'ACTIVO' ? 'Desactivar' : 'Activar', icon: 'refresh', tone: row => row.state === 'ACTIVO' ? 'warning' : 'success' },
          { id: 'delete', label: 'Eliminar', icon: 'trash', variant: 'danger' }
        ], onAction: item => this.handle(() => this.action(item))
      });
      this.filters = new UI.FilterBar({ container: document.querySelector('[data-module-region="controls"]'),
        searchInput: document.getElementById('module-search'), mode: 'inline',
        fields: [{ name: 'state', label: 'Estado', type: 'select', control: document.getElementById('module-state'), emptyLabel: 'Todos los estados',
          options: [{ value: 'ACTIVO', label: 'Activos' }, { value: 'INACTIVO', label: 'Inactivos' }] }],
        onChange: query => this.table.setQuery(query)
      });
      document.querySelector('[data-module-primary]').addEventListener('click', event => this.edit(null, event.currentTarget), { signal: this.events.signal });
      window.addEventListener('pagehide', () => this.destroy(), { once: true, signal: this.events.signal });
    }
    async handle(task) {
      try { await task(); }
      catch (error) {
        if (!this.destroyed && error.name !== 'AbortError') this.notifications.show('error', error.userMessage || 'No se pudo completar la operación. Actualiza el listado e inténtalo nuevamente.');
      }
    }
    async saved(message) {
      if (this.destroyed) return;
      window.ParisModule.resetMessage(); this.notifications.show('success', message); await this.table.refresh();
    }
    edit(record, opener) {
      const form = new window.ParisSuppliers.SupplierForm({ api: this.api, record, opener,
        onSaved: () => this.saved(record ? 'Proveedor actualizado correctamente.' : 'Proveedor guardado correctamente.') });
      const onClose = form.modal.onClose;
      form.modal.onClose = value => { onClose(value); this.dialogs.delete(form.modal); };
      this.dialogs.add(form.modal);
    }
    detail(record, opener) {
      const details = new UI.RecordDetails({ record, fields: [
        { key: 'name', label: 'Nombre o empresa', wide: true }, { key: 'contact', label: 'Persona de contacto', empty: 'Sin registrar' },
        { key: 'phone', label: 'Teléfono', empty: 'Sin registrar' }, { key: 'nit', label: 'NIT', empty: 'Sin registrar' },
        { key: 'state', label: 'Estado', type: 'state' }, { key: 'address', label: 'Dirección', wide: true, empty: 'Sin registrar' }
      ] });
      const modal = new UI.Modal({ title: 'Detalle del proveedor', icon: 'truck', content: details.element,
        onClose: () => { modal.destroy(); this.dialogs.delete(modal); } });
      const close = UI.Button.create({ label: 'Cerrar' });
      close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    async action({ action, record, button }) {
      if (action === 'detail' || action === 'edit') {
        const row = await this.api.detail(record.id);
        if (!this.destroyed) return action === 'detail' ? this.detail(row, button) : this.edit(row, button);
        return;
      }
      const deleting = action === 'delete', state = record.state === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const label = deleting ? 'Eliminar' : state === 'ACTIVO' ? 'Activar' : 'Desactivar';
      const confirmed = await UI.Confirm.ask({ title: label + ' proveedor',
        message: deleting ? 'Se eliminará ' + record.name + ' solamente si no tiene compras registradas.' :
          label + ' ' + record.name + '. Se conservarán sus datos y su historial.', confirmLabel: label, danger: deleting || state === 'INACTIVO' });
      if (!confirmed || this.destroyed) return;
      const path = '/' + record.id + (deleting ? '/eliminar' : '/estado');
      if (!this.operations.has(path)) this.operations.set(path, this.api.operation(path));
      // Mantiene la clave cuando se pierde la respuesta; evita aplicar dos veces el mismo intento.
      await this.operations.get(path)({ version: record.version, ...(deleting ? {} : { state }) }, { signal: this.events.signal });
      this.operations.delete(path);
      await this.saved(deleting ? 'Proveedor eliminado.' : 'Estado del proveedor actualizado.');
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; this.events.abort(); this.filters.destroy(); this.table.destroy(); this.notifications.destroy();
      for (const modal of this.dialogs) modal.destroy(); this.dialogs.clear(); this.operations.clear();
    }
  }
  window.ParisSuppliers.SuppliersPage = SuppliersPage;
  const element = document.getElementById('suppliers-table');
  if (element) new SuppliersPage(element);
})();
