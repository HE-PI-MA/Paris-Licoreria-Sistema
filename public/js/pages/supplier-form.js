/** Campos de Proveedores. Hereda el modal, validación y envío único del formulario compartido. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class SupplierForm extends UI.CatalogForm {
    constructor(options) {
      super({ ...options, title: options.record ? 'Editar proveedor' : 'Nuevo proveedor', icon: options.record ? 'edit' : 'plus' });
      const row = this.record;
      this.field('name', 'Nombre o empresa', { value: row?.name, required: true, maxLength: 120, wide: true });
      this.field('contact', 'Persona de contacto', { value: row?.contact, maxLength: 100, uppercase: true });
      this.field('phone', 'Teléfono', { value: row?.phone, type: 'tel', maxLength: 30 });
      this.field('nit', 'NIT', { value: row?.nit, maxLength: 30, inputMode: 'numeric', pattern: '[0-9]{1,30}' });
      this.state(row?.state);
      this.field('address', 'Dirección', { type: 'textarea', value: row?.address, maxLength: 200, wide: true, uppercase: true });
      this.start(row ? '/' + row.id + '/editar' : '', values => ({ ...values, ...(row ? { version: row.version } : {}) }));
    }
  }
  window.ParisSuppliers = { SupplierForm };
})();
