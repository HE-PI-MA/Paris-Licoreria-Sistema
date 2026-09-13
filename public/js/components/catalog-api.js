/** Cliente HTTP compartido de los catálogos: transporta JSON, CSRF y una clave estable por intento de escritura. No presenta interfaces. */
(() => {
  'use strict';
  class CatalogApiError extends Error {
    constructor(message, status = 0, fieldErrors = {}) { super(message); this.userMessage = message; this.status = status; this.fieldErrors = fieldErrors; }
  }
  class CatalogApi {
    constructor(base) { this.base = base; }
    query({ page = 1, pageSize = 10, query = {}, sort, term } = {}) {
      const params = new URLSearchParams({ page, pageSize });
      for (const [key, value] of Object.entries(query)) if (value !== '' && value != null) params.set(key, String(value));
      if (term !== undefined) params.set('term', term);
      if (sort) { params.set('sort', sort.key); params.set('direction', sort.direction); }
      return '?' + params;
    }
    async request(path, { body, key, signal } = {}) {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'; headers['x-csrf-token'] = document.querySelector('meta[name="csrf-token"]').content;
        headers['x-operation-id'] = key;
      }
      let response;
      try { response = await fetch(this.base + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
      catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new CatalogApiError('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.');
      }
      let data;
      try { data = await response.json(); } catch (_) { throw new CatalogApiError('La respuesta no pudo leerse. Reintenta la consulta o el envío.', response.status); }
      if (!response.ok) {
        const message = response.status === 401 ? 'La sesión terminó. Vuelve a iniciar sesión antes de continuar.' :
          typeof data.error === 'string' ? data.error : 'No se pudo completar la operación.';
        throw new CatalogApiError(message, response.status, data.fieldErrors || {});
      }
      return data;
    }
    list(params) { return this.request(this.query(params), { signal: params.signal }); }
    detail(id) { return this.request('/' + id); }
    /** Conserva la clave si se reintenta el mismo contenido tras un fallo de red; un contenido distinto inicia otra operación. */
    operation(path) {
      let fingerprint, key;
      return (body, { signal } = {}) => {
        const current = JSON.stringify(body);
        if (current !== fingerprint) { key = crypto.randomUUID(); fingerprint = current; }
        return this.request(path, { body, key, signal });
      };
    }
  }
  Object.assign(window.ParisUI, { CatalogApi, CatalogApiError });
})();
