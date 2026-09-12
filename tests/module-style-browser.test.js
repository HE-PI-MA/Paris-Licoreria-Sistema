/** U013: controles directos y distribución en Chromium con datos ficticios; no escribe en MySQL. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');

test('U013: cabecera compartida y filtro directo', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(6000);
  const errors = [], lists = [], optionPages = [];
  let failOptions = true;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/productos**', async route => {
    const url = new URL(route.request().url());
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/opciones/categories')) {
      if (failOptions) return send({ error: 'Fallo simulado' }, 503);
      const number = Number(url.searchParams.get('page')); optionPages.push(number);
      const options = Array.from({ length: 103 }, (_, i) => ({ value: String(i + 1), label: i === 102 ? '<img src=x onerror=alert(1)>' : i === 0 ? 'Bebidas alcohólicas' : 'Categoría ' + (i + 1) }));
      return send({ options: options.slice((number - 1) * 100, number * 100), total: 103 });
    }
    const query = Object.fromEntries(url.searchParams); lists.push(query);
    const start = (Number(query.page) - 1) * Number(query.pageSize);
    return send({ records: Array.from({ length: Math.min(Number(query.pageSize), 130 - start) }, (_, i) => ({ id: start + i + 1, name: 'Producto de prueba ' + (start + i + 1), category: 'Bebidas alcohólicas', unit: 'Unidad', presentations: 2, stock: 30, minimum: 10, state: 'ACTIVO' })), total: 130 });
  });
  try {
    await page.goto(app.base + '/login');
    await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password);
    await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await page.goto(app.base + '/productos');
    await t.test('error persistente y reintento cargan todas las categorías como texto seguro', async () => {
      await page.getByRole('alert').filter({ hasText: 'No se pudo cargar categoría' }).waitFor();
      assert.equal(await page.locator('.module-filter-button').count(), 0);
      assert.equal(await page.locator('#module-controls-help').count(), 0);
      assert.equal(await page.locator('#module-category').isDisabled(), true);
      await page.locator('#module-search').fill('bebida');
      await page.waitForResponse(r => r.url().includes('term=bebida'));
      failOptions = false;
      await page.getByRole('button', { name: 'Reintentar categoría', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.module-category-field select').options.length === 104);
      assert.deepEqual(optionPages, [1, 2]);
      assert.equal(await page.locator('.module-category-field select option').last().textContent(), '<img src=x onerror=alert(1)>');
      assert.equal(await page.locator('#module-category').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('.app-filter-feedback').isVisible(), false);
    });
    await t.test('selección inmediata conserva búsqueda pendiente y vuelve a la página uno', async () => {
      await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
      await page.getByText('Mostrando 1–100 de 130 registros', { exact: true }).waitFor({ state: 'attached' });
      const before = lists.length;
      await page.locator('#module-search').fill('nuevo término');
      await page.locator('#module-category').click();
      await page.getByRole('option', { name: 'Categoría 2', exact: true }).click();
      await page.getByText('Mostrando 1–50 de 130 registros', { exact: true }).waitFor({ state: 'attached' });
      await page.waitForTimeout(350);
      assert.equal(lists.length, before + 1);
      assert.equal(lists.at(-1).term, 'nuevo término'); assert.equal(lists.at(-1).categoryId, '2');
      assert.equal(lists.at(-1).state, undefined); assert.equal(lists.at(-1).lowStock, undefined);
      await page.locator('#module-category').click();
      const cleared = page.waitForResponse(r => r.url().includes('/api/productos?') && !r.url().includes('categoryId'));
      await page.getByRole('option', { name: 'Todas las categorías', exact: true }).click();
      await cleared;

      assert.equal(await page.locator('dialog[open]').count(), 0);
    });
    await t.test('destruir y reconstruir no duplica eventos y cancela consultas pendientes', async () => {
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.createElement('section'), search = document.createElement('input'), select = document.createElement('select');
        host.append(search, select); document.body.append(host);
        let calls = 0, aborted = false;
        const config = { container: host, searchInput: search, mode: 'inline', fields: [{ name: 'category', label: 'Categoría', type: 'select', control: select, options: [{ value: '1', label: 'Uno' }] }], onChange: () => calls++ };
        const first = new UI.FilterBar(config); await first.ready; first.destroy();
        const second = new UI.FilterBar(config); await second.ready; select.value = '1'; select.dispatchEvent(new Event('change')); second.destroy();
        const third = new UI.FilterBar({ ...config, fields: [{ ...config.fields[0], load: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Abort', 'AbortError')); }, { once: true })) }] });
        third.destroy(); await third.ready;
        const clean = !host.querySelector('.app-filter-feedback') && !select.disabled;
        host.remove(); return { calls, aborted, clean };
      });
      assert.deepEqual(result, { calls: 1, aborted: true, clean: true });
    });
    await t.test('cabeceras alineadas, colores compartidos y controles sin desbordamiento', async () => {
      await page.locator('#module-search').fill(''); await page.locator('#module-search').press('Enter');
      for (const width of [1440, 1000]) {
        await page.setViewportSize({ width, height: 960 });
        const sizes = await page.evaluate(() => {
          const header = document.querySelector('.module-header'), sidebar = document.querySelector('.sidebar-header');
          return { main: header.getBoundingClientRect().bottom, side: sidebar.getBoundingClientRect().bottom,
            background: getComputedStyle(header).backgroundColor, sideBackground: getComputedStyle(document.querySelector('.paris-sidebar')).backgroundColor,
            searchBackground: getComputedStyle(document.querySelector('.module-controls-panel')).backgroundColor };
        });
        assert.ok(Math.abs(sizes.main - sizes.side) <= 1, JSON.stringify(sizes));
        assert.ok(sizes.main <= 85, 'Cabecera compacta en ambos estados');
        assert.equal(sizes.background, sizes.sideBackground); assert.equal(sizes.searchBackground, 'rgba(0, 0, 0, 0)');
      }
      await page.setViewportSize({ width: 1440, height: 960 });
      assert.equal(await page.locator('.module-panel-heading').count(), 0);
      assert.equal(await page.locator('#products-table .app-table-sort span').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
      await page.locator('#module-search').blur();
      if (process.env.PARIS_UI_SCREENSHOTS) {
        fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'productos-u014-desktop.png'), fullPage: true });
      }
      for (const width of [900, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Ancho ' + width);
        assert.equal(await page.locator('#module-category').isVisible(), true);
        if (width === 390 && process.env.PARIS_UI_SCREENSHOTS) {
          await page.locator('#products-table [data-table-details="0"]').click();
          await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'productos-u014-mobile.png') });
        }
        await page.locator('[data-module-primary]').click(); await page.getByRole('dialog').first().waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('dialog[open]').count(), 0);
      }
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
