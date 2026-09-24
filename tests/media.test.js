/** Validación de archivos, contrato compatible y límites HTTP sin acceder a una base de negocio. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const jpeg = require('../src/vendor/jpeg-js'), Photo = require('../src/domain/ProductPhoto');
const { ProductInput } = require('../src/domain/ProductInput'), PurchaseInput = require('../src/domain/PurchaseInput');
const { body } = require('./support/purchase-fixture'), { scenario, password, user } = require('./support/application-fixture');
function photo(width = 32, height = 24) { return 'data:image/jpeg;base64,' + jpeg.encode({ width, height, data: Buffer.alloc(width * height * 4, 220), comments: ['PRIVATE EXIF PLACEHOLDER'] }, 85).data.toString('base64'); }
const product = () => ({ name: 'PRUEBA', categoryId: '1', unitId: '1', description: '', minimum: '0', state: 'ACTIVO' });
test('U031: JPEG real, límites y eliminación de metadatos; sin foto mantiene el contrato anterior', () => {
  const input = photo(), clean = Photo.optional({ photo: input }).photo;
  const decoded = jpeg.decode(Buffer.from(clean.slice(23), 'base64'));
  assert.equal(decoded.width, 32); assert.equal(decoded.height, 24); assert.deepEqual(decoded.comments || [], []);
  assert.deepEqual(Photo.optional({}), {}); assert.deepEqual(Photo.optional({ photo: null }), { photo: null });
  assert.equal(Object.hasOwn(ProductInput.product(product()), 'photo'), false);
  assert.equal(ProductInput.product({ ...product(), photo: input }).photo, clean);
  for (const value of ['', '<svg onload=alert(1)>', 'data:image/png;base64,AAAA', 'data:image/jpeg;base64,AAAA', input + '!', 'data:image/jpeg;base64,' + 'A'.repeat(350000), photo(769, 10), 42, {}]) assert.throws(() => Photo.optional({ photo: value }), error => error.status === 422);
});
test('U044/U049: Compras no recibe fotos ni datos completos del formulario de Producto', () => {
  const data = body(); data.lines[0].photo = photo();
  assert.throws(() => PurchaseInput.purchase(data), error => error.status === 400);
  const nested = body(); nested.lines[0].product.photo = photo();
  assert.throws(() => PurchaseInput.purchase(nested), error => error.status === 400);
});
test('U031: foto y búsqueda exacta exigen sesión/rol; CSRF antes de archivos grandes y límites acotados', async () => {
  const bytes = Buffer.from(Photo.optional({ photo: photo() }).photo.slice(23), 'base64');
  const row = { id: 7, state: 'ACTIVO', categoryState: 'ACTIVO', name: 'BOTELLA' };
  let lookedUp;
  await scenario(async s => {
    assert.equal((await s.request('/api/productos/7/imagen')).status, 401);
    assert.equal((await s.request('/api/productos/codigo/001234')).status, 401);
    let f = await s.form(); const logged = await s.post('/api/auth/login', { nombre_usuario: 'audit_user', contrasena: password }, f); f = await s.form('/productos', logged.cookie);
    const image = await fetch(s.base + '/api/productos/7/imagen', { headers: { Cookie: f.cookie } });
    assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/jpeg'); assert.equal(image.headers.get('cache-control'), 'no-store'); assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
    const found = await s.request('/api/productos/codigo/001234', { headers: { Cookie: f.cookie } }); assert.equal(JSON.parse(found.text).found, true); assert.equal(lookedUp, '001234');
    assert.equal((await s.request('/api/productos/codigo/no-existe', { headers: { Cookie: f.cookie } })).status, 200);
    assert.equal((await s.post('/api/productos', { photo: 'a'.repeat(420000) }, { cookie: f.cookie })).status, 403);
    assert.equal((await s.post('/api/productos', { photo: 'a'.repeat(420000) }, f)).status, 413);
    assert.equal((await s.post('/api/compras', { photo: 'a'.repeat(4300000) }, f)).status, 413);
    s.setUser({ ...user, rol: 'CAJERO' }); assert.equal((await s.request('/api/productos/7/imagen', { headers: { Cookie: f.cookie } })).status, 403);
  }, { productRepository: { photos: { read: async () => ({ bytes }) }, barcode: async code => { lookedUp = code; return code === '001234' ? { product: row, presentation: { id: 12, state: 'ACTIVO', factor: '6.000' } } : null; } } });
});
test('U031: claves de envío seguras y únicas si el navegador no expone randomUUID', () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path'), webcrypto = require('node:crypto').webcrypto;
  const context = vm.createContext({ window: { ParisUI: {} }, crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/components/catalog-api.js'), 'utf8'), context);
  const keys = Array.from({ length: 100 }, () => context.window.ParisUI.CatalogApi.newKey()); assert.equal(new Set(keys).size, 100);
  keys.forEach(key => assert.match(key, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
});
