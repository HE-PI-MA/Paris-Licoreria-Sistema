/** U035: navegador real y repositorio simulado; fotos sintéticas, sin Internet ni base de negocio. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture'), { barcode, image } = require('./support/media-fixture');
test('U035: barras giradas y autocompletado sin segundo botón', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 120000 }, async t => {
  const known = new Map(), bars = barcode(); let writes = 0, remoteCalls = 0;
  const options = { categories: [{ value: 1, label: 'BEBIDAS ALCOHÓLICAS' }, { value: 2, label: 'GASEOSAS' }], units: [{ value: 1, label: 'UNIDAD' }] };
  const repo = {
    list: async () => ({ records: [], total: 0 }), options: async kind => ({ options: options[kind], total: options[kind].length }),
    barcode: async code => known.get(code), category: async () => ({ state: 'ACTIVO' }), unit: async () => ({}),
    write: async (_, operation) => { writes++; return operation({}); },
    insertProduct: async (_, data) => { repo.product = { ...data, id: 1, category: 'BEBIDAS ALCOHÓLICAS', categoryState: 'ACTIVO', unit: 'UNIDAD', stock: '0.000', presentations: 1, version: 'a'.repeat(64) }; return { id: 1 }; },
    insertPresentation: async (_, id, data) => { known.set(data.barcode, { product: repo.product, presentation: { ...data, id: 1 } }); return { id: 1 }; }
  };
  const app = await server({ productRepository: repo });
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright'), browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const modal = title => page.getByRole('dialog', { name: title, exact: true });
  const form = () => modal('Nuevo producto'), code = () => form().locator('[name=barcode]');
  const open = async () => { await page.locator('[data-module-primary]').click(); await form().waitFor(); };
  const cancel = async () => { await form().getByRole('button', { name: 'Cancelar', exact: true }).click(); if (await modal('Descartar cambios').isVisible()) await modal('Descartar cambios').getByRole('button', { name: 'Descartar cambios', exact: true }).click(); };
  const waitMessage = text => form().getByText(text, { exact: false }).waitFor();
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name + '.png') }); } };
  const check = async (name, run) => { let failure; await t.test(name, async () => { try { await run(); } catch (e) { failure = e; await shot('u035-fallo'); throw e; } }); if (failure) throw failure; };
  let lookup = async () => ({ found: true, name: 'BEBIDA FICTICIA', category: 'BEBIDAS ALCOHÓLICAS' });
  try {
    await page.route('**/api/productos/sugerencia/**', async route => {
      remoteCalls++; const response = await lookup(decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()));
      await route.fulfill({ status: response.status || 200, json: response.json || response }).catch(() => {});
    });
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio'); await page.goto(app.base + '/productos');
    let rotated;
    await check('lee la imagen en cuatro orientaciones y con el código pequeño fuera del centro', async () => {
      const result = await page.evaluate(async data => {
        const blob = new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/jpeg' });
        const source = await ParisUI.ImageFile.canvas(new File([blob], 'bars.jpg', { type: 'image/jpeg' }), 1920), read = [];
        let sample;
        for (const angle of [0, 90, 180, 270]) {
          const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1600;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, 1000, 1600);
          ctx.translate(320, 900); ctx.rotate(angle * Math.PI / 180); ctx.scale(.75, .75); ctx.drawImage(source, -source.width / 2, -source.height / 2);
          const file = new File([await new Promise(r => canvas.toBlob(r, 'image/jpeg', .85))], 'girado.jpg', { type: 'image/jpeg' });
          read.push(await ParisUI.BarcodeScanner.readPhoto(file));
          if (angle === 90) sample = canvas.toDataURL('image/jpeg', .85).split(',')[1];
        }
        return { read, sample };
      }, bars.bytes.toString('base64'));
      assert.deepEqual(result.read, Array(4).fill(bars.code)); rotated = Buffer.from(result.sample, 'base64');
    });
    await check('foto en móvil HTTP completa código, nombre y categoría sin otra acción', async () => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.evaluate(() => { Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false }); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }); });
      await open(); assert.equal(await form().getByRole('button', { name: 'Buscar nombre y categoría', exact: true }).count(), 0);
      await form().getByRole('button', { name: 'Escanear código', exact: true }).click(); const scanner = modal('Leer código de barras');
      assert.equal(await scanner.getByRole('button', { name: 'Encender cámara', exact: true }).count(), 0);
      await scanner.locator('input[capture=environment]').setInputFiles({ name: 'sin-barras.jpg', mimeType: 'image/jpeg', buffer: image() });
      await scanner.getByText('No se distinguieron las barras.', { exact: false }).waitFor(); assert.equal(remoteCalls, 0);
      await scanner.locator('input[capture=environment]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: rotated });
      await scanner.waitFor({ state: 'detached' }); await waitMessage('Revisa las sugerencias.');
      assert.equal(await code().inputValue(), bars.code); assert.equal(await form().locator('[name=name]').inputValue(), 'BEBIDA FICTICIA'); assert.equal(await form().locator('select[name=categoryId]').inputValue(), '1');
      assert.equal(remoteCalls, 1); assert.equal(writes, 0); assert.equal(await form().locator('[name=price]').inputValue(), '');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('u035-autocompletado-movil');
      await page.setViewportSize({ width: 1440, height: 1080 }); await shot('u035-autocompletado');
    });
    await check('solo Guardar envía el producto y su primera forma de venta', async () => {
      const unit = form().getByRole('combobox', { name: '¿Cómo lo cuentas? *', exact: true }); await unit.fill('UNI'); await page.locator('[role=option]:visible').first().click();
      await form().locator('[name=presentationName]').fill('BOTELLA'); await form().locator('[name=price]').fill('8');
      await form().getByRole('button', { name: 'Guardar', exact: true }).click(); await form().waitFor({ state: 'detached' });
      assert.equal(writes, 1); assert.equal(known.get(bars.code).presentation.price, '8.00'); assert.equal(known.get(bars.code).product.name, 'BEBIDA FICTICIA');
      await page.mouse.move(0, 0); await page.locator('.app-toast[data-kind=success]').waitFor({ state: 'detached' });
    });
    await check('un código registrado carga el producto directamente sin duplicarlo ni consultar afuera', async () => {
      await open(); await code().fill(bars.code); await code().press('Enter'); await modal('Editar producto').waitFor();
      assert.equal(await modal('Editar producto').locator('[name=name]').inputValue(), 'BEBIDA FICTICIA'); assert.equal(await modal('Producto ya registrado').count(), 0); assert.equal(remoteCalls, 1); assert.equal(writes, 1);
      await modal('Editar producto').getByRole('button', { name: 'Cancelar', exact: true }).click();
      await open(); await form().locator('[name=name]').fill('BORRADOR PROPIO'); await code().fill(bars.code); await code().press('Enter');
      await modal('Producto ya registrado').getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await form().locator('[name=name]').inputValue(), 'BORRADOR PROPIO'); await cancel();
    });
    await check('código desconocido o interno se conserva; nunca se inventan nombre ni precio', async () => {
      lookup = async () => ({ found: false }); await open(); await code().fill('0036000291452'); await code().press('Tab'); await waitMessage('No hay datos para este código');
      assert.equal(await form().locator('[name=name]').inputValue(), ''); assert.equal(await code().inputValue(), '0036000291452'); assert.equal(await form().locator('[name=price]').inputValue(), '');
      const calls = remoteCalls; await code().fill('INTERNO-1'); await code().press('Enter'); await waitMessage('Código interno nuevo.'); assert.equal(remoteCalls, calls); await cancel();
    });
    await check('el lector en vivo lee barras giradas y detiene la cámara al leer o cerrar antes del permiso', async () => {
      await page.evaluate(pattern => {
        const make = () => {
          const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 600;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 600); ctx.translate(350, 60); ctx.rotate(Math.PI / 2); ctx.fillStyle = '#000';
          [...pattern].forEach((b, i) => { if (b === '1') ctx.fillRect((i + 12) * 4, 15, 4, 150); });
          const stream = canvas.captureStream(5); window.testStreams.push(stream); return stream;
        };
        window.testStreams = []; window.testPermissionPending = false;
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => window.testPermissionPending ? new Promise(resolve => { window.allowTestCamera = () => resolve(make()); }) : Promise.resolve(make()) } });
      }, bars.bars);
      await open(); await form().locator('[name=name]').fill('BORRADOR CÁMARA');
      await form().getByRole('button', { name: 'Escanear código', exact: true }).click(); await modal('Leer código de barras').getByRole('button', { name: 'Encender cámara', exact: true }).click();
      await modal('Leer código de barras').waitFor({ state: 'detached' }); await modal('Producto ya registrado').getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await code().inputValue(), bars.code); assert.ok(await page.evaluate(() => window.testStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))));
      await page.evaluate(() => { window.testPermissionPending = true; });
      await form().getByRole('button', { name: 'Escanear código', exact: true }).click(); await modal('Leer código de barras').getByRole('button', { name: 'Encender cámara', exact: true }).click();
      await page.waitForFunction(() => Boolean(window.allowTestCamera)); await modal('Leer código de barras').getByRole('button', { name: 'Cerrar', exact: true }).click(); await page.evaluate(() => window.allowTestCamera());
      await page.waitForFunction(() => window.testStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))); assert.equal(await form().locator('[name=name]').inputValue(), 'BORRADOR CÁMARA'); await cancel();
    });
    await check('una respuesta tardía no pisa el nombre escrito y cambiar de código elimina solo sugerencias anteriores', async () => {
      let release, requested; const gate = new Promise(r => { release = r; }), seen = new Promise(r => { requested = r; });
      lookup = async () => { requested(); await gate; return { found: true, name: 'NOMBRE AUTOMÁTICO', category: 'GASEOSAS' }; };
      await open(); await code().fill('0036000291452'); await code().press('Enter'); await seen;
      await form().locator('[name=name]').fill('NOMBRE ESCRITO'); release(); await waitMessage('Revisa las sugerencias.');
      assert.equal(await form().locator('[name=name]').inputValue(), 'NOMBRE ESCRITO'); assert.equal(await form().locator('select[name=categoryId]').inputValue(), '2');
      lookup = async () => ({ found: false }); await code().fill('012345678905'); await code().press('Enter'); await waitMessage('No hay datos para este código');
      assert.equal(await form().locator('[name=name]').inputValue(), 'NOMBRE ESCRITO'); assert.equal(await form().locator('select[name=categoryId]').inputValue(), ''); await cancel();
    });
    await check('cambiar de código con consulta pendiente ignora el resultado anterior', async () => {
      let release, requested; const gate = new Promise(r => { release = r; }), seen = new Promise(r => { requested = r; });
      lookup = async value => { if (value === '0036000291452') { requested(); await gate; return { found: true, name: 'ANTERIOR', category: 'GASEOSAS' }; } return { found: true, name: 'ACTUAL', category: 'BEBIDAS ALCOHÓLICAS' }; };
      await open(); await code().fill('0036000291452'); await code().press('Enter'); await seen;
      await code().fill('012345678905'); await code().press('Enter'); await waitMessage('Revisa las sugerencias.'); release();
      assert.equal(await form().locator('[name=name]').inputValue(), 'ACTUAL'); assert.equal(await form().locator('select[name=categoryId]').inputValue(), '1');
      await code().fill('INTERNO-2'); assert.equal(await form().locator('[name=name]').inputValue(), ''); assert.equal(await form().locator('select[name=categoryId]').inputValue(), ''); await cancel();
    });
    await check('catálogo caído usa notificación global temporal, preserva los datos y permite reintentar', async () => {
      lookup = async () => ({ status: 503, json: { error: 'Catálogo no disponible.' } }); await open(); await form().locator('[name=name]').fill('MI PRODUCTO'); await code().fill('0036000291452'); await code().press('Enter');
      await form().locator('.app-toast[data-kind=error]').waitFor(); assert.equal(await form().locator('.app-modal-body .app-alert:visible').count(), 0);
      await page.mouse.move(0, 0); await form().locator('.app-toast[data-kind=error]').waitFor({ state: 'detached' }); assert.equal(await form().locator('[name=name]').inputValue(), 'MI PRODUCTO');
      lookup = async () => ({ found: false }); await code().press('Enter'); await waitMessage('No hay datos para este código'); await cancel();
      assert.deepEqual(errors, []); assert.equal(writes, 1);
    });
  } finally { await browser.close(); await app.close(); }
});
