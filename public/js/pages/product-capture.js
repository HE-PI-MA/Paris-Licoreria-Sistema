/** Entrada del producto: foto y código primero; búsqueda local y sugerencias públicas siempre revisables. */
(() => {
  'use strict';
  const UI = window.ParisUI, Catalog = window.ParisProducts;
  class ProductCapture {
    constructor(owner, onExisting) {
      this.owner = owner; this.onExisting = onExisting; this.signal = owner.modal.events.signal;
      this.scan = UI.Button.create({ label: 'Escanear código', icon: 'barcode', variant: 'primary' });
      this.photo = new UI.PhotoField({ container: owner.grid, form: owner.form, modal: owner.modal, firstAction: this.scan,
        label: 'Escanea o agrega una foto del producto', onChoose: (file, current) => this.fromPhoto(file, current) });
      this.code = owner.field('barcode', 'Código de barras', { maxLength: 50, wide: true, placeholder: 'Ej.: 7771234567890', uppercase: false });
      this.code.classList.add('app-input-verbatim');
      this.reader = new UI.BarcodeField({ input: this.code, signal: this.signal, button: this.scan, onRead: code => this.lookup(code) });
      const host = UI.element('div', 'app-field--wide app-capture-notice');
      this.message = UI.element('p', 'app-field-help', 'Para buscar nombre y categoría, escanea las barras.'); this.message.setAttribute('role', 'status');
      const toolbar = UI.element('div', 'app-section-toolbar');
      this.search = UI.Button.create({ label: 'Buscar nombre y categoría', icon: 'search' }); this.search.disabled = true;
      const disclosure = UI.element('p', 'app-field-help', 'Consulta opcional: solo se envía el código a Open Food Facts.');
      this.source = UI.element('a', 'app-field-help'); this.source.target = '_blank'; this.source.rel = 'noopener noreferrer'; this.source.hidden = true;
      toolbar.append(this.search); host.append(this.message, toolbar, disclosure, this.source); owner.grid.append(host);
      this.search.addEventListener('click', () => this.lookup(this.code.value.trim(), true), { signal: this.signal });
      this.code.addEventListener('input', () => { this.request?.abort(); this.search.disabled = !this.code.value.trim(); this.source.hidden = true; this.sync(); }, { signal: this.signal });
      this.signal.addEventListener('abort', () => this.request?.abort(), { once: true });
    }
    fields() {
      const o = this.owner;
      o.grid.append(UI.element('h3', 'app-form-section-title app-field--wide', 'Primera forma de venta (opcional)'));
      this.name = o.field('presentationName', '¿Cómo lo vendes?', { placeholder: 'Ej.: Botella o paquete de 6', maxLength: 80, uppercase: true });
      this.factor = o.field('factor', '¿Cuánto trae?', { type: 'number', value: '1', min: '0.001', max: '999999999999.999', step: '0.001', help: 'Botella: 1 unidad. Paquete de 6: 6 unidades. Kilo: 1000 gramos.' });
      this.price = o.field('price', 'Precio de esa forma de venta (Bs)', { type: 'number', min: '0', max: '9999999999999.99', step: '0.01', placeholder: 'Ej.: 12,00', wide: true });
      o.grid.append(UI.element('p', 'app-field-help app-field--wide', 'El código pertenece a esta botella, paquete o caja. Los precios y lo que trae se completan aquí; escanear no aumenta las existencias.'));
      for (const input of [this.name, this.factor, this.price]) input.addEventListener('input', () => this.sync(), { signal: this.signal });
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
    async lookup(code, external = false) {
      if (!code || this.signal.aborted || this.owner.controller?.busy) return;
      this.request?.abort(); const request = this.request = new AbortController(); this.pending = true;
      this.message.textContent = 'Buscando código…'; this.search.disabled = true;
      const current = () => !this.signal.aborted && !request.signal.aborted && this.code.value.trim() === code;
      const values = new FormData(this.owner.form), beforeName = values.get('name'), beforeCategory = values.get('categoryId');
      try {
        const local = await this.owner.api.barcode(code, request.signal);
        if (!current()) return;
        if (local.found) {
          this.message.textContent = 'Ya registrado: ' + local.product.name + '. Categoría: ' + local.product.category + '. Forma de venta: ' + local.presentation.name + '.';
          const open = await UI.Confirm.ask({ title: 'Producto ya registrado', message: this.message.textContent + ' Puedes abrirlo sin crear un duplicado. Si continúas se descartará este borrador.', confirmLabel: 'Abrir producto' });
          if (open && current()) { this.owner.modal.close(); this.onExisting?.(local.product); }
          return;
        }
        if (!external) { this.message.textContent = 'Código nuevo. Puedes buscar nombre y categoría en el catálogo público o completar los datos.'; return; }
        const suggestion = await this.owner.api.suggest(code, request.signal);
        if (!current()) return;
        if (!suggestion.found) { this.message.textContent = 'No hay datos para este código en el catálogo público. Completa nombre y categoría; el código se conserva.'; return; }
        const name = this.owner.form.elements.namedItem('name'), category = this.owner.form.elements.namedItem('categoryId');
        // No reemplazar lo escrito por la persona, tampoco mientras llegaba la respuesta.
        if (!beforeName && !name.value && suggestion.name) { name.value = suggestion.name.toLocaleUpperCase('es'); name.dispatchEvent(new Event('input', { bubbles: true })); }
        if (!beforeCategory && !category.value && suggestion.category) {
          const options = await this.owner.api.options('categories', { term: suggestion.category, pageSize: 100, signal: request.signal });
          if (!current()) return;
          const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es');
          const match = options.options.find(item => normalize(item.label) === normalize(suggestion.category));
          if (match && !category.value) UI.SearchSelect.controls.get(category).setValue(match, true);
        }
        this.message.textContent = 'Revisa las sugerencias. ' + (suggestion.category && !category.value ? 'Categoría sugerida: ' + suggestion.category + '. Selecciona su categoría en tu sistema.' : 'Completa cómo lo cuentas, cómo lo vendes y su precio.');
        this.source.textContent = 'Datos: Open Food Facts · ODbL'; this.source.href = 'https://world.openfoodfacts.org/product/' + encodeURIComponent(code); this.source.hidden = false;
      } catch (error) {
        if (current()) { this.message.textContent = 'Tus datos se conservan. Puedes completar el producto manualmente.'; UI.NotificationCenter.shared().show('error', error.userMessage || 'No se pudo buscar el código.'); }
      } finally { if (this.request === request) { this.pending = false; this.search.disabled = !this.code.value.trim(); } }
    }
  }
  Catalog.ProductCapture = ProductCapture;
})();
