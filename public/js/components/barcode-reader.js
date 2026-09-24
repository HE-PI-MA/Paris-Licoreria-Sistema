/** Lector común: cámara o fotografía de barras; un lector USB/Bluetooth entra por el mismo campo como teclado. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class BarcodeScanner {
    constructor({ onRead, opener }) {
      this.onRead = onRead;
      this.generation = 0;
      this.confirming = false;
      this.controls = null;
      this.stream = null;
      this.timer = null;
      this.completeTimer = null;
      this.audioContext = null;

      const content = UI.element('div', 'app-scanner');
      this.preview = UI.element('div', 'app-scanner-preview');
      this.video = UI.element('video', 'app-scanner-video');
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.autoplay = true;
      this.overlay = UI.element('canvas', 'app-scanner-overlay');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.guide = UI.element('div', 'app-scanner-guide');
      this.guide.setAttribute('aria-hidden', 'true');
      this.preview.append(this.video, this.overlay, this.guide);
      this.preview.hidden = true;

      this.help = UI.element('p', 'app-field-help', 'Preparando lector de código…');
      this.help.setAttribute('role', 'status');
      this.help.setAttribute('aria-live', 'polite');

      const toolbar = UI.element('div', 'app-section-toolbar');
      this.start = UI.Button.create({ label: 'Reintentar cámara', icon: 'camera', variant: 'primary' });
      const photo = UI.Button.create({ label: 'Tomar foto del código', icon: 'camera', variant: 'primary' });
      const input = UI.element('input');
      input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.setAttribute('capture', 'environment'); input.hidden = true;
      const choose = UI.Button.create({ label: 'Subir foto del código', icon: 'camera' });
      const file = UI.element('input');
      file.type = 'file'; file.accept = input.accept; file.hidden = true;
      toolbar.append(this.start, photo, input, choose, file);
      content.append(this.preview, this.help, toolbar);

      this.prepareFeedback();
      this.modal = new UI.Modal({
        title: 'Leer código de barras', icon: 'barcode', content,
        onClose: () => { this.stop(); this.closeFeedback(); this.modal.destroy(); }
      });
      const options = { signal: this.modal.events.signal };
      this.start.addEventListener('click', () => this.camera(), options);
      photo.addEventListener('click', () => input.click(), options);
      input.addEventListener('change', () => { const selected = input.files[0]; input.value = ''; if (selected) this.photo(selected); }, options);
      choose.addEventListener('click', () => file.click(), options);
      file.addEventListener('change', () => { const selected = file.files[0]; file.value = ''; if (selected) this.photo(selected); }, options);
      const close = UI.Button.create({ label: 'Cerrar' });
      close.addEventListener('click', () => this.modal.requestClose(), options);
      this.modal.footer.append(close);
      window.addEventListener('pagehide', () => this.stop(), options);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); }, options);
      this.modal.events.signal.addEventListener('abort', () => this.stop(), { once: true });
      this.modal.open(opener);

      this.start.hidden = !BarcodeScanner.liveAvailable();
      if (this.start.hidden) {
        this.help.textContent = 'La cámara en vivo necesita HTTPS. Puedes tomar una foto del código o subir una imagen.';
      } else {
        // Este constructor nace de un clic del usuario: iniciar la cámara sin pedir un segundo clic.
        void this.camera();
      }
    }

    static liveAvailable() { return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia); }

    static decoder() {
      if (!window.ZXingBrowser) throw new Error('No se pudo cargar el lector. Recarga la página.');
      const TRY_HARDER = 3;
      const ZX = window.ZXingBrowser;
      const reader = new ZX.BrowserMultiFormatReader(new Map([[TRY_HARDER, true]]), {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 350,
        tryPlayVideoTimeout: 3000
      });
      reader.possibleFormats = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'CODE_93', 'ITF', 'CODABAR']
        .map(name => ZX.BarcodeFormat[name]);
      return reader;
    }

    static async readPhoto(file) { return this.decoder().decodeFromCanvas(await UI.ImageFile.canvas(file, 1920)).getText(); }

    prepareFeedback() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      try {
        this.audioContext = new Audio();
        if (this.audioContext.state === 'suspended') void this.audioContext.resume();
      } catch (_) { this.audioContext = null; }
    }

    closeFeedback() {
      try { if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }

    feedback() {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(55);
      const context = this.audioContext;
      if (!context) return;
      try {
        if (context.state === 'suspended') void context.resume();
        const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
        oscillator.type = 'sine'; oscillator.frequency.value = 1050;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(now); oscillator.stop(now + 0.12);
      } catch (_) {}
    }

    clearOverlay() {
      const context = this.overlay.getContext('2d');
      if (context) context.clearRect(0, 0, this.overlay.width, this.overlay.height);
      this.preview.classList.remove('is-detected');
    }

    drawDetection(result, code) {
      if (!result || this.preview.hidden) return;
      const width = this.video.videoWidth, height = this.video.videoHeight;
      if (!width || !height) return;
      const sourcePoints = typeof result.getResultPoints === 'function' ? result.getResultPoints() || [] : [];
      const points = sourcePoints.map(point => ({
        x: Number(typeof point.getX === 'function' ? point.getX() : point.x),
        y: Number(typeof point.getY === 'function' ? point.getY() : point.y)
      })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (points.length < 2) return;

      this.overlay.width = width; this.overlay.height = height;
      const context = this.overlay.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const detectedWidth = Math.max(1, maxX - minX), detectedHeight = Math.max(1, maxY - minY);
      const paddingX = Math.max(18, width * 0.018, detectedWidth * 0.08);
      const paddingY = Math.max(38, height * 0.06, detectedHeight * 0.6);
      const x = Math.max(0, minX - paddingX), y = Math.max(0, minY - paddingY);
      const boxWidth = Math.min(width - x, detectedWidth + paddingX * 2);
      const boxHeight = Math.min(height - y, detectedHeight + paddingY * 2);
      const rootStyle = getComputedStyle(document.documentElement);
      const gold = rootStyle.getPropertyValue('--app-gold-300').trim() || '#f5cd72';
      const black = rootStyle.getPropertyValue('--app-black').trim() || '#070706';

      context.save();
      context.strokeStyle = gold; context.lineWidth = Math.max(4, width / 340);
      context.shadowColor = 'rgba(0,0,0,.5)'; context.shadowBlur = Math.max(5, width / 220);
      context.strokeRect(x, y, boxWidth, boxHeight); context.shadowBlur = 0;
      const text = String(code).slice(0, 40), fontSize = Math.max(18, Math.round(width * 0.022));
      const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
      context.font = `700 ${fontSize}px ${fontFamily}`;
      const horizontal = Math.max(9, fontSize * 0.45), vertical = Math.max(6, fontSize * 0.28);
      const textWidth = context.measureText(text).width, labelWidth = Math.min(width - 8, textWidth + horizontal * 2);
      const labelHeight = fontSize + vertical * 2, labelX = Math.max(4, Math.min(x, width - labelWidth - 4));
      let labelY = y - labelHeight - 8;
      if (labelY < 4) labelY = Math.min(height - labelHeight - 4, y + boxHeight + 8);
      context.globalAlpha = 0.88; context.fillStyle = black; context.fillRect(labelX, labelY, labelWidth, labelHeight);
      context.globalAlpha = 1; context.fillStyle = gold; context.textBaseline = 'middle';
      context.fillText(text, labelX + horizontal, labelY + labelHeight / 2);
      context.restore();
      this.preview.classList.add('is-detected');
    }

    stop() {
      this.generation++; this.confirming = false;
      if (this.completeTimer) window.clearTimeout(this.completeTimer); this.completeTimer = null;
      this.controls?.stop(); this.controls = null;
      this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
      this.video.srcObject = null; this.preview.hidden = true; this.start.disabled = false; this.clearOverlay();
      if (this.timer) window.clearTimeout(this.timer); this.timer = null;
    }

    complete(value, generation, result = null) {
      if (this.modal.destroyed || generation !== this.generation || this.confirming) return;
      const code = String(value).trim();
      if (!code || code.length > 50 || /[\u0000-\u001f\u007f]/.test(code)) {
        this.stop(); this.help.textContent = 'El código no es válido. Prueba de nuevo.'; return;
      }
      this.confirming = true;
      if (result) this.drawDetection(result, code);
      this.help.textContent = 'Código detectado: ' + code;
      this.feedback();
      this.completeTimer = window.setTimeout(() => {
        if (this.modal.destroyed || generation !== this.generation) return;
        const callback = this.onRead;
        this.stop(); this.modal.close(); callback(code);
      }, 260);
    }

    async camera() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        this.help.textContent = 'La cámara en vivo necesita HTTPS. Usa Tomar foto del código si no está disponible.'; return;
      }
      this.stop(); const generation = this.generation; this.start.disabled = true;
      this.help.textContent = 'Permite el acceso a la cámara…';
      this.timer = window.setTimeout(() => {
        if (generation === this.generation) { this.stop(); this.help.textContent = 'No se pudo completar la lectura. Reintenta o usa una foto.'; }
      }, 45000);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (this.modal.destroyed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
        this.stream = stream; this.video.srcObject = stream; this.preview.hidden = false;
        this.help.textContent = 'Apunta al código. Se leerá automáticamente.';
        const controls = await BarcodeScanner.decoder().decodeFromStream(stream, this.video, result => {
          if (result) this.complete(result.getText(), generation, result);
        });
        if (this.modal.destroyed || generation !== this.generation) controls.stop(); else this.controls = controls;
      } catch (_) {
        if (!this.modal.destroyed && generation === this.generation) {
          this.stop(); this.help.textContent = 'No se pudo abrir la cámara. Revisa el permiso o usa una foto.';
        }
      }
    }

    async photo(file) {
      this.stop(); const generation = this.generation; this.help.textContent = 'Leyendo foto…';
      try { this.complete(await BarcodeScanner.readPhoto(file), generation); }
      catch (_) {
        if (generation === this.generation && !this.modal.destroyed) {
          this.help.textContent = 'No se distinguieron las barras. Toma una foto más cerca y bien iluminada.';
        }
      }
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
