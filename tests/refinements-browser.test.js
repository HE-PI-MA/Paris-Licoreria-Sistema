/** U018: interacciones compartidas sobre registros ficticios; ninguna escritura llega a MySQL. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');

test('U018: encabezados, avisos y sugerencias sin desplazar el formulario', {
  skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000
}, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined,
    args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6500);
  const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
  const rows = [
    { id: 101, name: 'Cerveza de demostración', stock: '30.000', state: 'ACTIVO' },
    { id: 203, name: 'Maní de ejemplo', stock: '2203.592', state: 'ACTIVO' },
    { id: 390, name: 'Producto de prueba', stock: '5.000', state: 'INACTIVO' }
  ].map(row => ({ categoryId: 1, category: 'Bebidas', unitId: 1, unit: 'Unidad', physicalStock: '34.000', minimum: '10.000',
    presentations: 2, description: 'Datos ficticios para revisar el diseño.', version: 'a'.repeat(64), ...row }));
  const categories = ['Bebidas', 'Dulces', 'Galletas', 'Gaseosas', 'Limpieza', 'Otros'].map((label, i) => ({ value: String(i + 1), label }));
  await page.route('**/api/productos**', async route => {
    const url = new URL(route.request().url()), sub = url.pathname.replace('/api/productos', '');
    requests.push({ sub, method: route.request().method(), term: url.searchParams.get('term') });
    let result;
    if (sub.startsWith('/opciones/')) {
      const options = sub.endsWith('/units') ? [{ value: '1', label: 'Unidad' }, { value: '2', label: 'Gramo' }, { value: '3', label: 'Kilogramo' }] : categories;
      const filtered = options.filter(o => o.label.toLowerCase().includes((url.searchParams.get('term') || '').toLowerCase()));
      result = { options: filtered, total: filtered.length };
    } else if (/^\/\d+$/.test(sub)) result = rows.find(row => row.id === Number(sub.slice(1)));
    else result = { records: url.searchParams.get('categoryId') === '2' ? [] : rows, total: url.searchParams.get('categoryId') === '2' ? 0 : rows.length };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  const shot = async name => {
    if (!process.env.PARIS_UI_SCREENSHOTS) return;
    fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'u018-' + name + '.png') });
  };
  const action = async label => {
    await page.getByRole('button', { name: 'Acciones del registro 101', exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user');
    await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await page.goto(app.base + '/productos'); await page.locator('#products-table tr[data-row-index="0"]').waitFor(); await page.evaluate(() => document.fonts.ready);
    await t.test('encabezados y estado no originan consultas ni escrituras por clic', async () => {
      const before = requests.length;
      for (const key of ['name', 'stock', 'state']) await page.locator('th[data-column-key=' + key + ']').click();
      await page.locator('#products-table .app-badge').first().click();
      assert.equal(await page.locator('#products-table th button').count(), 0);
      assert.equal(requests.length, before);
      assert.equal(await page.locator('#products-table tr[data-row-index="0"] [data-column-key=name]').evaluate(n => n.firstChild.textContent), rows[0].name);
      assert.ok(requests.every(r => r.method === 'GET')); await shot('productos');
    });
    await t.test('menú con tonos semánticos y teclado; detalle dentro de un solo contenedor', async () => {
      await page.getByRole('button', { name: 'Acciones del registro 101', exact: true }).click();
      const colors = await page.getByRole('menu').locator('button').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
      assert.equal(new Set(colors).size, 5); await shot('acciones');
      await page.keyboard.press('Escape'); await action('Ver detalle');
      const dialog = page.getByRole('dialog', { name: 'Detalle del producto', exact: true }); await dialog.waitFor();
      assert.equal(await dialog.locator('.app-record-details').count(), 1);
      assert.ok(await dialog.locator('.app-record-detail').evaluateAll(nodes => nodes.every(n => getComputedStyle(n).borderTopWidth === '0px' && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)')));
      await shot('detalle'); await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    });
    await t.test('aviso verde completo, sin botón, se retira a los dos segundos; errores permanecen', async () => {
      await page.mouse.move(0, 0); await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.evaluate(() => { window.testNotices = new ParisUI.NotificationCenter(); testNotices.show('success', 'Producto guardado correctamente.'); });
      const success = page.locator('.app-toast[data-kind=success]');
      assert.equal(await success.getByRole('button').count(), 0);
      assert.equal(await success.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(34, 115, 77)');
      await shot('aviso'); await page.clock.fastForward(1900); assert.equal(await success.count(), 1);
      await page.clock.fastForward(150); assert.equal(await success.count(), 0);
      await page.evaluate(() => testNotices.show('error', 'Error de demostración', { duration: 1 }));
      await page.clock.fastForward(5000); assert.equal(await page.locator('.app-toast[data-kind=error]').count(), 1);
      await page.evaluate(() => testNotices.destroy()); await page.clock.resume();
    });
    await t.test('campos sin tarjeta extra ni historial; vacío no abre sugerencias', async () => {
      await page.locator('[data-module-primary]').click(); const dialog = page.getByRole('dialog', { name: 'Nuevo producto', exact: true });
      assert.equal(await dialog.locator('form').getAttribute('autocomplete'), 'off');
      assert.equal(await dialog.locator('[name=name]').getAttribute('autocomplete'), 'off');
      assert.equal(await dialog.locator('form').evaluate(n => getComputedStyle(n).borderTopWidth), '0px');
      assert.equal(await dialog.getByText('Unidad usada para medir stock y la equivalencia de las presentaciones.').count(), 0);
      const category = dialog.getByRole('combobox', { name: 'Categoría *', exact: true });
      const before = requests.length; await category.click(); await category.press('ArrowDown');
      assert.equal(await category.getAttribute('aria-expanded'), 'false'); assert.equal(requests.length, before);
      await shot('formulario');
    });
    await t.test('sugerencias flotan sin mover campos ni pie y desaparecen al borrar; conservan selección', async () => {
      const dialog = page.getByRole('dialog', { name: 'Nuevo producto', exact: true });
      const category = dialog.getByRole('combobox', { name: 'Categoría *', exact: true });
      const measure = () => dialog.evaluate(el => ['.app-modal-footer', '[name=minimum]', '[name=description]'].map(sel => { const r = el.querySelector(sel).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
      const before = await measure(); await category.fill('a'); await dialog.getByRole('option', { name: 'Galletas', exact: true }).waitFor();
      assert.deepEqual(await measure(), before);
      assert.equal(await dialog.locator('.app-search-select-panel:visible .app-alert:visible').count(), 0);
      assert.equal(await dialog.locator('.app-search-select-panel:visible').evaluate(n => getComputedStyle(n).position), 'fixed');
      await shot('sugerencias'); await category.press('ArrowDown'); await category.press('Enter');
      assert.equal(await category.inputValue(), 'Bebidas');
      await category.fill('gal'); await dialog.getByRole('option', { name: 'Galletas', exact: true }).waitFor(); assert.equal(await category.inputValue(), 'gal');
      await category.press('ArrowDown'); await category.press('Enter'); assert.equal(await dialog.locator('select[name=categoryId]').inputValue(), '3');
      await category.fill(''); assert.equal(await category.getAttribute('aria-expanded'), 'false'); assert.equal(await dialog.locator('select[name=categoryId]').inputValue(), '');
      await dialog.locator('[name=name]').fill('Producto de prueba'); await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const confirm = page.getByRole('dialog', { name: 'Descartar cambios', exact: true }); await confirm.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    });
    await t.test('vacío integrado y detalle adaptable; selector móvil dentro de pantalla', async () => {
      const filter = page.locator('#module-category'); await filter.click(); await page.getByRole('option', { name: 'Dulces', exact: true }).click();
      await page.locator('.app-table-state-title').filter({ hasText: 'Sin resultados' }).waitFor();
      assert.equal(await page.locator('.app-table-state-message').evaluate(n => getComputedStyle(n).flexDirection), 'column'); await shot('vacio');
      await filter.click(); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await page.locator('[data-row-index="0"]').waitFor();
      await page.setViewportSize({ width: 768, height: 850 }); await page.locator('.app-table-details-toggle').first().click(); await shot('fila-movil');
      await page.setViewportSize({ width: 390, height: 850 }); await page.locator('[data-module-primary]').click();
      const dialog = page.getByRole('dialog', { name: 'Nuevo producto', exact: true });
      const category = dialog.getByRole('combobox', { name: 'Categoría *', exact: true }); await category.fill('a'); await dialog.getByRole('option', { name: 'Galletas', exact: true }).waitFor();
      const panel = await dialog.locator('.app-search-select-panel:visible').boundingBox(); assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 850);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await shot('movil');
      await category.press('Escape'); assert.equal(await dialog.isVisible(), true); await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
