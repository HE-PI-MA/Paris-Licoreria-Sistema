/** U019: marca, texto de ejemplo y listado de presentaciones sobre datos ficticios. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');

test('U019: botones de marca, detalle alineado y presentaciones continuas', {
  skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000
}, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6500);
  const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
  const row = { id: 101, name: 'Maní de demostración', categoryId: 1, category: 'Otros', unitId: 1, unit: 'Gramo',
    stock: '2203.592', physicalStock: '2203.592', minimum: '500.000', state: 'ACTIVO', presentations: 3,
    description: 'Producto ficticio por peso controlado en gramos.', version: 'a'.repeat(64) };
  let total = 1, failMore = false;
  await page.route('**/api/productos**', async route => {
    const url = new URL(route.request().url()), sub = url.pathname.replace('/api/productos', ''); requests.push({ sub, method: route.request().method(), page: url.searchParams.get('page') });
    let result;
    if (sub.startsWith('/opciones/')) result = { options: [{ value: '1', label: sub.endsWith('units') ? 'Gramo' : 'Otros' }], total: 1 };
    else if (sub.endsWith('/presentaciones')) {
      const page = Number(url.searchParams.get('page')), pageSize = Number(url.searchParams.get('pageSize'));
      if (failMore && page === 2) { failMore = false; await route.fulfill({ status: 500, body: '{}' }); return; }
      const records = Array.from({ length: total }, (_, i) => ({ id: 401 + i, name: 'Presentación de prueba ' + (i + 1), factor: '1.000', price: '5.00', barcode: 'DEMO-' + (i + 1), state: 'ACTIVO' }));
      result = { records: records.slice((page - 1) * pageSize, page * pageSize), total };
    } else if (sub === '/101') result = row;
    else result = { records: [row], total: 1 };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'u019-' + name + '.png') }); } };
  const action = async label => { await page.getByRole('button', { name: 'Acciones del registro 101', exact: true }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password);
    await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio'); await page.goto(app.base + '/productos');
    await page.locator('#products-table [data-row-index="0"]').waitFor(); await page.evaluate(() => document.fonts.ready);
    await t.test('botones con relleno sólido, texto legible y controles por teclado', async () => {
      const primary = page.locator('[data-module-primary]'), trigger = page.getByRole('button', { name: 'Acciones del registro 101', exact: true });
      const styles = await primary.evaluate(n => ({ color: getComputedStyle(n).color, background: getComputedStyle(n).backgroundColor, image: getComputedStyle(n).backgroundImage }));
      assert.equal(styles.background, await trigger.evaluate(n => getComputedStyle(n).backgroundColor)); assert.equal(styles.image, 'none');
      await shot('productos'); await trigger.click();
      const colors = await page.getByRole('menu').getByRole('menuitem').evaluateAll(nodes => nodes.map(n => ({ color: getComputedStyle(n).color, background: getComputedStyle(n).backgroundColor, image: getComputedStyle(n).backgroundImage })));
      assert.ok(colors.every(c => c.color === 'rgb(255, 255, 255)' && c.image === 'none')); assert.equal(new Set(colors.map(c => c.background)).size, 5);
      await shot('acciones'); await page.keyboard.press('End'); assert.equal(await page.getByRole('menuitem', { name: 'Eliminar', exact: true }).evaluate(n => n === document.activeElement), true);
      await page.keyboard.press('Escape'); assert.equal(await trigger.evaluate(n => n === document.activeElement), true);
    });
    await t.test('el ejemplo se oculta al enfocar; etiquetas, selección y texto escrito se conservan', async () => {
      const search = page.locator('#module-search'); const original = await search.getAttribute('placeholder');
      await search.focus(); assert.equal(await search.evaluate(n => getComputedStyle(n, '::placeholder').opacity), '0');
      await search.fill('MANÍ'); await search.blur(); assert.equal(await search.inputValue(), 'MANÍ'); assert.equal(await search.getAttribute('placeholder'), original);
      await search.fill(''); await search.blur(); assert.notEqual(await search.evaluate(n => getComputedStyle(n, '::placeholder').opacity), '0');
      await page.locator('[data-module-primary]').click(); const modal = page.getByRole('dialog', { name: 'Nuevo producto', exact: true }); await modal.waitFor();
      const category = modal.getByRole('combobox', { name: 'Categoría *', exact: true }); await category.focus();
      assert.equal(await category.evaluate(n => getComputedStyle(n, '::placeholder').opacity), '0');
      assert.equal(await modal.getByText('Categoría *', { exact: true }).isVisible(), true);
      await category.fill('ot'); await modal.getByRole('option', { name: 'Otros', exact: true }).click();
      await category.focus(); assert.equal(await category.inputValue(), 'Otros'); assert.equal(await modal.locator('select[name=categoryId]').inputValue(), '1');
      await shot('formulario'); await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const confirm = page.getByRole('dialog', { name: 'Descartar cambios', exact: true }); await confirm.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    });
    await t.test('detalle alineado en escritorio y legible en móvil, con cantidades exactas', async () => {
      await action('Ver detalle'); const modal = page.getByRole('dialog', { name: 'Detalle del producto', exact: true }); await modal.waitFor();
      const positions = await modal.locator('.app-record-detail dd').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().left)); assert.ok(positions.every(x => Math.abs(x - positions[0]) < 1));
      assert.equal(await modal.locator('.app-record-detail-number').first().textContent(), '2.203,592'); await shot('detalle');
      await page.setViewportSize({ width: 390, height: 850 });
      assert.equal(await modal.evaluate(n => n.scrollWidth > n.clientWidth), false); await shot('detalle-movil');
      await modal.getByRole('button', { name: 'Cerrar', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 950 });
    });
    await t.test('presentaciones sin franja paginada; lista corta compacta y lista larga completa con reintento', async () => {
      await action('Presentaciones'); let modal = page.getByRole('dialog', { name: 'Presentaciones: ' + row.name, exact: true }); await modal.locator('[data-row-index="0"]').waitFor();
      assert.equal(await modal.locator('.app-table-size, .app-table-pagination').count(), 0);
      assert.equal(await modal.locator('.app-table-footer').isVisible(), false);
      const scroll = await modal.locator('.app-table-scroll').boundingBox(); assert.ok(scroll.height > 70 && scroll.height < 200); await shot('presentaciones');
      await modal.getByRole('button', { name: 'Cerrar', exact: true }).click(); total = 68; failMore = true;
      await action('Presentaciones'); modal = page.getByRole('dialog', { name: 'Presentaciones: ' + row.name, exact: true }); await modal.locator('[data-row-index="49"]').waitFor({ state: 'attached' });
      await modal.locator('.app-table-scroll').evaluate(n => { n.scrollTop = n.scrollHeight; });
      await modal.getByRole('button', { name: 'Reintentar', exact: true }).waitFor(); assert.equal(await modal.locator('tr[data-row-index]').count(), 50);
      await modal.getByRole('button', { name: 'Reintentar', exact: true }).click(); await modal.locator('[data-row-index="67"]').waitFor({ state: 'attached' });
      assert.equal(await modal.locator('tr[data-row-index]').count(), 68); assert.equal(await modal.locator('.app-table-sequence').last().textContent(), '68');
      assert.equal(await modal.locator('.app-table-footer').isVisible(), false); assert.equal(await modal.locator('.app-table-scroll').evaluate(n => n.scrollHeight > n.clientHeight), true);
      assert.ok((await modal.locator('.app-modal-footer').boundingBox()).y < 950); await shot('presentaciones-larga');
      await modal.getByRole('button', { name: 'Cerrar', exact: true }).click(); assert.ok(requests.every(r => r.method === 'GET')); assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
