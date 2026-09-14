/** Lector común: cámara o fotografía de barras; un lector USB/Bluetooth entra por el mismo campo como teclado. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class BarcodeScanner {
    constructor({ onRead, opener }) {
      this.onRead = onRead; this.generation = 0;
      const content = UI.element('div', 'app-scanner');
      this.video = UI.element('video', 'app-scanner-video'); this.video.muted = true; this.video.playsInline = true; this.video.hidden = true;
      this.help = UI.element('p', 'app-field-help', 'Enfoca todas las barras, con buena luz y sin reflejos. También puedes elegir una foto del código.');
      this.help.setAttribute('role', 'status');
      const toolbar = UI.element('div', 'app-section-toolbar');
      this.start = UI.Button.create({ label: 'Encender cámara', icon: 'camera', variant: 'primary' });
      const photo = UI.Button.create({ label: 'Tomar foto del código', icon: 'camera', variant: 'primary' }), input = UI.element('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.setAttribute('capture', 'environment'); input.hidden = true;
      const choose = UI.Button.create({ label: 'Subir foto del código', icon: 'camera' }), file = UI.element('input'); file.type = 'file'; file.accept = input.accept; file.hidden = true;
      toolbar.append(this.start, photo, input, choose, file); content.append(this.video, this.help, toolbar);
      this.modal = new UI.Modal({ title: 'Leer código de barras', icon: 'barcode', content, onClose: () => { this.stop(); this.modal.destroy(); } });
      const options = { signal: this.modal.events.signal };
      this.start.addEventListener('click', () => this.camera(), options);
      photo.addEventListener('click', () => input.click(), options);
      input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; if (file) this.photo(file); }, options);
      choose.addEventListener('click', () => file.click(), options);
      file.addEventListener('change', () => { const selected = file.files[0]; file.value = ''; if (selected) this.photo(selected); }, options);
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => this.modal.requestClose(), options); this.modal.footer.append(close);
      window.addEventListener('pagehide', () => this.stop(), options);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); }, options);
      this.modal.events.signal.addEventListener('abort', () => this.stop(), { once: true });
      this.modal.open(opener);
      this.start.hidden = !BarcodeScanner.liveAvailable();
      if (this.start.hidden) this.help.textContent = 'Toma una foto de las barras con la cámara del celular o elige una imagen. Incluye el código completo, con buena luz.';
    }
    static liveAvailable() { return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia); }
    static decoder() {
      if (!window.ZXingBrowser) throw new Error('No se pudo cargar el lector. Recarga la página.');
      const ZX = window.ZXingBrowser, reader = new ZX.BrowserMultiFormatReader(new Map(), { delayBetweenScanAttempts: 200, delayBetweenScanSuccess: 500, tryPlayVideoTimeout: 3000 });
      // EAN-13 conserva el cero que un lector UPC-A puede omitir; la API resuelve ambas representaciones.
      reader.possibleFormats = ['EAN_13', 'EAN_8', 'UPC_E', 'CODE_128', 'CODE_39', 'CODE_93', 'ITF', 'CODABAR'].map(name => ZX.BarcodeFormat[name]);
      return reader;
    }
    static async readPhoto(file) { return this.decoder().decodeFromCanvas(await UI.ImageFile.canvas(file, 1920)).getText(); }
    stop() {
      this.generation++; this.controls?.stop(); this.controls = null;
      this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
      this.video.srcObject = null; this.video.hidden = true; this.start.disabled = false;
      if (this.timer) window.clearTimeout(this.timer); this.timer = null;
    }
    complete(value, generation) {
      if (this.modal.destroyed || generation !== this.generation) return;
      const code = String(value).trim();
      if (!code || code.length > 50 || /[\u0000-\u001f\u007f]/.test(code)) { this.stop(); this.help.textContent = 'El código no es válido. Prueba de nuevo.'; return; }
      this.stop(); this.modal.close(); this.onRead(code);
    }
    async camera() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.help.textContent = 'La cámara en vivo necesita HTTPS y permiso del navegador. Usa Foto del código si no está disponible.'; return; }
      this.stop(); const generation = this.generation; this.start.disabled = true; this.help.textContent = 'Permite el acceso a la cámara…';
      this.timer = window.setTimeout(() => { if (generation === this.generation) { this.stop(); this.help.textContent = 'No se pudo completar la lectura. Puedes volver a encender la cámara o usar una foto.'; } }, 45000);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (this.modal.destroyed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
        this.stream = stream; this.video.hidden = false; this.help.textContent = 'Enfoca el código completo. Mantén el celular estable.';
        const controls = await BarcodeScanner.decoder().decodeFromStream(stream, this.video, result => { if (result) this.complete(result.getText(), generation); });
        if (this.modal.destroyed || generation !== this.generation) controls.stop(); else this.controls = controls;
      } catch (_) { if (!this.modal.destroyed && generation === this.generation) { this.stop(); this.help.textContent = 'No se pudo abrir la cámara. Revisa su permiso o usa Foto del código.'; } }
    }
    async photo(file) {
      this.stop(); const generation = this.generation; this.help.textContent = 'Leyendo foto…';
      try { this.complete(await BarcodeScanner.readPhoto(file), generation); }
      catch (_) { if (generation === this.generation && !this.modal.destroyed) this.help.textContent = 'No se distinguieron las barras. Toma una foto más cerca, recta y bien iluminada.'; }
    }
  }
  class BarcodeField {
    constructor({ input, signal, onRead = () => {}, label = 'Leer código', button }) {
      this.input = input; this.onRead = onRead;
      this.button = button || UI.Button.create({ label, icon: 'barcode', iconOnly: true });
      if (!button) { const row = UI.element('div', 'app-input-action'); input.replaceWith(row); row.append(input, this.button); }
      this.button.addEventListener('click', () => { if (!input.disabled && !input.readOnly) this.scanner = new BarcodeScanner({ opener: this.button, onRead: code => this.accept(code) }); }, { signal });
      input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); if (input.value.trim() && !input.disabled && !input.readOnly) this.accept(input.value.trim()); } }, { signal });
      this.observer = new MutationObserver(() => this.sync()); this.observer.observe(input, { attributes: true, attributeFilter: ['disabled', 'readonly'] }); this.sync();
      signal.addEventListener('abort', () => { this.observer.disconnect(); this.scanner?.modal.destroy(); }, { once: true });
    }
    sync() { this.button.disabled = this.input.disabled || this.input.readOnly; }
    accept(code) { if (this.input.disabled || this.input.readOnly) return; this.input.value = code; this.input.dispatchEvent(new Event('input', { bubbles: true })); this.onRead(code); }
  }
  Object.assign(UI, { BarcodeScanner, BarcodeField });
})();
