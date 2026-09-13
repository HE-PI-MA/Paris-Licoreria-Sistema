/** Fotos compartidas: selección/cámara, reducción local, vista previa y borrador. No sube nada por sí misma. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class ImageFile {
    static async canvas(file, maxSide = 768) {
      if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Selecciona una foto JPG, PNG o WebP de hasta 15 MB.');
      const url = URL.createObjectURL(file), image = new Image();
      try {
        image.src = url; await image.decode();
        const width = image.naturalWidth, height = image.naturalHeight;
        if (!width || !height || width * height > 40000000) throw new Error('La foto es demasiado grande. Selecciona una de menor resolución.');
        const scale = Math.min(1, maxSide / Math.max(width, height)), canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas;
      } finally { URL.revokeObjectURL(url); }
    }
    static async photo(file) {
      const canvas = await this.canvas(file);
      for (const quality of [.8, .65, .5, .35]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length < 270000) return data;
      }
      throw new Error('No se pudo reducir esta foto. Prueba con otra imagen.');
    }
  }
  class ProductPhoto {
    static url(row) { return row?.photoHash && /^\d+$/.test(String(row.id)) ? '/api/productos/' + row.id + '/imagen?v=' + encodeURIComponent(row.photoHash) : ''; }
    static element(row, large = false) {
      const host = UI.element('span', 'app-product-photo' + (large ? ' app-product-photo--large' : ''));
      const icon = UI.Icon.create('box'); if (icon) host.append(icon);
      host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'Sin foto');
      const url = this.url(row);
      if (url) {
        const image = UI.element('img'); image.src = url; image.alt = 'Foto de ' + row.name; image.loading = 'lazy';
        image.addEventListener('error', () => image.remove(), { once: true });
        image.addEventListener('load', () => { host.removeAttribute('role'); host.removeAttribute('aria-label'); icon?.remove(); }, { once: true });
        host.append(image);
      }
      return host;
    }
  }
  class PhotoField {
    constructor({ container, form, modal }) {
      this.events = new AbortController(); this.generation = 0;
      this.host = UI.element('div', 'app-field app-field--wide');
      this.host.append(UI.element('span', 'app-label', 'Foto del producto (opcional)'));
      const body = UI.element('div', 'app-photo-field'); this.preview = UI.element('div', 'app-photo-preview');
      const controls = UI.element('div', 'app-photo-controls'); this.actions = UI.element('div', 'app-section-toolbar');
      this.state = UI.element('input'); this.state.type = 'hidden'; this.state.name = 'photoState'; this.state.value = '';
      this.help = UI.element('p', 'app-field-help'); this.help.setAttribute('role', 'status');
      this.inputs = [];
      for (const [label, capture] of [['Elegir foto', false], ['Tomar foto', true]]) {
        const input = UI.element('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true;
        if (capture) input.setAttribute('capture', 'environment');
        const button = UI.Button.create({ label, icon: 'camera' }); button.addEventListener('click', () => input.click(), { signal: this.events.signal });
        input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; if (file) this.choose(file); }, { signal: this.events.signal });
        this.inputs.push(input); this.actions.append(button, input);
      }
      this.remove = UI.Button.create({ label: 'Quitar foto', icon: 'trash', variant: 'danger' });
      this.remove.addEventListener('click', () => { if (!this.readOnly) { this.generation++; this.busy = false; this.value = null; this.render(); } }, { signal: this.events.signal });
      this.actions.append(this.remove); controls.append(this.actions, this.help); body.append(this.preview, controls); this.host.append(body, this.state); container.append(this.host);
      this.form = form; this.reset();
      modal.events.signal.addEventListener('abort', () => this.destroy(), { once: true });
    }
    reset(row = null, readOnly = false) {
      this.generation++; this.busy = false; this.row = row; this.value = row?.photo; this.readOnly = readOnly; this.render();
    }
    render() {
      const src = this.value === null ? '' : this.value || ProductPhoto.url(this.row);
      this.preview.replaceChildren();
      if (src) { const img = UI.element('img'); img.src = src; img.alt = 'Foto del producto'; this.preview.append(img); }
      else this.preview.append(ProductPhoto.element(null, true));
      this.actions.hidden = this.readOnly;
      this.remove.disabled = !src || this.busy;
      this.help.textContent = this.busy ? 'Preparando foto…' : this.readOnly ? 'Foto del producto seleccionado. Puedes cambiarla en Productos.' : 'Se guarda al confirmar. Puedes elegir una foto o tomarla con el celular.';
      this.state.value = this.busy ? 'processing' : this.value === undefined ? '' : this.value === null ? 'remove' : this.value;
      this.state.dispatchEvent(new Event('input', { bubbles: true }));
    }
    async choose(file) {
      if (this.readOnly || this.form.getAttribute('aria-busy') === 'true') return;
      const generation = ++this.generation; this.busy = true; this.render();
      try {
        const photo = await ImageFile.photo(file);
        if (this.destroyed || generation !== this.generation) return;
        this.value = photo;
      } catch (error) {
        if (!this.destroyed && generation === this.generation) UI.NotificationCenter.shared().show('error', error.message || 'No se pudo leer la foto.');
      } finally { if (!this.destroyed && generation === this.generation) { this.busy = false; this.render(); } }
    }
    payload() {
      if (this.busy) throw new UI.CatalogApiError('Espera a que termine de prepararse la foto.');
      return this.value === undefined ? {} : { photo: this.value };
    }
    destroy() { this.destroyed = true; this.generation++; this.events.abort(); this.preview.replaceChildren(); this.value = undefined; }
  }
  Object.assign(UI, { ImageFile, ProductPhoto, PhotoField });
})();
