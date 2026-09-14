/** Navegador real y MySQL temporal: fotos, teclado, decodificación real de barras y ciclo de cámara simulado. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const { database } = require('./support/inventory-mysql-fixture'), { server, password } = require('./support/application-fixture');
const { body } = require('./support/purchase-fixture'), { image, barcode } = require('./support/media-fixture');
test('U031: fotos y lectores en Chromium con MySQL', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' || !process.env.TEST_DB_USER, timeout: 120000 }, async t => {
  const db = await database(), repo = new (require('../src/repositories/PurchaseRepository'))(db.pool), service = new (require('../src/services/PurchaseService'))(repo);
  const data = body(), code = barcode(); data.lines[0].presentation.barcode = code.code; data.lines[0].product.photo = 'data:image/jpeg;base64,' + image().toString('base64'); await service.create(1, crypto.randomUUID(), data);
  const app = await server({ purchaseRepository: repo, productRepository: repo.products, supplierRepository: repo.suppliers });
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright'), browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const modal = title => page.getByRole('dialog', { name: title, exact: true });
  const choose = async (title, label, term) => { const input = modal(title).getByRole('combobox', { name: label, exact: true }); await input.fill(term); await page.locator('[role=option]:visible').first().click(); };
  const menu = async label => { await page.locator('#products-table tr[data-row-index]').first().getByRole('button', { name: /Acciones del registro/ }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); };
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name + '.png') }); } };
  const check = async (name, fn) => { let failed; await t.test(name, async () => { try { await fn(); } catch (e) { failed = e; await shot('u031-fallo'); throw e; } }); if (failed) throw failed; };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await check('la foto se consulta con sesión; cancelar no cambia nada; editar guarda la imagen', async () => {
      await page.goto(app.base + '/productos'); await page.locator('.app-product-photo img').waitFor(); await page.waitForFunction(() => document.querySelector('.app-product-photo img')?.naturalWidth > 0);
      const before = (await repo.products.detail(1)).photoHash;
      await menu('Editar'); await modal('Editar producto').locator('input[type=file]').first().setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: image(60) });
      await page.waitForFunction(() => document.querySelector('[name=photoState]').value.startsWith('data:image/jpeg'));
      await modal('Editar producto').getByRole('button', { name: 'Cancelar', exact: true }).click(); await modal('Descartar cambios').getByRole('button', { name: 'Descartar cambios', exact: true }).click(); assert.equal((await repo.products.detail(1)).photoHash, before);
      await menu('Editar'); await modal('Editar producto').locator('input[type=file]').first().setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: image(60) }); await page.waitForFunction(() => document.querySelector('[name=photoState]').value.startsWith('data:image/jpeg'));
      await modal('Editar producto').getByRole('button', { name: 'Guardar', exact: true }).click(); await modal('Editar producto').waitFor({ state: 'detached' }); assert.notEqual((await repo.products.detail(1)).photoHash, before);
      await shot('u031-productos-foto');
    });
    await check('el lector de teclado selecciona el paquete exacto y Enter no guarda la compra', async () => {
      await page.goto(app.base + '/compras'); await page.locator('[data-module-primary]').click(); const form = modal('Nueva compra');
      await form.locator('[name=barcode]').fill(code.code); await form.locator('[name=barcode]').press('Enter'); await page.waitForFunction(() => document.querySelector('[name=factor]').value === '6.000');
      assert.equal(await form.getByRole('combobox', { name: 'Producto', exact: true }).inputValue(), 'CERVEZA FICTICIA'); assert.equal(await form.locator('[name=price]').inputValue(), '60.00'); assert.equal(await form.locator('[name=barcode]').inputValue(), code.code);
      assert.equal((await service.list({})).total, 1); assert.equal(await form.locator('.app-photo-controls .app-section-toolbar').isHidden(), true);
      await page.setViewportSize({ width: 360, height: 800 }); assert.equal(await form.locator('.app-photo-controls .app-section-toolbar').isHidden(), true, 'el grid móvil también conserva oculta la edición de fotos existentes en Compras');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await form.getByRole('button', { name: 'Limpiar producto', exact: true }).click(); await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
    });
    await check('foto de producto nuevo se conserva en dos filas y se guarda una vez al confirmar', async () => {
      const title = 'Nueva compra'; await page.locator('[data-module-primary]').click(); const form = modal(title);
      await choose(title, 'Nombre o empresa', 'DISTR'); await choose(title, 'Ubicación *', 'ALM');
      await form.getByRole('combobox', { name: 'Producto', exact: true }).fill('PRODUCTO CON FOTO'); await choose(title, 'Categoría *', 'BEB'); await choose(title, '¿Cómo lo cuentas? *', 'UNI');
      await form.getByRole('combobox', { name: '¿Cómo lo compras?', exact: true }).fill('CAJA DE 3'); await form.locator('[name=factor]').fill('3'); await form.locator('[name=price]').fill('20'); await form.locator('[name=cost]').fill('12');
      await form.locator('input[type=file]').first().setInputFiles({ name: 'producto.jpg', mimeType: 'image/jpeg', buffer: image(210) }); await page.waitForFunction(() => document.querySelector('[name=photoState]').value.startsWith('data:image/jpeg'));
      await shot('u031-compra-foto'); await form.getByRole('button', { name: 'Agregar producto', exact: true }).click();
      await choose(title, 'Producto', 'PRODUCTO CON'); await page.waitForFunction(() => document.querySelector('[name=photoState]').value.startsWith('data:image/jpeg')); assert.equal(await form.locator('.app-photo-controls .app-section-toolbar').isHidden(), true);
      await form.getByRole('combobox', { name: '¿Cómo lo compras?', exact: true }).fill('UNIDAD'); await form.locator('[name=price]').fill('8'); await form.locator('[name=cost]').fill('4'); await form.getByRole('button', { name: 'Agregar producto', exact: true }).click();
      assert.equal((await repo.products.list({ term: 'PRODUCTO CON', sort: 'name', page: 1, pageSize: 50 })).total, 0);
      await form.getByRole('button', { name: 'Guardar compra', exact: true }).click(); await form.waitFor({ state: 'detached' });
      const [[count]] = await db.owner.query('SELECT COUNT(*) AS n FROM producto_imagen'); assert.equal(count.n, 2);
      const saved = (await repo.products.list({ term: 'PRODUCTO CON', sort: 'name', page: 1, pageSize: 50 })).records[0]; assert.equal(saved.stock, '4.000');
    });
    await check('decodifica una foto EAN-13 con la biblioteca local, sin BarcodeDetector nativo', async () => {
      await page.goto(app.base + '/productos'); await page.locator('[data-module-primary]').click(); await modal('Nuevo producto').getByRole('button', { name: 'Escanear código', exact: true }).click();
      await modal('Leer código de barras').locator('input[type=file][capture]').setInputFiles({ name: 'barras.jpg', mimeType: 'image/jpeg', buffer: code.bytes });
      await modal('Leer código de barras').waitFor({ state: 'detached' }); assert.equal(await modal('Nuevo producto').locator('[name=barcode]').inputValue(), code.code); await modal('Producto ya registrado').getByRole('button', { name: 'Cancelar', exact: true }).click();
    });
    await check('cámara: una lectura detiene las pistas; cerrar antes del permiso descarta el resultado tardío', async () => {
      await page.evaluate(bars => {
        const make = () => { const canvas = document.createElement('canvas'); canvas.width = (bars.length + 24) * 4; canvas.height = 180; const c = canvas.getContext('2d'); c.fillStyle = 'white'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = 'black'; [...bars].forEach((b, i) => { if (b === '1') c.fillRect((i + 12) * 4, 15, 4, 150); }); const stream = canvas.captureStream(5); window.testCameraStreams.push(stream); return stream; };
        window.testCameraStreams = []; window.testCameraMode = 'live'; Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => window.testCameraMode === 'pending' ? new Promise(resolve => { window.resolveTestCamera = () => resolve(make()); }) : Promise.resolve(make()) });
      }, code.bars);
      await modal('Nuevo producto').getByRole('button', { name: 'Escanear código', exact: true }).click(); await modal('Leer código de barras').getByRole('button', { name: 'Encender cámara', exact: true }).click(); await modal('Leer código de barras').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => window.testCameraStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true); await modal('Producto ya registrado').getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.evaluate(() => { window.testCameraMode = 'pending'; }); await modal('Nuevo producto').getByRole('button', { name: 'Escanear código', exact: true }).click(); await modal('Leer código de barras').getByRole('button', { name: 'Encender cámara', exact: true }).click(); await page.waitForFunction(() => Boolean(window.resolveTestCamera));
      await modal('Leer código de barras').getByRole('button', { name: 'Cerrar', exact: true }).click(); await page.evaluate(() => window.resolveTestCamera()); await page.waitForFunction(() => window.testCameraStreams.every(s => s.getTracks().every(t => t.readyState === 'ended')));
    });
    await check('componentes compartidos en móvil, avisos temporales y formulario sin desbordarse', async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(app.base + '/productos'); await page.locator('[data-module-primary]').click();
      const form = modal('Nuevo producto'); await form.locator('input[type=file]').first().setInputFiles({ name: 'incorrecto.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
      await form.locator('.app-toast[data-kind=error]').waitFor(); assert.equal(await form.locator('.app-modal-body .app-alert:visible').count(), 0); await page.mouse.move(0, 0); await form.locator('.app-toast').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); assert.equal(await form.locator('.app-modal-body').evaluate(n => n.scrollWidth <= n.clientWidth), true); await shot('u031-producto-movil');
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.deepEqual(errors, []);
    });
  } finally { await page.close(); await browser.close(); await app.close(); await db.close(); }
});
