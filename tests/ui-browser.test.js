/**
 * Pruebas opcionales en Chromium real sobre el servidor ficticio compartido.
 * Ejecutar con PARIS_UI_BROWSER_TESTS=1 y Playwright instalado; nunca usa MySQL del negocio.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { server, password } = require('./support/application-fixture');

test('U009: componentes en navegador real', {
  skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' ? 'Activar PARIS_UI_BROWSER_TESTS=1 para ejecutar Chromium.' : false,
  timeout: 120000
}, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined,
    args: process.env.PARIS_BROWSER_ARGS ? JSON.parse(process.env.PARIS_BROWSER_ARGS) : []
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(7000);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const visible = async text => page.getByText(text, { exact: true }).waitFor({ state: text.startsWith('Mostrando ') ? 'attached' : 'visible' });
  const demo = async () => {
    await page.goto(app.base + '/demostracion/componentes');
    await visible('Mostrando 1–10 de 37 registros');
  };
  try {
    await page.goto(app.base + '/login');
    await page.locator('[name="nombre_usuario"]').fill('audit_user');
    await page.locator('[name="contrasena"]').fill(password);
    await page.locator('[data-login-submit]').click();
    await page.waitForURL('**/inicio');

    await t.test('paginación, búsqueda, filtros, vacío y reintento', async () => {
      await demo();
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
      await visible('Mostrando 11–20 de 37 registros');
      await page.getByLabel('Por página', { exact: true }).selectOption('5');
      await visible('Mostrando 1–5 de 37 registros');
      await page.locator('#module-search').fill('ejemplo 37');
      await visible('Mostrando 1–1 de 1 registros');
      await page.locator('#module-search').fill('no-existe');
      await visible('No hay registros para mostrar.');
      await page.getByRole('button', { name: 'Restablecer ejemplos', exact: true }).click();
      await visible('Mostrando 1–5 de 37 registros');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByLabel('Estado', { exact: true }).selectOption('INACTIVO');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await visible('Mostrando 1–5 de 8 registros');
      await page.getByRole('button', { name: 'Simular error de carga', exact: true }).click();
      await visible('No se pudo cargar el listado. Inténtalo nuevamente.');
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await visible('Mostrando 1–5 de 8 registros');
      await page.getByRole('button', { name: 'Lista vacía', exact: true }).click();
      await visible('No hay registros para mostrar.');
    });

    await t.test('modal, teclado, cambios pendientes y recuperación de foco', async () => {
      await demo();
      await page.locator('[data-module-primary]').click();
      assert.equal(await page.locator('#demo-name').evaluate(node => node === document.activeElement), true);
      await page.locator('#demo-name').focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.getByRole('button', { name: 'Guardar', exact: true }).evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#demo-name').evaluate(node => node === document.activeElement), true);
      await page.locator('#demo-name').fill('Cambio sin guardar');
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Descartar cambios', exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 2);
      assert.equal(await page.getByRole('dialog', { name: 'Descartar cambios', exact: true })
        .getByRole('button', { name: 'Cancelar', exact: true }).evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Descartar cambios', exact: true }).waitFor({ state: 'detached' });
      assert.equal(await page.locator('#demo-name').inputValue(), 'Cambio sin guardar');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      await page.locator('dialog[open]').waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-module-primary]').evaluate(node => node === document.activeElement), true);
    });

    await t.test('validación accesible, guardado único y recuperación de fallo', async () => {
      await demo();
      await page.locator('[data-module-primary]').click();
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      assert.equal(await page.locator('#demo-name').getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#demo-name').getAttribute('aria-describedby'), /demo-name-help/);
      await page.locator('#demo-name').fill('Registro nuevo ficticio');
      await page.locator('#demo-price').fill('15.50');
      await page.locator('[name="fail"]').check();
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await visible('No se pudo guardar. Revisa la conexión e inténtalo nuevamente.');
      assert.equal(await page.locator('#demo-name').inputValue(), 'Registro nuevo ficticio');
      assert.equal(await page.getByRole('button', { name: 'Guardar', exact: true }).isEnabled(), true);
      await page.locator('[name="fail"]').uncheck();
      const busy = await page.evaluate(() => {
        const form = document.getElementById('demo-form');
        form.requestSubmit(); form.requestSubmit();
        return form.getAttribute('aria-busy');
      });
      assert.equal(busy, 'true');
      await visible('Guardando…');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await visible('Registro ficticio guardado correctamente.');
      await visible('Mostrando 1–10 de 38 registros');
      assert.equal(await page.locator('dialog[open]').count(), 0);
    });

    await t.test('acciones delegadas y confirmación de eliminación', async () => {
      await demo();
      await page.getByRole('button', { name: 'Eliminar Producto de ejemplo 01', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Eliminar Producto de ejemplo 01', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Eliminar Producto de ejemplo 01', exact: true }).click();
      await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await visible('Mostrando 1–10 de 36 registros');
      assert.equal(await page.getByRole('button', { name: 'Eliminar Producto de ejemplo 01', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Desactivar', exact: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Desactivar', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.app-data-table').getAttribute('aria-busy') === 'false');
      assert.equal(await page.getByRole('button', { name: 'Activar', exact: true }).count() >= 2, true);
    });

    await t.test('texto seguro, respuestas atrasadas y eventos sin duplicar', async () => {
      await demo();
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI;
        const host = document.createElement('div'); document.body.append(host);
        const pending = {};
        let calls = 0;
        const table = new UI.DataTable({
          container: host, columns: [{ key: 'name', label: 'Nombre' }],
          actions: [{ id: 'test', label: 'Probar' }], onAction: () => { calls++; },
          load: ({ query }) => query.term ? new Promise(resolve => { pending[query.term] = resolve; }) :
            Promise.resolve({ records: [{ id: 1, name: 'Inicial' }], total: 1 })
        });
        await table.ready;
        const old = table.setQuery({ term: 'old' }), latest = table.setQuery({ term: 'new' });
        const attack = '<img src=x onerror=alert(1)>';
        pending.new({ records: [{ id: 1, name: attack }], total: 1 }); await latest;
        pending.old({ records: [{ id: 1, name: 'ANTERIOR' }], total: 1 }); await old;
        const safe = !host.querySelector('img') && host.textContent.includes(attack) && !host.textContent.includes('ANTERIOR');
        host.querySelector('[data-table-action]').click(); await Promise.resolve();
        table.destroy();
        const second = new UI.DataTable({ container: host, columns: [{ key: 'name', label: 'Nombre' }],
          records: [{ id: 2, name: 'Local' }], actions: [{ id: 'test', label: 'Probar' }], onAction: () => { calls++; } });
        await second.ready; await second.setData([{ id: 3, name: 'Actualizado' }]);
        host.querySelector('[data-table-action]').click(); await Promise.resolve();
        second.destroy(); host.remove();
        return { safe, calls };
      });
      assert.deepEqual(result, { safe: true, calls: 2 });
    });

    await t.test('notificaciones persistentes y pausa mientras se leen', async () => {
      await demo();
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        window.testNotices = new window.ParisUI.NotificationCenter();
        testNotices.show('error', 'Error persistente de prueba', { duration: 1 });
        testNotices.show('success', 'Éxito con pausa', { duration: 150 });
        testNotices.region.lastElementChild.focus();
      });
      await page.waitForTimeout(250);
      await visible('Error persistente de prueba');
      await visible('Éxito con pausa');
      await page.locator('[data-module-primary]').focus();
      await page.getByText('Éxito con pausa', { exact: true }).waitFor({ state: 'detached' });
      await visible('Error persistente de prueba');
      await page.evaluate(() => { testNotices.destroy(); delete window.testNotices; });
    });

    await t.test('alto completo, formulario largo y tamaños de pantalla', async () => {
      await demo();
      await page.getByRole('button', { name: 'Formulario largo', exact: true }).click();
      const layout = await page.locator('dialog[open]').evaluate(dialog => {
        const body = dialog.querySelector('.app-modal-body');
        const footer = dialog.querySelector('.app-modal-footer');
        const before = footer.getBoundingClientRect().top;
        body.scrollTop = body.scrollHeight;
        return { scroll: body.scrollHeight > body.clientHeight, stable: before === footer.getBoundingClientRect().top,
          visible: footer.getBoundingClientRect().bottom <= innerHeight };
      });
      assert.deepEqual(layout, { scroll: true, stable: true, visible: true });
      await page.keyboard.press('Escape');
      for (const width of [1440, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(app.base + '/productos');
        const geometry = await page.evaluate(() => {
          const main = document.getElementById('module-content').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth + 1, bottom: main.bottom };
        });
        assert.equal(geometry.overflow, false, 'Desbordamiento en ' + width);
        assert.ok(geometry.bottom >= 899, 'Altura incompleta en ' + width);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(app.base + '/productos');
      await page.setViewportSize({ width: 1000, height: 1000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false);
      if (process.env.PARIS_UI_SCREENSHOTS) {
        const directory = process.env.PARIS_UI_SCREENSHOTS;
        fs.mkdirSync(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, 'productos-contraido.png'), fullPage: true, animations: 'disabled' });
        await demo();
        await page.screenshot({ path: path.join(directory, 'demostracion.png'), fullPage: true, animations: 'disabled' });
        await page.locator('[data-module-primary]').click();
        await page.screenshot({ path: path.join(directory, 'modal.png'), animations: 'disabled' });
      }
      assert.deepEqual(errors, []);
    });
  } finally {
    await context.close();
    await browser.close();
    await app.close();
  }
});
