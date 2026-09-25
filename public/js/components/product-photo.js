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
      for (const quality of [.85, .75, .65, .5]) {
        let data = canvas.toDataURL('image/webp', quality);
        // Algunos navegadores no codifican WebP: el servidor completa la conversión al guardar.
        if (!data.startsWith('data:image/webp;')) data = canvas.toDataURL('image/jpeg', quality);
        if (data.length < 270000) return data;
      }
      throw new Error('No se pudo reducir esta foto. Prueba con otra imagen.');
    }
  }
  class PhotoCamera {
    constructor({ onCapture, opener }) {
      this.onCapture = onCapture;
      this.stream = null;
      this.resizeObserver = null;
      this.generation = 0;
      this.busy = false;

      const content = UI.element('div', 'app-photo-camera');
      this.preview = UI.element('div', 'app-photo-camera-preview');
      this.video = UI.element('video', 'app-photo-camera-video');
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.autoplay = true;

      this.guide = UI.element('div', 'app-photo-camera-guide');
      this.guide.setAttribute('aria-hidden', 'true');
      this.preview.append(this.video, this.guide);

      this.help = UI.element(
        'p',
        'app-field-help',
        'Coloca el producto dentro del cuadrado. La foto guardada tendrá ese encuadre.'
      );
      this.help.setAttribute('role', 'status');
      this.help.setAttribute('aria-live', 'polite');
      content.append(this.preview, this.help);

      this.modal = new UI.Modal({
        title: 'Tomar foto del producto',
        icon: 'camera',
        size: 'medium',
        content,
        onClose: () => {
          this.stop();
          this.modal.destroy();
        }
      });

      const options = { signal: this.modal.events.signal };
      const cancel = UI.Button.create({ label: 'Cancelar' });
      this.capture = UI.Button.create({
        label: 'Tomar foto',
        icon: 'camera',
        variant: 'primary',
        disabled: true
      });

      cancel.addEventListener('click', () => this.modal.requestClose(), options);
      this.capture.addEventListener('click', () => void this.take(), options);
      this.modal.footer.append(cancel, this.capture);
      this.modal.events.signal.addEventListener('abort', () => this.stop(), { once: true });
      window.addEventListener('pagehide', () => this.stop(), options);

      this.modal.open(opener);
      void this.start();
    }

    static available() {
      return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
    }

    async start() {
      if (!PhotoCamera.available()) {
        this.help.textContent = 'La cámara guiada necesita HTTPS.';
        return;
      }

      this.stop();
      const generation = this.generation;
      this.help.textContent = 'Permite el acceso a la cámara…';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        if (this.modal.destroyed || generation !== this.generation) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        this.stream = stream;
        this.video.srcObject = stream;
        await this.video.play().catch(() => {});

        if (this.modal.destroyed || generation !== this.generation) {
          this.stop();
          return;
        }

        this.resizeObserver = new ResizeObserver(() => this.frameGuide());
        this.resizeObserver.observe(this.video);
        this.video.addEventListener('loadedmetadata', () => this.frameGuide(), {
          once: true,
          signal: this.modal.events.signal
        });

        this.frameGuide();
        this.capture.disabled = false;
        this.help.textContent = 'Coloca el producto dentro del cuadrado. La foto guardada tendrá ese encuadre.';
      } catch (_) {
        if (!this.modal.destroyed && generation === this.generation) {
          this.stop();
          this.help.textContent = 'No se pudo abrir la cámara. Revisa el permiso o usa Elegir foto.';
        }
      }
    }

    displayedVideoRect() {
      const boxWidth = this.video.clientWidth;
      const boxHeight = this.video.clientHeight;
      const sourceWidth = this.video.videoWidth;
      const sourceHeight = this.video.videoHeight;
      if (!boxWidth || !boxHeight || !sourceWidth || !sourceHeight) return null;

      const sourceRatio = sourceWidth / sourceHeight;
      const boxRatio = boxWidth / boxHeight;

      if (sourceRatio > boxRatio) {
        const width = boxWidth;
        const height = width / sourceRatio;
        return { left: 0, top: (boxHeight - height) / 2, width, height };
      }

      const height = boxHeight;
      const width = height * sourceRatio;
      return { left: (boxWidth - width) / 2, top: 0, width, height };
    }

    frameGuide() {
      const rect = this.displayedVideoRect();
      if (!rect) return;

      const side = Math.min(rect.width, rect.height);
      this.guide.style.width = side + 'px';
      this.guide.style.height = side + 'px';
      this.guide.style.left = (rect.left + (rect.width - side) / 2) + 'px';
      this.guide.style.top = (rect.top + (rect.height - side) / 2) + 'px';
    }

    async take() {
      if (this.busy || !this.stream || !this.video.videoWidth || !this.video.videoHeight) return;

      this.busy = true;
      this.capture.disabled = true;
      this.help.textContent = 'Preparando foto…';
      const generation = this.generation;

      try {
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;
        const side = Math.min(width, height);
        const sourceX = (width - side) / 2;
        const sourceY = (height - side) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo preparar la foto.');

        context.drawImage(
          this.video,
          sourceX,
          sourceY,
          side,
          side,
          0,
          0,
          side,
          side
        );

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) throw new Error('No se pudo preparar la foto.');
        if (this.modal.destroyed || generation !== this.generation) return;

        const callback = this.onCapture;
        this.stop();
        this.modal.close();
        await callback(blob);
      } catch (error) {
        if (!this.modal.destroyed && generation === this.generation) {
          this.busy = false;
          this.capture.disabled = false;
          this.help.textContent = error.message || 'No se pudo tomar la foto.';
        }
      }
    }

    stop() {
      this.generation++;
      this.busy = false;
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
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
    constructor({ container, form, modal, firstAction, onChoose, label = 'Foto del producto (opcional)' }) {
      this.events = new AbortController(); this.generation = 0;
      this.onChoose = onChoose;
      this.host = UI.element('div', 'app-field app-field--wide');
      this.host.append(UI.element('span', 'app-label', label));
      const body = UI.element('div', 'app-photo-field'); this.preview = UI.element('div', 'app-photo-preview');
      const controls = UI.element('div', 'app-photo-controls'); this.actions = UI.element('div', 'app-section-toolbar');
      if (firstAction) { firstAction.classList.add('app-field--wide'); this.actions.append(firstAction); }
      this.state = UI.element('input'); this.state.type = 'hidden'; this.state.name = 'photoState'; this.state.value = '';
      this.help = UI.element('p', 'app-field-help'); this.help.setAttribute('role', 'status');
      this.inputs = [];

      const chooseInput = UI.element('input');
      chooseInput.type = 'file';
      chooseInput.accept = 'image/jpeg,image/png,image/webp';
      chooseInput.hidden = true;

      const chooseButton = UI.Button.create({ label: 'Elegir foto', icon: 'camera' });
      chooseButton.addEventListener('click', () => chooseInput.click(), { signal: this.events.signal });
      chooseInput.addEventListener('change', () => {
        const file = chooseInput.files[0];
        chooseInput.value = '';
        if (file) this.choose(file);
      }, { signal: this.events.signal });

      const captureInput = UI.element('input');
      captureInput.type = 'file';
      captureInput.accept = chooseInput.accept;
      captureInput.setAttribute('capture', 'environment');
      captureInput.hidden = true;

      const captureButton = UI.Button.create({ label: 'Tomar foto', icon: 'camera' });
      captureButton.addEventListener('click', () => {
        if (PhotoCamera.available()) {
          this.camera?.modal.destroy();
          this.camera = new PhotoCamera({
            opener: captureButton,
            onCapture: file => this.choose(file)
          });
        } else {
          captureInput.click();
        }
      }, { signal: this.events.signal });

      captureInput.addEventListener('change', () => {
        const file = captureInput.files[0];
        captureInput.value = '';
        if (file) this.choose(file);
      }, { signal: this.events.signal });

      this.inputs.push(chooseInput, captureInput);
      this.actions.append(chooseButton, chooseInput, captureButton, captureInput);
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
      this.remove.hidden = !src;
      this.help.textContent = this.busy ? 'Preparando foto…' : this.readOnly ? 'Puedes cambiar esta foto en Productos.' : 'Foto opcional. Se guarda al confirmar.';
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
        await this.onChoose?.(file, () => !this.destroyed && generation === this.generation);
      } catch (error) {
        if (!this.destroyed && generation === this.generation) UI.NotificationCenter.shared().show('error', error.message || 'No se pudo leer la foto.');
      } finally { if (!this.destroyed && generation === this.generation) { this.busy = false; this.render(); } }
    }
    payload() {
      if (this.busy) throw new UI.CatalogApiError('Espera a que termine de prepararse la foto.');
      return this.value === undefined ? {} : { photo: this.value };
    }
    destroy() { this.destroyed = true; this.generation++; this.camera?.modal.destroy(); this.events.abort(); this.preview.replaceChildren(); this.value = undefined; }
  }
  Object.assign(UI, { ImageFile, PhotoCamera, ProductPhoto, PhotoField });
})();
