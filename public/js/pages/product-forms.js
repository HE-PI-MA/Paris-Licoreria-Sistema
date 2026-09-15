/** Formularios del catálogo. La clase base compone Modal/FormController; las clases hijas declaran únicamente sus campos y datos. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  const CatalogForm = UI.CatalogForm;
  class ProductForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar producto' : 'Nuevo producto' });
      const row = this.record;
      if (row) { this.photo = new UI.PhotoField({ container: this.grid, form: this.form, modal: this.modal }); this.photo.reset(row); }
      else { this.capture = new Catalog.ProductCapture(this, options.onExisting); this.photo = this.capture.photo; }
      this.field('name', 'Nombre del producto', { value: row?.name, required: true, maxLength: 120, wide: true, placeholder: 'Ej.: Coca-Cola 2 litros' });
      this.selector('categoryId', 'Categoría', 'categories', row && { value: row.categoryId, label: row.category }, undefined, this.api, 'Ej.: Aguas o gaseosas', { allowCustom: !row, maxLength: 80 });
      const unit = this.selector('unitId', '¿Cómo lo cuentas?', 'units', row && { value: row.unitId, label: row.unit }, undefined, this.api, 'Ej.: Unidad o gramo');
      if (row?.presentations > 0) {
        unit.disabled = true;
        this.grid.append(UI.element('p', 'app-field-help app-field--wide', 'La forma de contar se conserva porque el producto ya tiene formas de venta.'));
      }
      this.field('minimum', 'Stock mínimo', { type: 'number', value: row?.minimum ?? '0', min: '0', max: '999999999999.999', step: '0.001', required: true });
      this.state(row?.state);
      this.field('description', 'Descripción', { type: 'textarea', value: row?.description, maxLength: 255, wide: true });
      this.capture?.fields();
      this.start(row ? '/' + row.id + '/editar' : '', ({ photoState, categoryIdText, categoryId, ...values }) => ({
        ...(this.capture ? this.capture.payload({ ...values, ...(categoryId ? { categoryId } : { categoryName: categoryIdText }) }) : { ...values, categoryId }), ...this.photo.payload(),
        ...(row ? { unitId: unit.disabled ? String(row.unitId) : values.unitId, version: row.version } : {})
      }), this.capture?.scan);
    }
  }
  class PresentationForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar presentación' : 'Nueva presentación' });
      const row = this.record, parent = options.product;
      this.form.prepend(UI.element('p', 'app-field-help', 'Producto: ' + parent.name + '. Se cuenta en: ' + parent.unit + '.'));
      this.field('name', 'Forma de venta', { value: row?.name, required: true, maxLength: 80, help: 'Por ejemplo: botella, paquete de 6 o caja de 12.', wide: true });
      const factor = this.field('factor', '¿Cuánto trae?', { type: 'number', value: row?.factor ?? '1', min: '0.001', max: '999999999999.999', step: '0.001', required: true,
        help: row?.used ? 'No puede cambiarse: esta presentación ya tiene compras o ventas.' : 'Una botella: 1. Un paquete de 6: 6. Un kilo contado en gramos: 1000.' });
      factor.readOnly = Boolean(row?.used);
      this.field('price', 'Precio de venta (Bs)', { type: 'number', value: row?.price ?? '0', min: '0', max: '9999999999999.99', step: '0.01', required: true });
      const barcode = this.field('barcode', 'Código de barras', { value: row?.barcode, maxLength: 50, help: 'Opcional. Debe ser único entre todas las presentaciones.' });
      new UI.BarcodeField({ input: barcode, signal: this.modal.events.signal });
      this.state(row?.state);
      this.start('/' + parent.id + '/presentaciones' + (row ? '/' + row.id + '/editar' : ''), values => ({ ...values, ...(row ? { version: row.version } : {}) }));
    }
  }
  Object.assign(Catalog, { CatalogForm, ProductForm, PresentationForm });
})();
