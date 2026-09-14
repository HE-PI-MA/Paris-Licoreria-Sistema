/** Sugerencias públicas por código: destino fijo, tiempo/tamaño acotados y ninguna escritura o subida de fotos. */
const { ProductError } = require('../domain/ProductInput');
const Barcode = require('../domain/Barcode');
class ProductLookupService {
  constructor({ fetcher = globalThis.fetch, now = Date.now } = {}) { this.fetcher = fetcher; this.now = now; this.cache = new Map(); this.calls = []; }
  static text(value, max = 120) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
  static result(data, code) {
    const p = data?.product;
    if (!p || typeof p !== 'object') return { found: false };
    const returned = String(p.code || data.code || '');
    if (!Barcode.alternatives(code).includes(returned)) throw new Error('Respuesta de otro código');
    const name = this.text(p.product_name_es) || this.text(p.product_name);
    const tags = Array.isArray(p.categories_tags) ? p.categories_tags.filter(v => typeof v === 'string').slice(0, 100) : [];
    const groups = [
      [['en:alcoholic-beverages', 'en:beers', 'en:wines', 'en:spirits'], 'BEBIDAS ALCOHÓLICAS'],
      [['en:sodas', 'en:carbonated-drinks'], 'GASEOSAS'],
      [['en:biscuits', 'en:cookies'], 'GALLETAS'],
      [['en:candies', 'en:confectioneries'], 'DULCES']
    ];
    const category = groups.find(([keys]) => keys.some(key => tags.includes(key)))?.[1] || '';
    return name || category ? { found: true, name, category, source: 'Open Food Facts', sourceUrl: 'https://world.openfoodfacts.org/product/' + code } : { found: false };
  }
  async find(code) {
    if (!Barcode.valid(code)) throw new ProductError(422, 'La consulta pública admite códigos comerciales EAN o UPC válidos. Puedes registrar otros códigos manualmente.');
    const now = this.now(), cached = this.cache.get(code);
    if (cached?.until > now) return cached.value;
    this.calls = this.calls.filter(time => time > now - 60000);
    if (this.calls.length >= 12) throw new ProductError(429, 'Espera un minuto antes de consultar más códigos. Puedes continuar llenando el producto.');
    this.calls.push(now);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
    try {
      const url = 'https://world.openfoodfacts.org/api/v3/product/' + code + '?fields=code,product_name_es,product_name,categories_tags';
      const response = await this.fetcher(url, { signal: controller.signal, redirect: 'error', headers: {
        Accept: 'application/json', 'User-Agent': 'ParisLicoreria/0.34 (https://github.com/HE-PI-MA/Paris-Licoreria-Sistema)'
      } });
      if (response.status === 404) { await response.body?.cancel(); return this.remember(code, { found: false }); }
      if (!response.ok) { await response.body?.cancel(); throw new Error('Catálogo no disponible'); }
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > 256 * 1024) throw new Error('Respuesta demasiado grande');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      return this.remember(code, ProductLookupService.result(JSON.parse(Buffer.concat(chunks).toString('utf8')), code));
    } catch (_) { throw new ProductError(503, 'No se pudo consultar el catálogo público. Conservamos tus datos; puedes completarlos manualmente o volver a consultar.'); }
    finally { clearTimeout(timer); }
  }
  remember(code, value) {
    if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(code, { value, until: this.now() + 5 * 60000 }); return value;
  }
}
module.exports = ProductLookupService;
