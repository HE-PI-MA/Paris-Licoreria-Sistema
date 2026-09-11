/**
 * Utilidades visuales compartidas: elementos con texto seguro, iconos locales y botones.
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

  Object.assign(UI, { Icon, Button });
})();
