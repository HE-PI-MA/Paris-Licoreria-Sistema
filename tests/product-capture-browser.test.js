/** U034: cámara/foto primero y guardado real en MySQL temporal. El catálogo público se simula. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { database } = require('./support/inventory-mysql-fixture'), { server, password } = require('./support/application-fixture'), { image, barcode } = require('./support/media-fixture');
test('U034: captura al inicio, sugerencias revisables y creación completa', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' || !process.env.TEST_DB_USER, timeout: 120000 }, async t => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), app = await server({ productRepository: repo });
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright'), browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } }); page.setDefaultTimeout(7000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const modal = title => page.getByRole('dialog', { name: title, exact: true }), bars = barcode(); let calls = 0;
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name + '.png') }); } };
  const cancel = async () => { await modal('Nuevo producto').getByRole('button', { name: 'Cancelar', exact: true }).click(); if (await modal('Descartar cambios').isVisible()) await modal('Descartar cambios').getByRole('button', { name: 'Descartar cambios', exact: true }).click(); };
  const check = async (name, fn) => { let failure; await t.test(name, async () => { try { await fn(); } catch (e) { failure = e; await shot('u034-fallo'); throw e; } }); if (failure) throw failure; };
  try {
    await page.route('**/api/productos/sugerencia/**', async route => { calls++; await route.fulfill({ json: { found: true, name: 'BEBIDA FICTICIA', category: 'BEBIDAS ALCOHÓLICAS' } }); });
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio'); await page.goto(app.base + '/productos');
    await check('escáner primero; foto de barras real y consulta pública solo al pulsar su botón', async () => {
      assert.equal(await page.locator('[data-module-region=controls] .app-input-action').count(), 0);
      await page.locator('[data-module-primary]').click(); const form = modal('Nuevo producto');
      assert.equal(await form.getByRole('button', { name: 'Escanear código', exact: true }).evaluate(el => el === document.activeElement), true);
      const photoBox = await form.locator('.app-photo-field').boundingBox(), nameBox = await form.locator('[name=name]').boundingBox(); assert.ok(photoBox.y < nameBox.y);
      await form.getByRole('button', { name: 'Escanear código', exact: true }).click();
      await modal('Leer código de barras').locator('input[type=file]:not([capture])').setInputFiles({ name: 'barras.jpg', mimeType: 'image/jpeg', buffer: bars.bytes });
      await modal('Leer código de barras').waitFor({ state: 'detached' }); await form.getByText('Código nuevo.', { exact: false }).waitFor();
      assert.equal(await form.locator('[name=barcode]').inputValue(), bars.code); assert.equal(calls, 0); assert.equal(await form.locator('[name=name]').inputValue(), '');
      await form.getByRole('button', { name: 'Buscar nombre y categoría', exact: true }).click();
      await form.getByText('Revisa las sugerencias.', { exact: false }).waitFor(); assert.equal(calls, 1);
      assert.equal(await form.locator('[name=name]').inputValue(), 'BEBIDA FICTICIA'); assert.equal(await form.locator('select[name=categoryId]').inputValue(), '1');
      await shot('u034-nuevo-producto');
    });
    await check('foto, nombre, categoría, código y primera venta se guardan juntos; stock queda en cero', async () => {
      const form = modal('Nuevo producto');
      await form.locator('.app-photo-field input[type=file]:not([capture])').setInputFiles({ name: 'producto.jpg', mimeType: 'image/jpeg', buffer: image(70) });
      await page.waitForFunction(() => document.querySelector('[name=photoState]')?.value.startsWith('data:image/jpeg'));
      await form.getByRole('combobox', { name: '¿Cómo lo cuentas? *', exact: true }).fill('UNI'); await page.locator('[role=option]:visible').first().click();
      await form.locator('[name=presentationName]').fill('PAQUETE DE 6'); await form.locator('[name=factor]').fill('6'); await form.locator('[name=price]').fill('25');
      await form.getByRole('button', { name: 'Guardar', exact: true }).click(); await form.waitFor({ state: 'detached' }); await page.mouse.move(0, 0); await page.locator('.app-toast[data-kind=success]').waitFor({ state: 'detached' });
      const found = await repo.barcode(bars.code); assert.equal(found.product.name, 'BEBIDA FICTICIA'); assert.equal(found.product.categoryId, 1); assert.equal(found.product.stock, '0.000'); assert.ok(found.product.photoHash); assert.equal(found.presentation.factor, '6.000'); assert.equal(found.presentation.price, '25.00');
    });
    await check('un código existente abre el producto registrado, sin duplicarlo', async () => {
      await page.locator('[data-module-primary]').click(); const form = modal('Nuevo producto'); await form.locator('[name=barcode]').fill(bars.code); await form.locator('[name=barcode]').press('Enter');
      await modal('Producto ya registrado').getByRole('button', { name: 'Abrir producto', exact: true }).click(); await modal('Editar producto').waitFor(); assert.equal(await modal('Editar producto').locator('[name=name]').inputValue(), 'BEBIDA FICTICIA');
      assert.equal((await repo.list({ sort: 'name', page: 1, pageSize: 50 })).total, 1); await modal('Editar producto').getByRole('button', { name: 'Cancelar', exact: true }).click();
    });
    await check('móvil HTTP: cámara mediante foto; controles globales, sin desborde y sin falso botón en vivo', async () => {
      await page.setViewportSize({ width: 360, height: 800 }); await page.locator('[data-module-primary]').click(); const form = modal('Nuevo producto');
      await page.evaluate(() => { Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false }); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }); });
      await shot('u034-producto-movil');
      await form.getByRole('button', { name: 'Escanear código', exact: true }).click(); const scanner = modal('Leer código de barras');
      assert.equal(await scanner.getByRole('button', { name: 'Encender cámara', exact: true }).count(), 0);
      assert.equal(await scanner.locator('input[capture=environment]').count(), 1); assert.equal(await scanner.getByRole('button', { name: 'Tomar foto del código', exact: true }).isVisible(), true);
      assert.equal(await scanner.locator('.app-modal-body').evaluate(el => el.scrollWidth <= el.clientWidth), true); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await shot('u034-lector-movil-http');
      await scanner.locator('input[capture=environment]').setInputFiles({ name: 'foto-celular.jpg', mimeType: 'image/jpeg', buffer: bars.bytes });
      await scanner.waitFor({ state: 'detached' }); assert.equal(await form.locator('[name=barcode]').inputValue(), bars.code);
      await modal('Producto ya registrado').getByRole('button', { name: 'Cancelar', exact: true }).click(); await cancel();
    });
    await check('una respuesta tardía no pisa cambios ni borra el borrador; error usa aviso global temporal', async () => {
      await page.locator('[data-module-primary]').click(); const form = modal('Nuevo producto'); const code = form.locator('[name=barcode]');
      await code.fill('0036000291452'); let release; const gate = new Promise(r => { release = r; });
      await page.route('**/api/productos/sugerencia/0036000291452', async route => { await gate; await route.fulfill({ json: { found: true, name: 'NOMBRE TARDÍO', category: 'GASEOSAS' } }).catch(() => {}); });
      const requested = page.waitForRequest('**/api/productos/sugerencia/0036000291452'); await form.getByRole('button', { name: 'Buscar nombre y categoría', exact: true }).click(); await requested;
      await form.locator('[name=name]').fill('NOMBRE ESCRITO'); await code.fill('MANUAL-01'); release();
      await page.waitForFunction(() => !document.querySelector('[name=barcode]')?.disabled); assert.equal(await form.locator('[name=name]').inputValue(), 'NOMBRE ESCRITO');
      await page.unroute('**/api/productos/sugerencia/**');
      await page.route('**/api/productos/sugerencia/**', route => route.fulfill({ status: 503, json: { error: 'Catálogo no disponible. Completa los datos.' } }));
      await code.fill('0012345678906'); await form.getByRole('button', { name: 'Buscar nombre y categoría', exact: true }).click();
      await form.locator('.app-toast[data-kind=error]').waitFor(); assert.equal(await form.locator('.app-modal-body .app-alert:visible').count(), 0); await page.mouse.move(0, 0); await form.locator('.app-toast[data-kind=error]').waitFor({ state: 'detached' });
      assert.equal(await form.locator('[name=name]').inputValue(), 'NOMBRE ESCRITO'); await cancel(); assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); await db.close(); }
});
