/** U051: Nueva compra simple con categoría para productos nuevos y medidas sugeridas. */
(() => {
  'use strict';
  const UI = window.ParisUI, P = window.ParisPurchases;

  class PurchaseForm extends UI.CatalogForm {
    constructor(options) {
      super({ ...options, title: 'Nueva compra', icon: 'bag', size: 'large' });
      this.productsApi = new window.ParisProducts.ProductsApi();
      this.draft = new P.PurchaseDraft();
      this.editing = null;
      this.pending = new Set();
      this.generation = {};
      this.grid.remove();

      this.section('Datos de la compra', 'app-form-grid app-form-grid--3');

      this.product = this.productLookup();
      this.category = this.categoryLookup();

      this.arrival = this.suggestChoice('arrival', '¿Cómo llegó?', {
        value: 'UNIDAD',
        required: true,
        placeholder: 'Escribe para buscar…',
        options: [
          { value: 'UNIDAD', label: 'Unidad' },
          { value: 'DOCENA', label: 'Docena' },
          { value: 'PAQUETE', label: 'Paquete' },
          { value: 'CAJA', label: 'Caja' },
          { value: 'BOLSA', label: 'Bolsa' },
          { value: 'BOTELLA', label: 'Botella' },
          { value: 'GRAMO', label: 'Gramo (g)' },
          { value: 'KILOGRAMO', label: 'Kilogramo (kg)' },
          { value: 'LIBRA', label: 'Libra (lb)' },
          { value: 'MILILITRO', label: 'Mililitro (ml)' },
          { value: 'LITRO', label: 'Litro (L)' }
        ]
      });

      this.quantity = this.field('quantity', 'Cantidad comprada', {
        type: 'number', min: '0.001', step: '0.001', value: '1', placeholder: 'Ej.: 5'
      });

      this.factor = this.field('factor', '¿Cuánto trae?', {
        type: 'number', min: '0.001', step: '0.001', value: '1', placeholder: 'Ej.: 24'
      });

      this.cost = this.field('cost', 'Costo de compra (Bs)', {
        type: 'number', min: '0', step: '0.01', placeholder: 'Ej.: 180.00'
      });

      this.expiry = this.field('expiresOn', 'Vencimiento (opcional)', { type: 'date' });
      this.location = this.lookupLocation();
      this.location.select.closest('.app-field').classList.add('app-field--span-2');

      const productHost = this.product.select.closest('.app-field');
      productHost.classList.add('app-field--span-2');

      this.scanInput = UI.element('input');
      this.scanInput.type = 'text';
      this.scanInput.hidden = true;
      this.scanButton = UI.Button.create({ label: 'Escanear producto', icon: 'barcode' });

      const productActions = UI.element('div', 'app-field-control-row');
      productHost.insertBefore(productActions, this.product.status);
      productActions.append(this.product.control.root, this.scanButton);
      productHost.append(this.scanInput);

      new UI.BarcodeField({
        input: this.scanInput,
        button: this.scanButton,
        signal: this.modal.events.signal,
        onRead: code => this.scan(code)
      });

      const toolbar = UI.element('div', 'app-form-toolbar');
      this.add = UI.Button.create({ label: 'Agregar producto', icon: 'plus', variant: 'primary' });
      this.reset = UI.Button.create({ label: 'Limpiar producto' });
      toolbar.append(this.add, this.reset);
      this.form.append(toolbar);

      const host = UI.element('div');
      host.id = this.form.id + '-items';
      this.form.append(host);

      this.table = new UI.DataTable({
        container: host,
        caption: 'Productos de la compra',
        mode: 'scroll',
        numbered: true,
        fillHeight: false,
        pageSize: 50,
        columns: P.PurchaseView.columns(),
        actionDisplay: 'menu',
        actions: [
          { id: 'detail', label: 'Ver detalle', icon: 'info' },
          { id: 'edit', label: 'Editar', icon: 'edit', tone: 'edit' },
          { id: 'remove', label: 'Quitar', icon: 'trash', variant: 'danger' }
        ],
        onAction: item => this.rowAction(item)
      });

      this.total = UI.element('output', 'app-form-total', 'Total: Bs 0,00');
      this.total.setAttribute('aria-live', 'polite');
      this.modal.footer.append(this.total);

      const cancel = UI.Button.create({ label: 'Cancelar' });
      const save = UI.Button.create({ label: 'Guardar compra', icon: 'success', variant: 'primary', type: 'submit' });
      save.setAttribute('form', this.form.id);
      this.modal.footer.append(cancel, save);

      const send = this.api.operation('');
      this.controller = new UI.FormController({
        form: this.form,
        modal: this.modal,
        validate: () => this.validatePurchase(),
        onSubmit: (_, settings) => send(this.payload(), settings),
        onSuccess: async result => {
          this.modal.close();
          await this.onSaved(result);
        }
      });

      const settings = { signal: this.modal.events.signal };
      cancel.addEventListener('click', () => this.modal.requestClose(), settings);
      this.add.addEventListener('click', () => this.addLine(), settings);
      this.reset.addEventListener('click', () => this.clearEditor(), settings);
      this.arrival.addEventListener('change', () => this.syncArrival(), settings);

      const close = this.modal.onClose;
      this.modal.onClose = value => {
        this.destroyed = true;
        this.table.destroy();
        close(value);
      };

      this.modal.open(this.opener);
      this.syncArrival();
      this.product.control.input.focus();
    }

    section(title, gridClass = 'app-form-grid') {
      const section = UI.element('section', 'app-form-section');
      const heading = UI.element('h3', 'app-form-section-title', title);
      this.grid = UI.element('div', gridClass);
      section.append(heading, this.grid);
      this.form.append(section);
    }

    lookupLocation() {
      const select = this.field('locationId', 'Ubicación de ingreso', {
        type: 'select',
        options: [{ value: '', label: '' }]
      });
      const control = new UI.SearchSelect({
        select,
        load: p => this.api.request('/ubicaciones' + this.api.query(p), { signal: p.signal }),
        allowCustom: true,
        placeholder: 'Ej.: Almacén o heladera'
      });
      control.input.maxLength = 80;
      const status = UI.element('span', 'app-sr-only');
      status.setAttribute('role', 'status');
      select.closest('.app-field').append(status);
      this.selectors.push(control);
      return { select, control, status };
    }

    productLookup() {
      const select = this.field('productId', 'Nombre del producto', {
        type: 'select',
        options: [{ value: '', label: '' }]
      });
      const control = new UI.SearchSelect({
        select,
        load: p => this.productOptions(p),
        allowCustom: true,
        placeholder: 'Buscar o escribir producto…'
      });
      control.input.maxLength = 120;
      const status = UI.element('span', 'app-sr-only');
      status.setAttribute('role', 'status');
      select.closest('.app-field').append(status);
      this.selectors.push(control);
      select.addEventListener('change', () => this.loadProduct(), { signal: this.modal.events.signal });
      return { select, control, status };
    }

    categoryLookup() {
      const select = this.field('categoryId', 'Categoría', {
        type: 'select',
        options: [{ value: '', label: '' }]
      });
      const control = new UI.SearchSelect({
        select,
        load: p => this.productsApi.options('categories', p),
        allowCustom: true,
        placeholder: 'Buscar o escribir categoría…'
      });
      control.input.maxLength = 80;
      const status = UI.element('span', 'app-sr-only');
      status.setAttribute('role', 'status');
      select.closest('.app-field').append(status);
      this.selectors.push(control);
      return { select, control, status };
    }

    setCategory(record, locked = false) {
      const select = this.category.select;
      const control = this.category.control;

      select.disabled = false;
      control.syncDisabled();

      if (record?.categoryId) {
        control.setValue({
          value: record.categoryId,
          label: record.category || record.categoryName || 'Categoría'
        });
      } else {
        control.setValue(null);
        if (record?.categoryName) control.input.value = record.categoryName;
      }

      select.disabled = Boolean(locked);
      control.syncDisabled();
    }

    async productOptions(params) {
      const result = await this.productsApi.list({ ...params, query: { state: 'ACTIVO' } });
      return {
        options: result.records.map(row => ({ value: row.id, label: row.name })),
        total: result.total
      };
    }

    async loadProduct() {
      const id = this.product.select.value;
      const previous = this.selectedProduct;
      const generation = this.generation.product = (this.generation.product || 0) + 1;
      this.selectedProduct = null;

      if (!id) {
        this.product.status.textContent = '';
        if (previous?.id) this.setCategory(null, false);
        this.syncArrival();
        return;
      }

      this.pending.add('product');
      this.product.status.textContent = 'Cargando…';

      try {
        const record = await this.productsApi.detail(id);
        if (this.destroyed || generation !== this.generation.product) return;
        if (!record || record.state !== 'ACTIVO') throw new UI.CatalogApiError('El producto ya no está activo.');

        this.selectedProduct = record;
        this.product.status.textContent = '';
        this.setCategory(record, true);
        this.syncArrival();
      } catch (error) {
        if (!this.destroyed && generation === this.generation.product) {
          this.product.control.setValue(null);
          this.setCategory(null, false);
          this.product.status.textContent = '';
          this.controller?.alert.show('error', error.userMessage || 'No se pudo cargar el producto.');
        }
      } finally {
        if (generation === this.generation.product) this.pending.delete('product');
      }
    }

    normalize(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleUpperCase('es');
    }

    inferredUnit(arrival) {
      if (['GRAMO', 'KILOGRAMO', 'LIBRA'].includes(arrival)) return 'Gramo';
      if (['MILILITRO', 'LITRO'].includes(arrival)) return 'Mililitro';
      return 'Unidad';
    }

    automaticFactor(arrival) {
      const unit = this.normalize(this.selectedProduct?.unit || this.inferredUnit(arrival));

      if (unit === 'GRAMO') {
        return { GRAMO: '1', KILOGRAMO: '1000', LIBRA: '453.592' }[arrival] || null;
      }
      if (unit === 'MILILITRO') {
        return { MILILITRO: '1', LITRO: '1000' }[arrival] || null;
      }
      if (unit === 'UNIDAD') {
        return { UNIDAD: '1', DOCENA: '12' }[arrival] || null;
      }
      if (unit === 'KILOGRAMO') {
        return { KILOGRAMO: '1', GRAMO: '0.001' }[arrival] || null;
      }
      return null;
    }

    syncArrival() {
      const automatic = this.automaticFactor(this.arrival.value);
      if (automatic !== null) {
        this.factor.value = automatic;
        this.factor.readOnly = true;
      } else {
        if (this.factor.readOnly) this.factor.value = '1';
        this.factor.readOnly = false;
      }
    }

    async scan(code) {
      if (this.controller.busy || this.destroyed) return;
      this.pending.add('scan');

      try {
        const result = await this.productsApi.barcode(code, this.modal.events.signal);
        if (!result?.found) {
          this.controller.alert.show('info', 'Código no encontrado. Puedes escribir el producto nuevo, elegir su categoría y continuar con la compra.');
          return;
        }

        this.product.control.setValue({ value: result.product.id, label: result.product.name });
        this.selectedProduct = result.product;
        this.product.status.textContent = '';
        this.setCategory(result.product, true);
        this.syncArrival();
        this.controller.alert.show('success', 'Producto reconocido: ' + result.product.name + '.');
        this.quantity.focus();
      } catch (error) {
        if (!this.destroyed) {
          this.controller.alert.show('error', error.userMessage || 'No se pudo consultar el código.');
        }
      } finally {
        this.pending.delete('scan');
        this.scanInput.value = '';
      }
    }

    ref(record) {
      return { id: record.id, version: record.version };
    }

    payload() {
      if (this.pending.size) throw new UI.CatalogApiError('Espera a que termine la selección.');

      if (
        this.product.control.input.value.trim() ||
        this.category.control.input.value.trim() ||
        this.selectedProduct ||
        this.cost.value ||
        this.expiry.value ||
        this.editing
      ) {
        throw new UI.CatalogApiError('Agrega el producto que estás editando o pulsa Limpiar producto antes de guardar la compra.');
      }

      if (!this.draft.rows.length) throw new UI.CatalogApiError('Agrega al menos un producto a la compra.');

      return {
        ...(this.location.select.value
          ? { locationId: this.location.select.value }
          : { locationName: this.location.control.input.value.trim() }),
        lines: this.draft.payload()
      };
    }

    validatePurchase() {
      const errors = {};
      if (!this.location.control.input.value.trim()) {
        errors.locationIdText = 'Selecciona o escribe la ubicación de ingreso.';
      }
      return errors;
    }

    addLine() {
      if (this.controller.busy) return;
      this.controller.clearErrors();

      try {
        if (this.pending.size) throw new UI.CatalogApiError('Espera a que termine la selección.');

        const name = this.product.control.input.value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
        if (!this.selectedProduct?.id && !name) throw new UI.CatalogApiError('Busca o escribe el nombre del producto.');
        if (!this.arrival.value) throw new UI.CatalogApiError('Selecciona cómo llegó el producto desde las sugerencias.');
        if (!this.location.control.input.value.trim()) throw new UI.CatalogApiError('Selecciona o escribe dónde se ubicará la mercadería.');

        const categoryText = this.category.control.input.value.trim();
        if (!this.selectedProduct?.id && !categoryText) {
          throw new UI.CatalogApiError('Selecciona o escribe la categoría del producto nuevo.');
        }

        const arrival = this.arrival.value;
        const factor = P.PurchaseDraft.decimal(this.factor.value, 3, 'cuánto trae', true);
        const quantity = P.PurchaseDraft.decimal(this.quantity.value, 3, 'la cantidad', true);
        const cost = P.PurchaseDraft.decimal(this.cost.value, 2, 'el costo');
        const baseQuantity = UI.Decimal.multiply(quantity, factor, 3);

        if (UI.Decimal.units(baseQuantity, 3) <= 0n || UI.Decimal.units(baseQuantity, 3) > 999999999999999n) {
          throw new UI.CatalogApiError('Revisa la cantidad comprada y cuánto trae cada uno.');
        }

        const product = this.selectedProduct?.id
          ? this.ref(this.selectedProduct)
          : {
              name,
              ...(this.category.select.value
                ? { categoryId: this.category.select.value }
                : { categoryName: categoryText })
            };

        const displayName = this.selectedProduct?.name || name;
        const displayCategory = this.selectedProduct?.category || categoryText;

        const line = {
          product,
          arrival,
          factor,
          quantity,
          cost,
          expiresOn: this.expiry.value
        };

        const display = {
          product: displayName,
          category: displayCategory,
          categoryId: this.selectedProduct?.categoryId || this.category.select.value || '',
          arrival,
          factor,
          quantity,
          cost,
          baseQuantity,
          subtotal: UI.Decimal.multiply(quantity, cost, 2),
          unit: this.selectedProduct?.unit || this.inferredUnit(arrival),
          expiresOn: this.expiry.value,
          location: this.location.control.input.value.trim()
        };

        this.draft.save(line, display, this.editing);
        this.updateDraft();
        this.clearEditor();
      } catch (error) {
        this.controller.alert.show('error', error.userMessage || error.message || 'Revisa los datos del producto.');
      }
    }

    updateDraft() {
      this.total.textContent = 'Total: Bs ' + UI.Decimal.format(this.draft.total());
      this.table.setData(this.draft.rows);
    }

    clearEditor() {
      if (this.controller?.busy) return;

      this.editing = null;
      this.selectedProduct = null;
      this.generation.product = (this.generation.product || 0) + 1;
      this.pending.delete('product');

      this.product.control.setValue(null);
      this.product.status.textContent = '';
      this.setCategory(null, false);

      this.arrival.value = 'UNIDAD';
      this.arrival.dispatchEvent(new Event('change', { bubbles: true }));

      this.quantity.value = '1';
      this.cost.value = '';
      this.expiry.value = '';
      this.add.querySelector('span').textContent = 'Agregar producto';
    }

    async rowAction({ action, record, button }) {
      if (this.controller.busy) return;

      if (action === 'detail') return P.PurchaseView.line(record, button);

      if (action === 'remove') {
        if (await UI.Confirm.ask({
          title: 'Quitar producto',
          message: 'Quitar ' + record.product + ' de esta compra.',
          confirmLabel: 'Quitar',
          danger: true
        }) && !this.destroyed && !this.controller.busy) {
          this.draft.remove(record.id);
          if (this.editing === record.id) this.clearEditor();
          this.updateDraft();
        }
        return;
      }

      if (
        (this.selectedProduct || this.product.control.input.value.trim()) &&
        !await UI.Confirm.ask({
          title: 'Cambiar producto',
          message: 'Se descartará la edición del producto que aún no agregaste.',
          confirmLabel: 'Continuar'
        })
      ) return;

      if (this.destroyed || this.controller.busy) return;

      this.clearEditor();
      this.editing = record.id;
      const line = record.line;

      if (line.product.id) {
        this.selectedProduct = {
          id: line.product.id,
          version: line.product.version,
          name: record.product,
          categoryId: record.categoryId,
          category: record.category,
          unit: record.unit,
          state: 'ACTIVO'
        };
        this.product.control.setValue({ value: line.product.id, label: record.product });
        this.setCategory(this.selectedProduct, true);
      } else {
        this.selectedProduct = null;
        this.product.control.setValue(null);
        this.product.control.input.value = record.product;

        this.setCategory(
          line.product.categoryId
            ? { categoryId: line.product.categoryId, category: record.category }
            : { categoryName: line.product.categoryName },
          false
        );
      }

      this.product.status.textContent = '';

      this.arrival.value = line.arrival;
      this.arrival.dispatchEvent(new Event('change', { bubbles: true }));
      this.factor.value = line.factor;
      this.quantity.value = line.quantity;
      this.cost.value = line.cost;
      this.expiry.value = line.expiresOn || '';

      this.add.querySelector('span').textContent = 'Actualizar producto';
      this.product.control.input.focus();
    }
  }

  P.PurchaseForm = PurchaseForm;
})();
