/** Usuarios U039: administración de cuentas y roles sin exponer hashes de contraseña. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  const field = (label, input, { wide = false, help = '' } = {}) => {
    const host = UI.element('div', 'app-field' + (wide ? ' app-field--wide' : '')), caption = UI.element('label', 'app-label', label);
    caption.htmlFor = input.id; host.append(caption, input); if (help) host.append(UI.element('p', 'app-field-help', help)); return host;
  };
  class UserForm {
    constructor({ api, record = null, opener, onSaved }) {
      this.api = api; this.record = record; this.selectors = []; this.form = UI.element('form', 'app-form'); this.form.id = 'user-form-' + (record?.id || 'new');
      const grid = UI.element('div', 'app-form-grid'); this.form.append(grid);
      const input = (name, label, options = {}) => {
        const node = UI.element('input', 'app-input'); node.id = this.form.id + '-' + name; node.name = name; node.type = options.type || 'text'; node.value = options.value ?? ''; node.required = Boolean(options.required); if (options.maxLength) node.maxLength = options.maxLength; if (options.autocomplete) node.autocomplete = options.autocomplete; if (options.uppercase) node.dataset.uppercase = ''; grid.append(field(label + (options.required ? ' *' : ''), node, { wide: options.wide, help: options.help || '' })); return node;
      };
      this.name = input('name', 'Nombre', { value: record?.name, required: true, maxLength: 80, uppercase: true });
      this.surname = input('surname', 'Apellido', { value: record?.surname, required: true, maxLength: 80, uppercase: true });
      this.username = input('username', 'Nombre de usuario', { value: record?.username, required: true, maxLength: 50, autocomplete: 'off', help: 'De 3 a 50 letras, números, punto, guion o guion bajo.' });
      this.role = UI.element('select', 'app-input'); this.role.id = this.form.id + '-role'; this.role.name = 'role'; this.role.required = true;
      for (const [value, label] of [['ADMINISTRADOR','Administrador'],['ENCARGADO_VENTA','Encargado de venta']]) { const option = UI.element('option', '', label); option.value = value; this.role.append(option); } this.role.value = record?.role || 'ENCARGADO_VENTA'; grid.append(field('Rol *', this.role)); this.selectors.push(new UI.SearchSelect({ select: this.role, searchable: false }));
      if (record) { this.state = UI.element('select', 'app-input'); this.state.id = this.form.id + '-state'; this.state.name = 'state'; this.state.required = true; for (const [value,label] of [['ACTIVO','Activo'],['INACTIVO','Inactivo']]) { const option=UI.element('option','',label); option.value=value; this.state.append(option); } this.state.value=record.state; grid.append(field('Estado *',this.state)); this.selectors.push(new UI.SearchSelect({select:this.state,searchable:false})); }
      this.password = input('password', record ? 'Nueva contraseña' : 'Contraseña', { type: 'password', required: !record, maxLength: 72, autocomplete: 'new-password', wide: true, help: record ? 'Déjalo vacío para conservar la contraseña actual. Mínimo 8 caracteres.' : 'Mínimo 8 caracteres.' });
      let controller; this.modal = new UI.Modal({ title: record ? 'Editar usuario' : 'Nuevo usuario', icon: 'users', size: 'medium', content: this.form, isDirty: () => controller?.isDirty(), onClose: () => { controller?.destroy(); this.selectors.forEach(item => item.destroy()); this.modal.destroy(); } });
      const cancel = UI.Button.create({ label: 'Cancelar' }), save = UI.Button.create({ label: 'Guardar', icon: 'success', variant: 'primary', type: 'submit' }); save.setAttribute('form', this.form.id); cancel.addEventListener('click', () => this.modal.requestClose(), { signal: this.modal.events.signal }); this.modal.footer.append(cancel, save);
      const send = api.operation(record ? '/' + record.id : '');
      controller = new UI.FormController({ form: this.form, modal: this.modal, validate: values => this.validate(values), onSubmit: (values, options) => send(this.payload(values), options), onSuccess: async result => { this.modal.close(); await onSaved(result); } }); this.controller = controller;
      this.modal.open(opener); this.name.focus();
    }
    validate(values) {
      const errors = {}; if (!/^[A-Za-z0-9._-]{3,50}$/.test(values.username || '')) errors.username = 'Usa de 3 a 50 letras, números, punto, guion o guion bajo.';
      if ((!this.record || values.password) && (values.password || '').length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'; return errors;
    }
    payload(values) { const data = { name: values.name, surname: values.surname, username: values.username, role: values.role, password: values.password || '' }; if (this.record) data.state = values.state; return data; }
  }
  class UsersPage {
    constructor(host) {
      this.api = new UI.CatalogApi('/api/usuarios'); this.events = new AbortController(); this.notifications = UI.NotificationCenter.shared(); this.dialogs = new Set();
      this.table = new UI.DataTable({ container: host, caption: 'Usuarios', mode: 'scroll', numbered: true, pageSize: 50, load: params => this.api.list(params), sort: { key: 'name', direction: 'asc' }, actionDisplay: 'menu', columns: [
        { key: 'name', label: 'Nombre', sortable: true, format: (_, row) => `${row.name} ${row.surname}`.trim() }, { key: 'username', label: 'Usuario', sortable: true },
        { key: 'role', label: 'Rol', sortable: true, priority: 1, format: value => value === 'ADMINISTRADOR' ? 'Administrador' : 'Encargado de venta' },
        { key: 'state', label: 'Estado', type: 'state', sortable: true, states: { ACTIVO: { label: 'Activo', tone: 'success' }, INACTIVO: { label: 'Inactivo', tone: 'inactive' } } }
      ], actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }, { id: 'edit', label: 'Editar usuario', icon: 'edit', tone: 'edit' }], onAction: item => this.action(item) });
      this.filters = new UI.FilterBar({ container: document.querySelector('[data-module-region="controls"]'), searchInput: document.getElementById('module-search'), mode: 'inline', fields: [{ name: 'state', label: 'Estado', type: 'select', control: document.getElementById('module-state'), emptyLabel: 'Todos los estados', options: [{ value: 'ACTIVO', label: 'Activos' }, { value: 'INACTIVO', label: 'Inactivos' }] }], onChange: query => this.table.setQuery(query) });
      document.querySelector('[data-module-primary]').addEventListener('click', event => this.edit(null, event.currentTarget), { signal: this.events.signal }); window.addEventListener('pagehide', () => this.destroy(), { once: true, signal: this.events.signal });
    }
    track(form) { const modal = form.modal; this.dialogs.add(modal); const close = modal.onClose; modal.onClose = value => { close(value); this.dialogs.delete(modal); }; }
    edit(record, opener) { this.track(new UserForm({ api: this.api, record, opener, onSaved: async () => { this.notifications.show('success', record ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'); await this.table.refresh(); } })); }
    async action({ action, record, button }) { try { const detail = await this.api.detail(record.id); if (action === 'edit') return this.edit(detail, button); this.detail(detail, button); } catch (error) { this.notifications.show('error', error.userMessage || 'No se pudo consultar el usuario.'); } }
    detail(record, opener) {
      const details = new UI.RecordDetails({ record, fields: [{ key: 'name', label: 'Nombre' }, { key: 'surname', label: 'Apellido' }, { key: 'username', label: 'Usuario' }, { key: 'role', label: 'Rol' }, { key: 'state', label: 'Estado', type: 'state' }] });
      const modal = new UI.Modal({ title: 'Detalle del usuario', icon: 'users', content: details.element, onClose: () => { modal.destroy(); this.dialogs.delete(modal); } }), close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal }); modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    destroy() { if (this.destroyed) return; this.destroyed = true; this.events.abort(); this.filters.destroy(); this.table.destroy(); this.notifications.destroy(); for (const modal of this.dialogs) modal.destroy(); this.dialogs.clear(); }
  }
  const host = document.getElementById('users-table'); if (host) new UsersPage(host);
})();
