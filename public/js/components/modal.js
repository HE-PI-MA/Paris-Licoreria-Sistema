/**
 * Diálogo reutilizable con cabecera, cuerpo desplazable y pie.
 * Controla teclado, foco y descarte de cambios; Confirm utiliza exactamente este mismo diálogo.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;

  class Modal {
    static opened = [];
    static get top() { return this.opened[this.opened.length - 1]; }

    constructor({ title, size = 'medium', content, isDirty = () => false, onClose = () => {} } = {}) {
      if (!title || !['small', 'medium', 'large'].includes(size)) throw new TypeError('Título o tamaño de modal no válido.');
      this.isDirty = isDirty;
      this.onClose = onClose;
      this.events = new AbortController();
      this.busy = false;
      this.pendingClose = false;
      this.destroyed = false;
      this.element = UI.element('dialog', 'app-modal app-modal--' + size);
      this.element.setAttribute('aria-modal', 'true');
      this.element.tabIndex = -1;
      const header = UI.element('header', 'app-modal-header');
      this.title = UI.element('h2', '', title);
      this.title.id = 'paris-modal-title-' + (++sequence);
      this.element.setAttribute('aria-labelledby', this.title.id);
      this.closeButton = UI.Button.create({ label: 'Cerrar ' + title, icon: 'close', iconOnly: true });
      header.append(this.title, this.closeButton);
      this.body = UI.element('div', 'app-modal-body');
      this.body.id = 'paris-modal-body-' + sequence;
      this.footer = UI.element('footer', 'app-modal-footer');
      this.element.append(header, this.body, this.footer);
      if (content) this.setContent(content);
      this.closeButton.addEventListener('click', () => this.requestClose(), { signal: this.events.signal });
      this.element.addEventListener('cancel', event => {
        event.preventDefault();
        this.requestClose();
      }, { signal: this.events.signal });
      this.element.addEventListener('keydown', event => this.onKeyDown(event), { signal: this.events.signal });
      this.element.addEventListener('close', () => this.afterClose(), { signal: this.events.signal });
    }

    /** Admite un nodo creado por el módulo o texto plano, nunca cadenas de HTML. */
    setContent(content) {
      if (typeof content === 'string') {
        this.body.textContent = content;
        this.element.setAttribute('aria-describedby', this.body.id);
      } else if (content instanceof Node) {
        this.body.replaceChildren(content);
        this.element.removeAttribute('aria-describedby');
      }
      else throw new TypeError('El cuerpo debe ser un nodo o texto.');
    }

    open(opener = document.activeElement) {
      if (this.destroyed) throw new Error('El modal ya fue destruido.');
      if (this.element.open) return;
      this.opener = opener;
      this.parent = Modal.top;
      document.body.append(this.element);
      this.element.showModal();
      Modal.opened.push(this);
      document.body.classList.add('app-modal-open');
      document.dispatchEvent(new CustomEvent('paris:modalchange'));
      const initial = this.element.querySelector('[data-modal-initial-focus]') || this.closeButton;
      initial.focus();
    }

    setBusy(busy) {
      if (this.busy === Boolean(busy)) return;
      this.busy = Boolean(busy);
      if (this.busy) {
        this.blockedButtons = [this.closeButton, ...this.footer.querySelectorAll('button:not([type="submit"])')]
          .map(button => ({ button, disabled: button.disabled }));
        this.blockedButtons.forEach(({ button }) => { button.disabled = true; });
      } else this.blockedButtons?.forEach(({ button, disabled }) => { button.disabled = disabled; });
      this.element.setAttribute('aria-busy', String(this.busy));
    }

    /** Evita confirmaciones repetidas al pulsar Escape varias veces. */
    async requestClose() {
      if (!this.element.open || this.busy || this.pendingClose || Modal.top !== this) return false;
      this.pendingClose = true;
      try {
        if (this.isDirty()) {
          const discarded = await Confirm.ask({
            title: 'Descartar cambios', message: 'Hay cambios sin guardar. ¿Quieres descartarlos?',
            confirmLabel: 'Descartar cambios', danger: true
          });
          if (!discarded || this.destroyed || this.busy) return false;
        }
        this.close();
        return true;
      } finally { this.pendingClose = false; }
    }

    /** El módulo llama a close después de guardar; el cierre del usuario usa requestClose. */
    close(value = '') {
      if (!this.element.open || this.busy) return;
      this.element.close(String(value));
      this.afterClose();
    }

    afterClose() {
      if (this.element.open) return; // Ignora el evento tardío de un cierre anterior si ya se reabrió.
      const index = Modal.opened.indexOf(this);
      if (index === -1) return;
      Modal.opened.splice(index, 1);
      document.body.classList.toggle('app-modal-open', Modal.opened.length > 0);
      document.dispatchEvent(new CustomEvent('paris:modalchange'));
      const target = this.opener?.isConnected && !this.opener.disabled && this.opener.getClientRects().length
        ? this.opener : Modal.top?.closeButton || document.getElementById('module-content');
      target?.focus();
      this.onClose(this.element.returnValue);
    }

    onKeyDown(event) {
      if (Modal.top !== this) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.requestClose();
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(this.element.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]'
      )).filter(node => !node.disabled && node.tabIndex >= 0 &&
        !node.closest('[hidden], [inert]') && node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); this.element.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const child of [...Modal.opened].reverse()) if (child.parent === this) child.destroy();
      this.busy = false;
      this.close();
      this.events.abort();
      this.element.remove();
    }
  }

  class Confirm {
    /** Cancelar recibe el foco inicial para evitar aceptar accidentalmente una acción peligrosa. */
    static ask({ title = 'Confirmar acción', message, confirmLabel = 'Continuar', danger = false } = {}) {
      return new Promise(resolve => {
        const modal = new Modal({
          title, size: 'small', content: String(message || ''),
          onClose: value => { modal.destroy(); resolve(value === 'confirmed'); }
        });
        const cancel = UI.Button.create({ label: 'Cancelar' });
        cancel.dataset.modalInitialFocus = '';
        const accept = UI.Button.create({ label: confirmLabel, variant: danger ? 'danger' : 'primary' });
        cancel.addEventListener('click', () => modal.close('cancelled'), { signal: modal.events.signal });
        accept.addEventListener('click', () => modal.close('confirmed'), { signal: modal.events.signal });
        modal.footer.append(cancel, accept);
        modal.open();
      });
    }
  }
  Object.assign(UI, { Modal, Confirm });
})();
