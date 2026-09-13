/** U033: credenciales ficticias exactas en escritorio y móvil HTTP. No utiliza cuentas del negocio. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');

test('U033: login conserva mayúsculas y minúsculas en escritorio y móvil', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 60000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  try {
    for (const mobile of [true, false]) {
      await t.test(mobile ? 'celular emulado: clave visible exacta y acceso con CSRF' : 'computadora: clave visible exacta y acceso con CSRF', async () => {
        const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined,
          args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
        const context = await browser.newContext({ viewport: mobile ? { width: 360, height: 780 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
        const page = await context.newPage(); page.setDefaultTimeout(6000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        try {
          await page.goto(app.base + '/login');
          const username = page.locator('[name=nombre_usuario]'), secret = page.locator('[name=contrasena]');
          const toggle = page.locator('[data-password-toggle]'), submit = page.locator('[data-login-submit]');
          await username.fill('audit_user'); await secret.fill(password);
          await toggle.click();
          assert.equal(await secret.getAttribute('type'), 'text');
          for (const field of [username, secret]) {
            assert.equal(await field.evaluate(el => getComputedStyle(el).textTransform), 'none', 'el texto debe verse tal como se escribió');
            assert.equal(await field.getAttribute('autocapitalize'), 'none');
            assert.equal(await field.getAttribute('autocorrect'), 'off');
            assert.equal(await field.getAttribute('spellcheck'), 'false');
          }
          assert.equal(await username.inputValue(), 'audit_user'); assert.equal(await secret.inputValue(), password);
          if (process.env.PARIS_UI_SCREENSHOTS) {
            fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true });
            await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, 'login-u033-' + (mobile ? 'movil' : 'escritorio') + '.png') });
          }
          await secret.fill('  Clave-aB19-ñ  '); await toggle.click(); await toggle.click();
          assert.equal(await secret.inputValue(), '  Clave-aB19-ñ  ', 'el ojo conserva incluso espacios y caracteres');
          // CSS no puede corregir una contraseña escrita con otras mayúsculas: el servidor debe rechazarla.
          await secret.fill(password.toUpperCase());
          let response = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
          await submit.click(); assert.equal((await response).status(), 401);
          await page.locator('[data-login-error]').waitFor({ state: 'visible' });
          await secret.fill(password);
          response = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
          await submit.click(); const result = await response;
          assert.equal(result.status(), 200);
          assert.deepEqual(result.request().postDataJSON(), { nombre_usuario: 'audit_user', contrasena: password });
          await page.waitForURL('**/inicio');
          assert.equal(await page.locator('.paris-workspace').count(), 1);
          assert.deepEqual(errors, []);
        } finally { await browser.close(); }
      });
    }
  } finally { await app.close(); }
});
