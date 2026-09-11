/** Pruebas U010 de interacción real: filtros, selectores, orden y menús sobre datos simulados. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { server, password } = require('./support/application-fixture');
const fs = require('node:fs');
const path = require('node:path');
test('U010: controles compartidos en Chromium', {
  skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' ? 'Activar PARIS_UI_BROWSER_TESTS=1 para ejecutar Chromium.' : false,
  timeout: 120000
}, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined,
    args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); context.setDefaultTimeout(7000);
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  const visible = text => page.getByText(text, { exact: true }).waitFor({ state: 'visible' });
  const demo = async () => { await page.goto(app.base + '/demostracion/componentes'); await visible('Mostrando 1–10 de 37 registros'); };
  const firstId = () => page.locator('.app-table tbody tr:first-child td:first-child').textContent();
  try {
    await page.goto(app.base + '/login');
    await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password);
    await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await t.test('filtros combinados, fechas inválidas, chips y limpieza', async () => {
      await demo();
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByLabel('Estado', { exact: true }).selectOption('INACTIVO');
      await page.getByLabel('Desde', { exact: true }).fill('2026-09-10'); await page.getByLabel('Hasta', { exact: true }).fill('2026-09-01');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      assert.equal(await page.getByLabel('Hasta', { exact: true }).getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await page.getByLabel('Desde', { exact: true }).fill('2026-09-01'); await page.getByLabel('Hasta', { exact: true }).fill('2026-09-10');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await visible('Mostrando 1–4 de 4 registros');
      await page.getByRole('button', { name: /Quitar filtro Fecha de ejemplo/ }).click();
      await visible('Mostrando 1–8 de 8 registros');
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); await visible('Mostrando 1–10 de 37 registros');
      await page.locator('#module-search').fill('ejemplo 37'); await page.locator('#module-search').press('Enter'); await visible('Mostrando 1–1 de 1 registros');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByLabel('Estado', { exact: true }).selectOption('ACTIVO'); await page.keyboard.press('Escape');
      await visible('Hay cambios sin guardar. ¿Quieres descartarlos?');
      await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      assert.equal(await page.locator('dialog[open]').count(), 0); await visible('Mostrando 1–1 de 1 registros');
    });
    await t.test('selector por páginas, teclado, valor de formulario y bloqueo durante envío', async () => {
      await demo(); await page.locator('[data-module-primary]').click();
      const combo = page.getByRole('combobox', { name: 'Proveedor de ejemplo', exact: true });
      await combo.click(); await visible('20 de 63 opciones.');
      await page.getByRole('button', { name: 'Cargar más opciones', exact: true }).click(); await visible('40 de 63 opciones.');
      await combo.fill('63'); await visible('1 de 1 opciones.');
      await combo.press('ArrowDown'); await combo.press('Enter');
      assert.equal(await combo.inputValue(), 'Proveedor ficticio 63');
      assert.equal(await page.locator('select[name=provider]').inputValue(), 'p63');
      await combo.click(); await visible('20 de 63 opciones.'); await combo.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await page.locator('#demo-name').fill('Proveedor elegido'); await page.locator('#demo-price').fill('12.50');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await visible('Guardando…');
      assert.equal(await combo.isDisabled(), true);
      await visible('Registro ficticio guardado correctamente.'); await visible('Mostrando 1–10 de 38 registros');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByRole('combobox', { name: 'Proveedor de ejemplo', exact: true }).fill('63'); await visible('1 de 1 opciones.');
      await page.getByRole('option', { name: 'Proveedor ficticio 63', exact: true }).click();
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click(); await visible('Mostrando 1–1 de 1 registros');
      await visible('Proveedor elegido');
    });
    await t.test('orden del servidor conserva filtros y reinicia la página', async () => {
      await demo(); await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await visible('Mostrando 11–20 de 37 registros');
      const sort = page.getByRole('button', { name: 'Ordenar por Precio', exact: true });
      await sort.click(); await visible('Mostrando 1–10 de 37 registros'); assert.equal(await firstId(), '1');
      await sort.click(); await page.waitForFunction(() => document.querySelector('.app-table tbody tr td')?.textContent === '37');
      assert.equal(await page.locator('[data-sort-column=price]').getAttribute('aria-sort'), 'descending');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click(); await page.getByLabel('Estado', { exact: true }).selectOption('INACTIVO');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click(); await visible('Mostrando 1–8 de 8 registros'); assert.equal(await firstId(), '36');
      await page.getByRole('button', { name: 'Ordenar por Fecha', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.app-table tbody tr td')?.textContent === '1');
    });
    await t.test('orden local numérico, modo remoto y menús sin duplicar eventos', async () => {
      await demo();
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.createElement('div'); document.body.append(host);
        let calls = 0;
        const table = new UI.DataTable({ container: host, columns: [{ key: 'price', label: 'Precio', type: 'price', sortable: true }],
          records: [{ id: 1, price: 100 }, { id: 2, price: 9 }, { id: 3, price: null }], actions: [{ id: 'edit', label: 'Editar' }],
          actionDisplay: 'menu', onAction: async () => { calls++; } });
        await table.ready; await table.setSort({ key: 'price', direction: 'asc' }); const asc = table.rows.map(row => row.id);
        await table.setSort({ key: 'price', direction: 'desc' }); const desc = table.rows.map(row => row.id);
        for (let i = 0; i < 3; i++) await table.refresh();
        const menu = table.menus[0]; menu.open(); menu.buttons[0].click(); await new Promise(resolve => setTimeout(resolve, 0));
        const role = menu.panel.getAttribute('role'); table.destroy(); host.remove();
        return { asc, desc, calls, role };
      });
      assert.deepEqual(result, { asc: [2, 1, 3], desc: [1, 2, 3], calls: 1, role: 'menu' });
      await page.locator('[data-demo-menu]').check();
      const trigger = page.getByRole('button', { name: 'Acciones del registro 1', exact: true });
      await trigger.focus(); await trigger.press('ArrowDown');
      assert.equal(await page.getByRole('menuitem', { name: 'Editar Producto de ejemplo 01', exact: true }).evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('End'); assert.equal(await page.getByRole('menuitem', { name: 'Eliminar Producto de ejemplo 01', exact: true }).evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Escape'); assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
      await trigger.click(); await page.getByRole('menuitem', { name: 'Eliminar Producto de ejemplo 01', exact: true }).click();
      await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await visible('Mostrando 1–10 de 36 registros');
    });
    await t.test('selector ignora respuestas antiguas, muestra texto seguro y permite reintentar', async () => {
      await demo();
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = UI.element('div'); document.body.append(host);
        const label = UI.element('label', '', 'Selector de prueba'), select = UI.element('select'); select.id = label.htmlFor = 'test-selector';
        select.append(new Option('Sin selección', '')); host.append(label, select);
        const pending = {}; let failed = true;
        const control = new UI.SearchSelect({ select, load: ({ term }) => {
          if (term === 'error' && failed) return Promise.reject(new Error('simulado'));
          return new Promise(resolve => { pending[term] = resolve; });
        } });
        control.opened = true; control.panel.hidden = false;
        const old = control.fetchOptions('old'), latest = control.fetchOptions('new');
        const attack = '<img src=x onerror=alert(1)>';
        pending.new({ options: [{ value: 1, label: attack }], total: 1 }); await latest;
        pending.old({ options: [{ value: 2, label: 'Antiguo' }], total: 1 }); await old;
        const safe = !host.querySelector('img') && host.textContent.includes(attack) && !host.textContent.includes('Antiguo');
        await control.fetchOptions('error'); const retry = !control.retry.hidden;
        failed = false; const recovery = control.fetchOptions('error'); pending.error({ options: [{ value: 3, label: 'Recuperado' }], total: 1 }); await recovery;
        control.choose(0); const value = select.value; control.destroy(); const restored = select.id === 'test-selector' && !select.hidden;
        host.remove(); return { safe, retry, value, restored };
      });
      assert.deepEqual(result, { safe: true, retry: true, value: '3', restored: true });
    });
    await t.test('selector requerido enfoca el campo visible y el formulario mantiene las ayudas', async () => {
      await demo(); await page.locator('[data-module-primary]').click();
      await page.evaluate(() => { document.querySelector('select[name=provider]').required = true; });
      await page.locator('#demo-name').fill('Validar selector'); await page.locator('#demo-price').fill('12');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      const combo = page.getByRole('combobox', { name: 'Proveedor de ejemplo', exact: true });
      assert.equal(await combo.getAttribute('aria-invalid'), 'true'); assert.equal(await combo.evaluate(node => node === document.activeElement), true);
      await combo.fill('01'); await visible('1 de 1 opciones.'); await combo.press('ArrowDown'); await combo.press('Enter');
      assert.notEqual(await combo.getAttribute('aria-invalid'), 'true');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await visible('Registro ficticio guardado correctamente.');
    });
    await t.test('controles móviles sin desbordar la página y menú visible', async () => {
      await page.setViewportSize({ width: 390, height: 800 }); await demo();
      await page.locator('[data-demo-menu]').check();
      await page.getByRole('button', { name: 'Acciones del registro 1', exact: true }).click();
      const bounds = await page.getByRole('menu').evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; });
      assert.ok(bounds.left >= 0 && bounds.right <= 390 && bounds.bottom <= 800);
      await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByRole('combobox', { name: 'Proveedor de ejemplo', exact: true }).click(); await visible('20 de 63 opciones.');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const footer = await page.locator('dialog[open] .app-modal-footer').boundingBox(); assert.ok(footer.y + footer.height <= 800);
      if (process.env.PARIS_UI_SCREENSHOTS) {
        fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'filtros-movil.png') });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'filtros.png') });
      }
      assert.deepEqual(errors, []);
    });
  } finally { await context.close(); await browser.close(); await app.close(); }
});
