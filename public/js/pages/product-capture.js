/** Entrada del producto: foto y código primero; búsqueda local y sugerencias públicas siempre revisables. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  class ProductCapture {
    constructor(owner, onExisting) {
      this.owner = owner; this.onExisting = onExisting; this.signal = owner.modal.events.signal;
      this.suggested = new Map(); this.codeValue = '';
      this.scan = UI.Button.create({ label: 'Escanear código', icon: 'barcode', variant: 'primary' });
      this.photo = new UI.PhotoField({ container: owner.grid, form: owner.form, modal: owner.modal, firstAction: this.scan,
        label: 'Escanea o agrega una foto del producto', onChoose: (file, current) => this.fromPhoto(file, current) });
      this.code = owner.field('barcode', 'Código de barras', { maxLength: 50, wide: true, placeholder: 'Ej.: 7771234567890', uppercase: false });
      this.code.classList.add('app-input-verbatim');
      this.reader = new UI.BarcodeField({ input: this.code, signal: this.signal, button: this.scan, onRead: code => this.lookup(code) });
      const host = UI.element('div', 'app-field--wide app-capture-notice');
      this.message = UI.element('p', 'app-field-help', 'Escanea el código y se completarán los datos disponibles.'); this.message.setAttribute('role', 'status');
      const disclosure = UI.element('p', 'app-field-help', 'Si el código es nuevo, se consulta automáticamente en Open Food Facts. Solo se envía el código.');
      this.source = UI.element('a', 'app-field-help'); this.source.target = '_blank'; this.source.rel = 'noopener noreferrer'; this.source.hidden = true;
      host.append(this.message, disclosure, this.source); owner.grid.append(host);
      this.code.addEventListener('input', () => this.changeCode(), { signal: this.signal });
      // Escribir o pegar un código y salir del campo sigue el mismo flujo que el lector.
      this.code.addEventListener('change', () => this.lookup(this.code.value.trim()), { signal: this.signal });
      for (const event of ['input', 'change']) owner.form.addEventListener(event, ({ target }) => {
        if (this.suggested.has(target) && target.value !== this.suggested.get(target)) this.suggested.delete(target);
      }, { signal: this.signal });
      this.signal.addEventListener('abort', () => this.request?.abort(), { once: true });
    }
    changeCode() {
      const value = this.code.value.trim();
      if (value !== this.codeValue) {
        this.codeValue = value; this.request?.abort(); this.pending = false; this.lookupCode = null;
        // Al leer otro producto, quitar solo sugerencias anteriores que la persona no haya editado.
        for (const [field, previous] of this.suggested) if (field.value === previous) {
          const select = UI.SearchSelect.controls.get(field);
          if (select) select.setValue(null, true);
          else { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        this.suggested.clear(); this.source.hidden = true;
        this.message.textContent = value ? 'Al terminar de escribir el código se buscarán sus datos.' : 'Escanea el código y se completarán los datos disponibles.';
      }
      this.sync();
    }
    draft() { return JSON.stringify(Array.from(new FormData(this.owner.form)).filter(([name]) => name !== 'barcode')); }
    fields() {
      const o = this.owner;
      o.grid.append(UI.element('h3', 'app-form-section-title app-field--wide', 'Primera forma de venta (opcional)'));
      this.name = o.field('presentationName', '¿Cómo lo vendes?', { placeholder: 'Ej.: Botella o paquete de 6', maxLength: 80, uppercase: true });
      this.factor = o.field('factor', '¿Cuánto trae?', { type: 'number', value: '1', min: '0.001', max: '999999999999.999', step: '0.001', help: 'Botella: 1 unidad. Paquete de 6: 6 unidades. Kilo: 1000 gramos.' });
      this.price = o.field('price', 'Precio de esa forma de venta (Bs)', { type: 'number', min: '0', max: '9999999999999.99', step: '0.01', placeholder: 'Ej.: 12,00', wide: true });
      o.grid.append(UI.element('p', 'app-field-help app-field--wide', 'El código pertenece a esta botella, paquete o caja. Los precios y lo que trae se completan aquí; escanear no aumenta las existencias.'));
      for (const input of [this.name, this.factor, this.price]) input.addEventListener('input', () => this.sync(), { signal: this.signal });
      this.initialDraft = this.draft();
    }
    active() { return Boolean(this.code.value.trim() || this.name?.value.trim() || this.price?.value || (this.factor?.value && this.factor.value !== '1')); }
    sync() { if (this.name) for (const field of [this.name, this.factor, this.price]) field.required = this.active(); }
    payload(values) {
      if (this.pending) throw new UI.CatalogApiError('Espera a que termine la búsqueda del código.');
      const { barcode, presentationName, factor, price, ...product } = values;
      return { ...product, ...(this.active() ? { initialPresentation: { name: presentationName, factor, price, barcode } } : {}) };
    }
    async fromPhoto(file, current) {
      if (this.code.value.trim()) return;
      try {
        const code = await UI.BarcodeScanner.readPhoto(file);
        if (current() && !this.code.value.trim()) this.reader.accept(code);
      } catch (_) { if (current()) this.message.textContent = 'Foto lista. Si las barras no aparecen en ella, usa Escanear código o completa los datos.'; }
    }
    async lookup(code) {
      if (!code || this.signal.aborted || this.owner.controller?.busy || this.lookupCode === code) return;
      this.request?.abort(); const request = this.request = new AbortController(); this.pending = true;
      this.lookupCode = code; this.message.textContent = 'Buscando código…';
      const current = () => !this.signal.aborted && !request.signal.aborted && this.code.value.trim() === code;
      const values = new FormData(this.owner.form), beforeName = values.get('name'), beforeCategory = values.get('categoryId');
      const category = this.owner.form.elements.namedItem('categoryId'), selector = UI.SearchSelect.controls.get(category), beforeCategoryText = selector.input.value;
      try {
        const local = await this.owner.api.barcode(code, request.signal);
        if (!current()) return;
        if (local.found) {
          this.message.textContent = 'Ya registrado: ' + local.product.name + '. Categoría: ' + local.product.category + '. Forma de venta: ' + local.presentation.name + '.';
          const open = this.draft() === this.initialDraft || await UI.Confirm.ask({ title: 'Producto ya registrado', message: this.message.textContent + ' Puedes abrirlo sin crear un duplicado. Si continúas se descartará este borrador.', confirmLabel: 'Abrir producto' });
          if (current()) {
            if (open) { this.owner.modal.close(); this.onExisting?.(local.product); }
            else this.lookupCode = null;
          }
          return;
        }
        if (!/^(?:\d{8}|\d{12,14})$/.test(code)) { this.message.textContent = 'Código interno nuevo. Completa los datos para registrarlo.'; return; }
        this.message.textContent = 'Código leído. Buscando nombre y categoría…';
        const suggestion = await this.owner.api.suggest(code, request.signal);
        if (!current()) return;
        if (!suggestion.found) { this.message.textContent = 'No hay datos para este código en el catálogo público. Completa nombre y categoría; el código se conserva.'; return; }
        const name = this.owner.form.elements.namedItem('name');
        // No reemplazar lo escrito por la persona, tampoco mientras llegaba la respuesta.
        if (!beforeName && !name.value && suggestion.name) { name.value = suggestion.name.toLocaleUpperCase('es'); name.dispatchEvent(new Event('input', { bubbles: true })); this.suggested.set(name, name.value); }
        if (!beforeCategory && !beforeCategoryText && !category.value && !selector.input.value && suggestion.category) {
          const options = await this.owner.api.options('categories', { term: suggestion.category, pageSize: 100, signal: request.signal });
          if (!current()) return;
          const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es');
          const match = options.options.find(item => normalize(item.label) === normalize(suggestion.category));
          if (match && !category.value && !selector.input.value) { selector.setValue(match, true); this.suggested.set(category, category.value); }
        }
        this.message.textContent = 'Revisa las sugerencias. ' + (suggestion.category && !category.value ? 'Categoría sugerida: ' + suggestion.category + '. Selecciona su categoría en tu sistema.' : 'Completa cómo lo cuentas, cómo lo vendes y su precio.');
        this.source.textContent = 'Datos: Open Food Facts · ODbL'; this.source.href = 'https://world.openfoodfacts.org/product/' + encodeURIComponent(code); this.source.hidden = false;
      } catch (error) {
        if (current()) { this.lookupCode = null; this.message.textContent = 'El código y tus datos se conservan. Completa lo que falte o vuelve a escanear para reintentar.'; UI.NotificationCenter.shared().show('error', error.userMessage || 'No se pudo buscar el código.'); }
      } finally { if (this.request === request) this.pending = false; }
    }
  }
  Catalog.ProductCapture = ProductCapture;
})();
