/** API de Productos: declara sus rutas específicas y hereda envío, CSRF y reintentos del cliente compartido. */
(() => {
  'use strict';
  class ProductsApi extends window.ParisUI.CatalogApi {
    constructor() { super('/api/productos'); }
    options(kind, params) { return this.request('/opciones/' + kind + this.query(params), { signal: params.signal }); }
    presentations(id, params) { return this.request('/' + id + '/presentaciones' + this.query(params), { signal: params.signal }); }
    presentation(id, child) { return this.request('/' + id + '/presentaciones/' + child); }
  }
  window.ParisProducts = { ProductsApi, ProductsApiError: window.ParisUI.CatalogApiError };
})();
