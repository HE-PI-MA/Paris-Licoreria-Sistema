/** Regresiones U011 en navegador: envío, retorno del foco y búsquedas rápidas con datos ficticios. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { server, password } = require('./support/application-fixture');

test('U011: regresiones de interacción en Chromium', {
  skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' ? 'Activar PARIS_UI_BROWSER_TESTS=1 para ejecutar Chromium.' : false,
  timeout: 60000
}, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined,
    args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(7000);
  const visible = text => page.getByText(text, { exact: true }).waitFor();
  try {
    await t.test('login adaptable: decoración contenida y formulario completo en ventanas bajas y texto ampliado', async () => {
      for (const [width, height, largeText] of [[1440, 1000, false], [1100, 700, false], [1440, 450, false],
        [900, 700, false], [390, 800, false], [320, 560, false], [1440, 450, true]]) {
        await page.setViewportSize({ width, height });
        await page.goto(app.base + '/login');
        if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const layout = await page.evaluate(() => {
          const panel = document.querySelector('.app-login-panel').getBoundingClientRect();
          const shell = document.querySelector('.app-login-shell').getBoundingClientRect();
          const controls = Array.from(document.querySelectorAll('.app-login-form input, .app-login-form button')).map(node => {
            const rect = node.getBoundingClientRect();
            return rect.top >= panel.top && rect.bottom <= panel.bottom && rect.left >= panel.left && rect.right <= panel.right;
          });
          return { controls, extraBottom: document.documentElement.scrollHeight - Math.ceil(shell.bottom + scrollY),
            horizontal: document.documentElement.scrollWidth > innerWidth };
        });
        assert.ok(layout.controls.every(Boolean), JSON.stringify({ width, height, largeText, layout }));
        assert.ok(layout.extraBottom <= 1, 'El fondo no debe crear desplazamiento fuera del login.');
        assert.equal(layout.horizontal, false);
        await page.locator('[data-login-submit]').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('[data-login-submit]').isVisible(), true);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await t.test('el login mantiene el bloqueo hasta navegar, incluso con un segundo submit', async () => {
      await page.goto(app.base + '/login');
      // Un reloj controlado evita que la demora de 450 ms vuelva intermitente esta comprobación.
      await page.clock.install();
      let requests = 0;
      page.on('request', request => { if (request.url().endsWith('/api/auth/login')) requests++; });
      await page.locator('[name=nombre_usuario]').fill('audit_user');
      await page.locator('[name=contrasena]').fill(password);
      await page.locator('[data-login-submit]').click();
      await visible('Inicio de sesion correcto. Redirigiendo...');
      assert.equal(await page.locator('[data-login-submit]').isDisabled(), true);
      await page.locator('[data-login-form]').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
      assert.equal(requests, 1);
      await page.clock.runFor(500);
      await page.waitForURL('**/inicio');
    });
    await t.test('cancelar o pulsar Escape devuelve el foco al botón de la fila o a su menú', async () => {
      await page.goto(app.base + '/demostracion/componentes');
      await visible('Mostrando 1–10 de 37 registros');
      const inline = page.getByRole('button', { name: 'Eliminar Producto de ejemplo 01', exact: true });
      await inline.click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Eliminar Producto de ejemplo 01');
      assert.equal(await inline.isDisabled(), false);
      await page.locator('[data-demo-menu]').check();
      const trigger = page.getByRole('button', { name: 'Acciones del registro 1', exact: true });
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Eliminar Producto de ejemplo 01', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Acciones del registro 1');
      assert.equal(await trigger.isDisabled(), false);
      await visible('Mostrando 1–10 de 37 registros');
    });
    await t.test('quitar un chip conserva la búsqueda todavía pendiente y la aplica al listado', async () => {
      await page.goto(app.base + '/demostracion/componentes');
      await visible('Mostrando 1–10 de 37 registros');
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByLabel('Estado', { exact: true }).selectOption('ACTIVO');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await visible('Mostrando 1–10 de 29 registros');
      await page.evaluate(() => {
        const search = document.getElementById('module-search');
        search.value = 'ejemplo 37'; search.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.app-filter-summary button').click();
      });
      await visible('Mostrando 1–1 de 1 registros');
      assert.equal(await page.locator('#module-search').inputValue(), 'ejemplo 37');
      assert.equal(await page.locator('.app-table tbody tr:first-child td:first-child').textContent(), '37');
    });
  } finally { await browser.close(); await app.close(); }
});
