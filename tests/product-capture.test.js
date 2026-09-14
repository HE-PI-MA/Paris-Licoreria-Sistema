/** U034: contratos y límites de las sugerencias. No consulta servicios públicos ni usa datos del negocio. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const Lookup = require('../src/services/ProductLookupService'), { ProductInput: Input } = require('../src/domain/ProductInput');
const { server, password, user } = require('./support/application-fixture');
const base = { name: 'PRUEBA', categoryId: 1, unitId: 1, description: '', minimum: '0', state: 'ACTIVO' };
const first = { name: 'PAQUETE DE 6', factor: '6', price: '20.50', barcode: '0012345678905' };
test('U034: primera forma de venta exacta; contrato anterior y edición protegida', () => {
  assert.equal(Input.product(base).initialPresentation, undefined);
  const p = Input.product({ ...base, initialPresentation: first });
  assert.equal(p.initialPresentation.barcode, first.barcode); assert.equal(p.initialPresentation.factor, '6.000');
  for (const change of [{ factor: '0' }, { price: '1.234' }, { name: '' }, { stock: '5' }, { state: 'ACTIVO' }]) assert.throws(() => Input.product({ ...base, initialPresentation: { ...first, ...change } }));
  assert.throws(() => Input.product({ ...base, initialPresentation: first }, true));
});
test('U034: catálogo con destino fijo, campos mínimos, caché, categorías conocidas y código coincidente', async () => {
  let calls = 0;
  const lookup = new Lookup({ fetcher: async (url, options) => {
    calls++; assert.equal(new URL(url).hostname, 'world.openfoodfacts.org'); assert.equal(options.redirect, 'error');
    assert.equal(options.body, undefined); assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers.Authorization, undefined);
    assert.match(options.headers['User-Agent'], /ParisLicoreria/);
    return new Response(JSON.stringify({ code: first.barcode, product: { code: first.barcode, product_name_es: 'BEBIDA FICTICIA', categories_tags: ['en:beers'], image_url: 'http://localhost/private' } }));
  } });
  const a = await lookup.find(first.barcode); assert.equal(a.name, 'BEBIDA FICTICIA'); assert.equal(a.category, 'BEBIDAS ALCOHÓLICAS');
  assert.equal(a.image_url, undefined); assert.deepEqual(await lookup.find(first.barcode), a); assert.equal(calls, 1);
  for (const code of ['CODE-1', '0012345678906', '../secret', '1'.repeat(50)]) await assert.rejects(lookup.find(code), e => e.status === 422);
  assert.equal(calls, 1);
  assert.deepEqual(Lookup.result({ product: { code: first.barcode, product_name: 'OTRO', categories_tags: ['en:unknown'] } }, first.barcode).category, '');
  assert.throws(() => Lookup.result({ product: { code: 'OTRO', product_name: 'MAL' } }, first.barcode));
});
test('U034: ausencia, respuestas enormes/incorrectas y caída de red no inventan datos', async () => {
  assert.deepEqual(await new Lookup({ fetcher: async () => new Response('{}', { status: 404 }) }).find(first.barcode), { found: false });
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => new Response('x'.repeat(262145)), async () => new Response('<html>error</html>'), async () => new Response('{}', { status: 429 }), async () => new Response('{"product":{"code":"different"}}')]) {
    await assert.rejects(new Lookup({ fetcher }).find(first.barcode), e => e.status === 503 && !e.message.includes('offline'));
  }
  const limited = new Lookup(); limited.calls = Array(12).fill(Date.now());
  await assert.rejects(limited.find(first.barcode), e => e.status === 429);
});
test('U034: consulta pública exige sesión, rol y licencia igual que Productos', async () => {
  const app = await server({ productRepository: {} });
  try {
    assert.equal((await app.request('/api/productos/sugerencia/NO-ES-EAN')).status, 401);
    const form = await app.form(), login = await app.post('/api/auth/login', { nombre_usuario: 'audit_user', contrasena: password }, form);
    assert.equal((await app.request('/api/productos/sugerencia/NO-ES-EAN', { headers: { Cookie: login.cookie } })).status, 422);
    app.setUser({ ...user, id_rol: 2, rol: 'ENCARGADO_VENTA' });
    assert.equal((await app.request('/api/productos/sugerencia/NO-ES-EAN', { headers: { Cookie: login.cookie } })).status, 403);
    app.setUser({ ...user }); app.setData(null);
    assert.equal((await app.request('/api/productos/sugerencia/NO-ES-EAN', { headers: { Cookie: login.cookie } })).status, 403);
  } finally { await app.close(); }
});
