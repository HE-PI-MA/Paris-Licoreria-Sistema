(() => {
  'use strict';
  const layout = document.querySelector('[data-module-layout]');
  if (!layout) return;
  const content = layout.querySelector('[data-module-region="content"]');
  const status = layout.querySelector('[data-module-status]');
  const statusText = layout.querySelector('[data-module-status-text]');
  const error = layout.querySelector('[data-module-error]');
  const errorText = layout.querySelector('[data-module-error-text]');
  const defaultMessage = statusText.textContent;
  const defaults = {
    info: defaultMessage,
    loading: 'Cargando…',
    success: 'Operación completada.',
    warning: 'Revisa la información antes de continuar.',
    error: 'No se pudo completar la acción. Inténtalo nuevamente.',
    empty: 'No hay registros para mostrar.'
  };

  /** Oculta el mensaje y finaliza cualquier estado de carga del contenido. */
  function clearMessage() {
    status.hidden = true;
    error.hidden = true;
    statusText.textContent = '';
    errorText.textContent = '';
    content.setAttribute('aria-busy', 'false');
  }

  /** Cambia el aviso compartido; usa texto plano y anuncia errores por separado. */
  function showMessage(kind = 'info', message) {
    if (!Object.hasOwn(defaults, kind)) throw new TypeError('Tipo de mensaje no válido.');
    const text = typeof message === 'string' && message.trim() ? message : defaults[kind];
    clearMessage();
    content.setAttribute('aria-busy', String(kind === 'loading'));
    if (kind === 'error') {
      error.hidden = false;
      errorText.textContent = text;
      return;
    }
    status.dataset.kind = kind;
    layout.querySelectorAll('[data-message-icon]').forEach(icon => { icon.hidden = icon.dataset.messageIcon !== kind; });
    status.hidden = false;
    statusText.textContent = text;
  }

  // Los futuros scripts de los módulos reutilizan estos mensajes.
  // Esta base no hace consultas, no simula resultados ni activa botones de negocio.
  window.ParisModule = Object.freeze({
    id: layout.dataset.moduleLayout,
    showMessage,
    clearMessage,
    resetMessage: () => showMessage('info', defaultMessage)
  });
})();
