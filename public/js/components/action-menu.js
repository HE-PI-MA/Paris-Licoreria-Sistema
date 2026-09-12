/**
 * Menú de acciones reutilizable. Conserva nombres accesibles, flechas, Escape y retorno del foco.
 * El módulo recibe la opción elegida; el menú nunca realiza operaciones del negocio.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;
  let sequence = 0;
  class ActionMenu {
    static active = null;
    constructor({ container, label = 'Acciones', triggerLabel = label, items, onSelect } = {}) {
      if (!(container instanceof HTMLElement) || !Array.isArray(items) || typeof onSelect !== 'function') {
        throw new TypeError('El menú necesita un contenedor, opciones y una función.');
      }
      this.events = new AbortController();
      this.onSelect = onSelect;
      this.root = UI.element('div', 'app-action-menu');
      this.trigger = UI.Button.create({ label: triggerLabel, variant: 'primary' });
      this.trigger.setAttribute('aria-label', label);
      this.trigger.setAttribute('aria-haspopup', 'menu');
      this.trigger.setAttribute('aria-expanded', 'false');
      this.panel = UI.element('div', 'app-action-menu-panel');
      this.panel.id = 'paris-actions-' + (++sequence);
      this.panel.setAttribute('role', 'menu');
      this.panel.setAttribute('aria-label', label);
      this.panel.setAttribute('popover', 'manual');
      this.panel.hidden = true;
      this.trigger.setAttribute('aria-controls', this.panel.id);
      this.items = items;
      this.buttons = items.map((item, index) => {
        // Paleta semántica compartida, independiente de las operaciones de cada módulo.
        const tone = item.tone || (item.variant === 'danger' ? 'danger' : 'info');
        const button = UI.Button.create({ ...item, tone });
        button.classList.add('app-button--menu');
        button.dataset.actionTone = tone;
        button.setAttribute('role', 'menuitem');
        button.tabIndex = -1;
        button.addEventListener('click', () => {
          if (button.disabled) return;
          this.close(true);
          // Los errores asíncronos se presentan en el mismo sistema de mensajes del módulo.
          Promise.resolve().then(() => this.onSelect(item, { button: this.trigger, index })).catch(() => {
            window.ParisModule?.showMessage('error', 'No se pudo completar la acción. Inténtalo nuevamente.');
          });
        }, { signal: this.events.signal });
        this.panel.append(button);
        return button;
      });
      this.root.append(this.trigger, this.panel);
      container.append(this.root);
      const options = { signal: this.events.signal };
      this.trigger.addEventListener('click', () => this.opened ? this.close(true) : this.open(), options);
      this.trigger.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); this.open(event.key === 'ArrowUp');
        }
      }, options);
      this.panel.addEventListener('keydown', event => this.onKeyDown(event), options);
    }
    get enabled() { return this.buttons.filter(button => !button.disabled); }
    position() {
      const bounds = this.trigger.getBoundingClientRect();
      const rect = this.panel.getBoundingClientRect();
      const below = bounds.bottom + 4;
      this.panel.style.left = Math.max(10, Math.min(bounds.left, window.innerWidth - rect.width - 10)) + 'px';
      this.panel.style.top = Math.max(10, Math.min(below + rect.height <= window.innerHeight - 10 ? below : bounds.top - rect.height - 4,
        window.innerHeight - rect.height - 10)) + 'px';
    }
    open(last = false) {
      if (this.destroyed || this.trigger.disabled || !this.enabled.length) return;
      ActionMenu.active?.close();
      this.opened = true;
      ActionMenu.active = this;
      this.panel.hidden = false;
      // El popover evita recortes dentro de tablas desplazables y funciona también dentro de un modal.
      if (this.panel.showPopover) this.panel.showPopover();
      else (this.trigger.closest('dialog') || document.body).append(this.panel);
      this.trigger.setAttribute('aria-expanded', 'true');
      this.position();
      this.openEvents = new AbortController();
      const options = { signal: this.openEvents.signal };
      document.addEventListener('pointerdown', event => {
        if (!this.panel.contains(event.target) && !this.trigger.contains(event.target)) this.close();
      }, options);
      document.addEventListener('focusin', event => {
        if (!this.panel.contains(event.target) && !this.trigger.contains(event.target)) this.close();
      }, options);
      window.addEventListener('resize', () => this.close(true), options);
      // Un desplazamiento pendiente del botón puede llegar después del clic; reposicionar evita cerrar el menú recién abierto.
      document.addEventListener('scroll', event => {
        if (this.panel.contains(event.target)) return;
        const bounds = this.trigger.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= innerHeight || bounds.right <= 0 || bounds.left >= innerWidth) this.close();
        else this.position();
      }, { ...options, capture: true });
      this.enabled[last ? this.enabled.length - 1 : 0].focus({ preventScroll: true });
    }
    onKeyDown(event) {
      const buttons = this.enabled, index = buttons.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
          (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); this.close(true);
      } else if (event.key === 'Tab') this.close(true);
    }
    close(returnFocus = false) {
      if (!this.opened) return;
      this.opened = false;
      this.openEvents?.abort();
      if (this.panel.hidePopover && this.panel.matches(':popover-open')) this.panel.hidePopover();
      this.panel.hidden = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      if (ActionMenu.active === this) ActionMenu.active = null;
      if (returnFocus && this.trigger.isConnected && !this.trigger.disabled) this.trigger.focus({ preventScroll: true });
    }
    destroy() { this.close(); this.destroyed = true; this.events.abort(); this.panel.remove(); this.root.remove(); }
  }
  UI.ActionMenu = ActionMenu;
})();
