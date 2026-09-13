/** U017: tabla simplificada, detalle seguro, modales y notificaciones; todos los registros son ficticios. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');
test('U017: diseño compartido y catálogo en navegador', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright'), app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6500);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const rows = [
    { id: 101, name: 'Cerveza de demostración 330 ml', stock: '30.000' },
    { id: 203, name: 'Maní de ejemplo', stock: '2203.592' },
    { id: 390, name: 'Producto de prueba', stock: '5.000' }
  ].map(row => ({ categoryId: 1, category: 'Bebidas', unitId: 1, unit: 'Unidad', physicalStock: '34.000', minimum: '10.000', state: 'ACTIVO', presentations: 2, description: 'Registro ficticio para comprobar el diseño.', version: 'a'.repeat(64), ...row }));
  const options = ['Bebidas', 'Dulces', 'Galletas', 'Gaseosas', 'Limpieza', 'Otros', 'Snacks'].map((label, i) => ({ value: String(i + 1), label }));
  await page.route('**/api/productos**', async route => {
    const url = new URL(route.request().url()), sub = url.pathname.replace('/api/productos', '');
    let result;
    if (sub.startsWith('/opciones/')) { const filtered = options.filter(o => o.label.toLowerCase().includes((url.searchParams.get('term') || '').toLowerCase())); result = { options: filtered, total: filtered.length }; }
    else if (sub.endsWith('/presentaciones')) result = { records: [{ id: 1, name: 'Botella', factor: '1.000', barcode: 'DEMO-001', price: '10.00', state: 'ACTIVO' }], total: 1 };
    else if (/^\/\d+$/.test(sub)) result = rows.find(r => r.id === Number(sub.slice(1)));
    else result = { records: rows, total: rows.length };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name) }); } };
  const action = async label => { await page.getByRole('button', { name: 'Acciones del registro 101', exact: true }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await page.goto(app.base + '/productos'); await page.locator('#products-table tr[data-row-index="0"]').waitFor(); await page.evaluate(() => document.fonts.ready);
    await t.test('columnas, números centrados y misma fuente; solo tabla sin aviso permanente', async () => {
      assert.deepEqual(await page.locator('#products-table th:visible').allTextContents(), ['N.º', 'Producto', 'Categoría', 'Unidad base', 'Disponible', 'Estado', 'Acciones']);
      assert.deepEqual(await page.locator('#products-table td.app-table-sequence').allTextContents(), ['1', '2', '3']);
      assert.equal(await page.locator('[data-module-region="messages"]').isVisible(), false);
      const metrics = await page.evaluate(() => {
        const normal = getComputedStyle(document.querySelector('[data-row-index="0"] [data-column-key="name"]'));
        return [...document.querySelectorAll('#products-table .app-table-number, #products-table .app-table-sequence')].map(el => ({ align: getComputedStyle(el).textAlign, font: getComputedStyle(el).fontFamily === normal.fontFamily, variant: getComputedStyle(el).fontVariantNumeric }));
      });
      assert.ok(metrics.every(item => item.align === 'center' && item.font && item.variant === 'normal'));
      const localIcon = await page.evaluate(() => document.querySelector('.module-search-input svg')?.innerHTML === document.querySelector('template[data-ui-icon="search"]').content.firstElementChild.innerHTML);
      assert.equal(localIcon, true);
      await shot('u017-productos.png');
    });
    await t.test('filtro sin barra visible conserva teclado y opciones del final', async () => {
      const input = page.locator('#module-category'); await input.click();
      assert.equal(await page.locator('.app-search-select-list:visible').evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
      await page.keyboard.press('End'); assert.ok(await page.locator('.app-search-select-list:visible').evaluate(el => el.scrollTop > 0));
      await page.keyboard.press('Enter'); assert.equal(await input.inputValue(), 'Snacks');
      await input.click(); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    });
    await t.test('detalle en bloques, icono y números legibles; cierra por pie y recupera el foco', async () => {
      await action('Ver detalle'); const modal = page.getByRole('dialog', { name: 'Detalle del producto', exact: true }); await modal.waitFor();
      assert.equal(await modal.locator('.app-modal-header button').count(), 0); assert.equal(await modal.locator('.app-modal-symbol svg').count(), 1);
      assert.equal(await modal.locator('.app-modal-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(17, 16, 14)');
      assert.equal(await modal.locator('.app-record-detail-number').first().textContent(), '30');
      assert.equal(await modal.locator('.app-record-details dt').count(), 9);
      await shot('u017-detalle.png'); await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Acciones del registro 101', exact: true }).evaluate(el => el === document.activeElement), true);
    });
    await t.test('formulario sin X, sugerencias al escribir, descarte y modal anidado', async () => {
      await page.locator('[data-module-primary]').click(); const modal = page.getByRole('dialog', { name: 'Nuevo producto', exact: true });
      assert.equal(await modal.locator('.app-modal-header button').count(), 0);
      assert.equal(await modal.getByRole('button', { name: 'Limpiar selección' }).count(), 0);
      await modal.locator('[name=name]').fill('Producto de demostración');
      const category = modal.getByRole('combobox', { name: 'Categoría *', exact: true }); await category.fill('gal');
      await modal.getByRole('option', { name: 'Galletas', exact: true }).waitFor(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      assert.equal(await modal.locator('select[name=categoryId]').inputValue(), '3');
      await category.fill(''); assert.equal(await category.getAttribute('aria-expanded'), 'false'); assert.equal(await modal.locator('select[name=categoryId]').inputValue(), '');
      await category.fill('beb'); await modal.getByRole('option', { name: 'Bebidas', exact: true }).waitFor();
      await page.keyboard.press('Escape'); assert.equal(await modal.isVisible(), true); // Primero cierra las sugerencias.
      await shot('u017-formulario.png'); await page.keyboard.press('Escape');
      const confirm = page.getByRole('dialog', { name: 'Descartar cambios', exact: true }); await confirm.waitFor();
      assert.equal(await confirm.locator('.app-modal-symbol svg').count(), 1); await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.keyboard.press('Escape'); await confirm.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      await action('Presentaciones'); const manager = page.getByRole('dialog', { name: 'Presentaciones: ' + rows[0].name, exact: true }); await manager.locator('tr[data-row-index="0"]').waitFor();
      await shot('u017-presentaciones.png'); await manager.getByRole('button', { name: 'Cerrar', exact: true }).click();
    });
    await t.test('notificaciones con icono y título, error temporal y texto seguro', async () => {
      await page.evaluate(() => { window.visualNotice = new ParisUI.NotificationCenter(); visualNotice.show('success', 'Producto de demostración guardado.', { duration: 0 }); visualNotice.show('error', '<img src=x onerror=alert(1)>'); });
      assert.equal(await page.locator('.app-toast:visible .app-toast-title').count(), 2);
      assert.equal(await page.locator('.app-toast:visible .app-alert-icon [data-message-icon]:not([hidden]) svg').count(), 2);
      assert.equal(await page.locator('.app-toast img').count(), 0); await page.waitForTimeout(30); assert.equal(await page.locator('.app-toast[data-kind="error"]').isVisible(), true);
      await shot('u017-notificaciones.png'); await page.evaluate(() => visualNotice.destroy());
      await page.evaluate(() => ParisModule.showMessage('error', 'Problema de demostración que requiere atención.'));
      assert.equal(await page.locator('[data-module-region="messages"]').isVisible(), true);
      await page.evaluate(() => ParisModule.resetMessage()); assert.equal(await page.locator('[data-module-region="messages"]').isVisible(), false);
    });
    await t.test('móvil: tabla y modal dentro de la pantalla; detalles reciben texto seguro', async () => {
      for (const width of [1000, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 850 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.locator('[data-module-primary]').click(); const modal = page.locator('dialog[open]');
      assert.equal(await modal.evaluate(el => el.scrollWidth > el.clientWidth), false);
      assert.ok((await modal.locator('.app-modal-footer').boundingBox()).y < 850);
      await shot('u017-movil.png'); await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => { const view = new ParisUI.RecordDetails({ record: { name: '<script>bad</script>' }, fields: [{ key: 'name', label: 'Nombre' }] }); return view.element.querySelector('script') === null; }), true);
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
