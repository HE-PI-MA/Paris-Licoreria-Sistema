/** Formularios del catálogo. La clase base compone Modal/FormController; las clases hijas declaran únicamente sus campos y datos. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  const CatalogForm = UI.CatalogForm;
  class ProductForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar producto' : 'Nuevo producto' });
      const row = this.record;
      this.field('name', 'Nombre del producto', { value: row?.name, required: true, maxLength: 120, wide: true });
      this.selector('categoryId', 'Categoría', 'categories', row && { value: row.categoryId, label: row.category });
      const unit = this.selector('unitId', 'Unidad base', 'units', row && { value: row.unitId, label: row.unit });
      if (row?.presentations > 0) {
        unit.disabled = true;
        this.grid.append(UI.element('p', 'app-field-help app-field--wide', 'La unidad base se conserva porque el producto ya tiene presentaciones.'));
      }
      this.field('minimum', 'Stock mínimo', { type: 'number', value: row?.minimum ?? '0', min: '0', max: '999999999999.999', step: '0.001', required: true });
      this.state(row?.state);
      this.field('description', 'Descripción', { type: 'textarea', value: row?.description, maxLength: 255, wide: true });
      this.start(row ? '/' + row.id + '/editar' : '', values => ({ ...values,
        ...(row ? { unitId: unit.disabled ? String(row.unitId) : values.unitId, version: row.version } : {})
      }));
    }
  }
  class PresentationForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar presentación' : 'Nueva presentación' });
      const row = this.record, parent = options.product;
      this.form.prepend(UI.element('p', 'app-field-help', 'Producto: ' + parent.name + '. Unidad base: ' + parent.unit + '.'));
      this.field('name', 'Nombre de la presentación', { value: row?.name, required: true, maxLength: 80, help: 'Por ejemplo: botella, paquete de 6 o caja de 12.', wide: true });
      const factor = this.field('factor', 'Equivalencia en unidades base', { type: 'number', value: row?.factor ?? '1', min: '0.001', max: '999999999999.999', step: '0.001', required: true,
        help: row?.used ? 'No puede cambiarse: esta presentación ya tiene compras o ventas.' : 'Ejemplo: si la unidad base es botella, una caja de 12 equivale a 12.' });
      factor.readOnly = Boolean(row?.used);
      this.field('price', 'Precio de venta (Bs)', { type: 'number', value: row?.price ?? '0', min: '0', max: '9999999999999.99', step: '0.01', required: true });
      this.field('barcode', 'Código de barras', { value: row?.barcode, maxLength: 50, help: 'Opcional. Debe ser único entre todas las presentaciones.' });
      this.state(row?.state);
      this.start('/' + parent.id + '/presentaciones' + (row ? '/' + row.id + '/editar' : ''), values => ({ ...values, ...(row ? { version: row.version } : {}) }));
    }
  }
  Object.assign(Catalog, { CatalogForm, ProductForm, PresentationForm });
})();
