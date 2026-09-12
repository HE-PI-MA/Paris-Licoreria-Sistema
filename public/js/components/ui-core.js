/**
 * Utilidades visuales compartidas: elementos con texto seguro, iconos locales y botones.
 * TextCase normaliza solo texto del negocio marcado explícitamente por cada formulario.
 * Los iconos se clonan de plantillas EJS controladas; los datos nunca se interpretan como HTML.
 */
(() => {
  'use strict';
  const UI = window.ParisUI = window.ParisUI || {};

  UI.element = (tag, className = '', text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  class Icon {
    static create(name) {
      // El nombre solo selecciona una plantilla existente; no se usa en un selector CSS.
      const template = Array.from(document.querySelectorAll('template[data-ui-icon]'))
        .find(item => item.dataset.uiIcon === name);
      return template ? template.content.firstElementChild.cloneNode(true) : null;
    }
  }

  /** Presentación numérica común; no modifica el dato que se enviará al servidor. */
  class ValueFormat {
    static number(value, { type = 'quantity', locale = 'es-BO', currency = 'BOB', decimals = 0 } = {}) {
      if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
      const options = type === 'price' ? { style: 'currency', currency } :
        { maximumFractionDigits: type === 'quantity' ? 3 : decimals };
      return new Intl.NumberFormat(locale, options).format(Number(value));
    }
  }

  class Button {
    static states = new WeakMap();

    /** Un botón solo con icono también necesita un nombre legible por lectores de pantalla. */
    static create({ label, icon, variant = 'secondary', iconOnly = false, type = 'button', disabled = false } = {}) {
      if (typeof label !== 'string' || !label.trim()) throw new TypeError('El botón necesita un nombre.');
      if (!['primary', 'secondary', 'danger'].includes(variant)) throw new TypeError('Estilo de botón no válido.');
      const button = UI.element('button', 'app-button app-button--' + variant);
      button.type = type;
      button.disabled = disabled;
      const image = Icon.create(icon);
      if (image) button.append(image);
      const text = UI.element('span', iconOnly ? 'app-sr-only' : '', label);
      button.append(text);
      if (iconOnly) {
        button.classList.add('app-button--icon');
        button.setAttribute('aria-label', label);
        button.title = label;
      }
      return button;
    }

    /** Conserva los nodos originales y el estado desactivado, incluso si se llama varias veces. */
    static setBusy(button, busy, label = 'Procesando…') {
      if (busy) {
        if (this.states.has(button)) return;
        this.states.set(button, {
          nodes: Array.from(button.childNodes), disabled: button.disabled,
          aria: button.getAttribute('aria-label'), busy: button.getAttribute('aria-busy')
        });
        button.replaceChildren(UI.element('span', 'app-spinner'), UI.element('span', '', label));
        button.firstChild.setAttribute('aria-hidden', 'true');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        if (button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
      } else {
        const previous = this.states.get(button);
        if (!previous) return;
        button.replaceChildren(...previous.nodes);
        button.disabled = previous.disabled;
        for (const [attribute, value] of [['aria-label', previous.aria], ['aria-busy', previous.busy]]) {
          if (value === null) button.removeAttribute(attribute);
          else button.setAttribute(attribute, value);
        }
        this.states.delete(button);
      }
    }
  }

  /** Normaliza campos de texto del negocio al escribir, respetando composición y posición del cursor. */
  class TextCase {
    constructor(root = document) {
      this.events = new AbortController();
      const normalize = event => {
        const input = event.target;
        if (event.isComposing || !input.matches?.('[data-uppercase]') ||
            !(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement && ['text', 'search'].includes(input.type))) return;
        const value = input.value, start = input.selectionStart, end = input.selectionEnd, direction = input.selectionDirection;
        const upper = value.toLocaleUpperCase('es');
        if (upper === value) return;
        input.value = upper;
        if (start !== null) input.setSelectionRange(value.slice(0, start).toLocaleUpperCase('es').length, value.slice(0, end).toLocaleUpperCase('es').length, direction);
      };
      root.addEventListener('input', normalize, { capture: true, signal: this.events.signal });
      root.addEventListener('compositionend', normalize, { capture: true, signal: this.events.signal });
    }
    destroy() { this.events.abort(); }
  }
  Object.assign(UI, { Icon, Button, TextCase, ValueFormat });
  UI.textCase = UI.textCase || new TextCase();
})();
