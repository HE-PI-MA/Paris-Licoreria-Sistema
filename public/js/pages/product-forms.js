/** Formularios del catálogo. Nuevo producto muestra solo los datos esenciales; las formas de venta se administran aparte. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  const CatalogForm = UI.CatalogForm;

  class ProductForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar producto' : 'Nuevo producto' });

      const row = this.record;

      this.photo = new UI.PhotoField({
        container: this.grid,
        form: this.form,
        modal: this.modal,
        label: 'Foto del producto (opcional)'
      });
      this.photo.reset(row);

      this.field('name', 'Nombre del producto', {
        value: row?.name,
        required: true,
        maxLength: 120,
        wide: true,
        placeholder: 'Ej.: Coca-Cola 2 litros'
      });

      this.selector(
        'categoryId',
        'Categoría',
        'categories',
        row && { value: row.categoryId, label: row.category },
        undefined,
        this.api,
        'Buscar o escribir categoría…',
        { allowCustom: !row, maxLength: 80 }
      );

      const unit = this.selector(
        'unitId',
        '¿Cómo se cuenta?',
        'units',
        row && { value: row.unitId, label: row.unit },
        undefined,
        this.api,
        'Ej.: Unidad, gramo o mililitro'
      );

      if (row?.presentations > 0) {
        unit.disabled = true;
        this.grid.append(UI.element(
          'p',
          'app-field-help app-field--wide',
          'La unidad base se conserva porque el producto ya tiene formas de venta.'
        ));
      }

      // Solo Editar producto muestra los campos administrativos.
      if (row) {
        this.field('minimum', 'Stock mínimo', {
          type: 'number',
          value: row.minimum ?? '0',
          min: '0',
          max: '999999999999.999',
          step: '0.001',
          required: true
        });
        this.state(row.state);
        this.field('description', 'Descripción', {
          type: 'textarea',
          value: row.description,
          maxLength: 255,
          wide: true
        });
      }

      this.start(
        row ? '/' + row.id + '/editar' : '',
        ({ photoState, categoryIdText, categoryId, ...values }) => {
          const base = {
            name: values.name,
            ...(categoryId ? { categoryId } : { categoryName: categoryIdText }),
            unitId: row && unit.disabled ? String(row.unitId) : values.unitId,
            ...this.photo.payload()
          };

          return row ? {
            ...base,
            minimum: values.minimum,
            state: values.state,
            description: values.description,
            version: row.version
          } : base;
        }
      );
    }
  }

  class PresentationForm extends CatalogForm {
    constructor(options) {
      super({ ...options, icon: options.record ? 'edit' : 'plus', title: options.record ? 'Editar presentación' : 'Nueva presentación' });
      const row = this.record, parent = options.product;

      this.form.prepend(UI.element('p', 'app-field-help', 'Producto: ' + parent.name + '. Se cuenta en: ' + parent.unit + '.'));

      this.field('name', 'Forma de venta', {
        value: row?.name,
        required: true,
        maxLength: 80,
        help: 'Por ejemplo: botella, paquete de 6 o caja de 12.',
        wide: true
      });

      const factor = this.field('factor', '¿Cuánto trae?', {
        type: 'number',
        value: row?.factor ?? '1',
        min: '0.001',
        max: '999999999999.999',
        step: '0.001',
        required: true,
        help: row?.used
          ? 'No puede cambiarse: esta presentación ya tiene ventas.'
          : 'Una botella: 1. Un paquete de 6: 6. Un kilo contado en gramos: 1000.'
      });
      factor.readOnly = Boolean(row?.used);

      this.field('price', 'Precio de venta (Bs)', {
        type: 'number',
        value: row?.price ?? '0',
        min: '0',
        max: '9999999999999.99',
        step: '0.01',
        required: true
      });

      const barcode = this.field('barcode', 'Código de barras', {
        value: row?.barcode,
        maxLength: 50,
        help: 'Opcional. Debe ser único entre todas las presentaciones.'
      });
      new UI.BarcodeField({ input: barcode, signal: this.modal.events.signal });

      this.state(row?.state);

      this.start(
        '/' + parent.id + '/presentaciones' + (row ? '/' + row.id + '/editar' : ''),
        values => ({ ...values, ...(row ? { version: row.version } : {}) })
      );
    }
  }

  Object.assign(Catalog, { CatalogForm, ProductForm, PresentationForm });
})();
