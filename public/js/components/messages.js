/**
 * Mensajes comunes para módulos, formularios y notificaciones.
 * Message presenta el aviso; NotificationCenter administra únicamente su posición y duración.
 */
(() => {
  'use strict';
  const UI = window.ParisUI;

  class Message {
    static defaults = Object.freeze({
      info: 'Información.', success: 'Operación completada.', warning: 'Revisa la información.',
      error: 'No se pudo completar la acción. Inténtalo nuevamente.',
      loading: 'Cargando…', empty: 'No hay registros para mostrar.'
    });

    constructor(element, { text, icons } = {}) {
      this.element = element;
      this.text = text || element.querySelector('[data-message-text]');
      this.icons = icons || element.querySelectorAll('[data-message-icon]');
      if (!this.text) throw new TypeError('El mensaje necesita un elemento para su texto.');
    }

    static create(container) {
      const element = UI.element('div', 'app-alert');
      const icon = UI.element('span', 'app-alert-icon');
      icon.setAttribute('aria-hidden', 'true');
      for (const kind of Object.keys(this.defaults)) {
        const wrapper = UI.element('span');
        wrapper.dataset.messageIcon = kind;
        const svg = UI.Icon.create(kind === 'loading' ? 'refresh' : kind === 'empty' ? 'box' : kind);
        if (svg) wrapper.append(svg);
        icon.append(wrapper);
      }
      const text = UI.element('p');
      text.dataset.messageText = '';
      element.append(icon, text);
      element.hidden = true;
      container.append(element);
      return new Message(element);
    }

    show(kind = 'info', text) {
      if (!Object.hasOwn(Message.defaults, kind)) throw new TypeError('Tipo de mensaje no válido.');
      this.element.dataset.kind = kind;
      this.element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      this.element.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
      this.element.setAttribute('aria-atomic', 'true');
      this.icons.forEach(icon => { icon.hidden = icon.dataset.messageIcon !== kind; });
      this.element.hidden = false;
      this.text.textContent = typeof text === 'string' && text.trim() ? text : Message.defaults[kind];
      return this;
    }

    clear() {
      this.element.hidden = true;
      this.text.textContent = '';
    }
  }

  class NotificationCenter {
    constructor() {
      this.region = UI.element('section', 'app-notifications');
      this.region.setAttribute('aria-label', 'Notificaciones');
      this.entries = new Set();
      this.events = new AbortController();
      document.body.append(this.region);
      // Los avisos permanecen accesibles cuando hay un diálogo en la capa superior.
      document.addEventListener('paris:modalchange', () => this.moveToTop(), { signal: this.events.signal });
      document.addEventListener('visibilitychange', () => {
        for (const entry of this.entries) document.hidden ? entry.pause() : entry.resume();
      }, { signal: this.events.signal });
    }

    moveToTop() {
      const host = UI.Modal?.top?.element || document.body;
      host.append(this.region);
    }

    /** Error, advertencia y carga no desaparecen automáticamente, aunque se envíe duration. */
    show(kind, text, { duration = 6000 } = {}) {
      if (!Object.hasOwn(Message.defaults, kind)) throw new TypeError('Tipo de mensaje no válido.');
      this.moveToTop();
      const message = Message.create(this.region);
      message.element.classList.add('app-toast');
      const close = UI.Button.create({ label: 'Cerrar notificación', icon: 'close', iconOnly: true });
      message.element.append(close);
      const events = new AbortController();
      let timer = null, started = 0, disposed = false;
      let remaining = ['error', 'warning', 'loading'].includes(kind) ? 0 : Math.max(0, Number(duration) || 0);
      const entry = {
        pause: () => {
          if (timer !== null) {
            window.clearTimeout(timer);
            remaining = Math.max(0, remaining - (Date.now() - started));
            timer = null;
          }
        },
        resume: () => {
          if (disposed || !remaining || timer !== null || document.hidden ||
              message.element.matches(':hover') || message.element.contains(document.activeElement)) return;
          started = Date.now();
          timer = window.setTimeout(() => entry.close(), remaining);
        },
        close: () => {
          if (disposed) return;
          disposed = true;
          entry.pause();
          const hadFocus = message.element.contains(document.activeElement);
          events.abort();
          message.element.remove();
          this.entries.delete(entry);
          if (hadFocus) (UI.Modal?.top?.closeButton || document.getElementById('module-content'))?.focus();
        }
      };
      close.addEventListener('click', entry.close, { signal: events.signal });
      message.element.addEventListener('pointerenter', entry.pause, { signal: events.signal });
      message.element.addEventListener('pointerleave', entry.resume, { signal: events.signal });
      message.element.addEventListener('focusin', entry.pause, { signal: events.signal });
      message.element.addEventListener('focusout', () => window.setTimeout(entry.resume, 0), { signal: events.signal });
      this.entries.add(entry);
      message.show(kind, text);
      entry.resume();
      return { close: entry.close };
    }

    destroy() {
      for (const entry of this.entries) entry.close();
      this.events.abort();
      this.region.remove();
    }
  }

  Object.assign(UI, { Message, NotificationCenter });
})();
