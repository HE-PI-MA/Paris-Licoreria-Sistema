/** U036: escribir, cancelar y guardar categorías desde Nuevo producto; navegador y MySQL temporal. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { database } = require('./support/inventory-mysql-fixture'), { server, password } = require('./support/application-fixture');
test('U036: Nueva categoría en Nuevo producto', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1' || !process.env.TEST_DB_USER, timeout: 120000 }, async t => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), app = await server({ productRepository: repo });
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright'), browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/productos')) posts++; });
  const modal = title => page.getByRole('dialog', { name: title, exact: true }), form = () => modal('Nuevo producto');
  const category = () => form().getByRole('combobox', { name: 'Categoría *', exact: true });
  const count = async name => (await db.owner.query('SELECT COUNT(*) AS n FROM categoria WHERE nombre=?', [name]))[0][0].n;
  const open = async name => { await page.locator('[data-module-primary]').click(); await form().locator('[name=name]').fill(name); };
  const unit = async () => { await form().getByRole('combobox', { name: '¿Cómo lo cuentas? *', exact: true }).fill('UNI'); await page.locator('[role=option]:visible').first().click(); };
  const cancel = async () => { await form().getByRole('button', { name: 'Cancelar', exact: true }).click(); if (await modal('Descartar cambios').isVisible()) await modal('Descartar cambios').getByRole('button', { name: 'Descartar cambios', exact: true }).click(); };
  const save = async () => { await form().getByRole('button', { name: 'Guardar', exact: true }).click(); await form().waitFor({ state: 'detached' }); await page.mouse.move(0, 0); await page.locator('.app-toast[data-kind=success]').waitFor({ state: 'detached' }); };
  const shot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name + '.png') }); } };
  const check = async (name, fn) => { let failure; await t.test(name, async () => { try { await fn(); } catch (e) { failure = e; await shot('u036-fallo'); throw e; } }); if (failure) throw failure; };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio'); await page.goto(app.base + '/productos');
    await check('AGUAS permanece al salir del selector y cancelar no crea nada', async () => {
      await open('AGUA FICTICIA 2 LITROS'); await category().fill('aguas'); await category().press('Tab');
      assert.equal(await category().inputValue(), 'AGUAS'); assert.equal(await category().getAttribute('aria-required'), 'true'); assert.equal(await category().getAttribute('maxlength'), '80');
      await shot('u036-categoria-escritorio'); assert.equal(await count('AGUAS'), 0); assert.equal(posts, 0); await cancel(); assert.equal(await count('AGUAS'), 0);
    });
    await check('guardar registra la categoría y el producto sin exigir selección de una opción inexistente', async () => {
      await open('AGUA FICTICIA 2 LITROS'); await category().fill('aguas'); await unit(); assert.equal(await category().inputValue(), 'AGUAS'); await save();
      assert.equal(await count('AGUAS'), 1); const saved = (await repo.list({ term: 'AGUA FICTICIA', page: 1, pageSize: 10, sort: 'name' })).records[0]; assert.equal(saved.category, 'AGUAS');
    });
    await check('escribir una categoría existente o seleccionarla reutiliza el mismo registro', async () => {
      await open('OTRA AGUA FICTICIA'); await category().fill(' aguas '); await category().press('Tab'); await unit(); await save(); assert.equal(await count('AGUAS'), 1);
      await open('TERCERA AGUA FICTICIA'); await category().fill('AGU'); await page.getByRole('option', { name: 'AGUAS', exact: true }).click(); await unit(); await save(); assert.equal(await count('AGUAS'), 1);
    });
    await check('categoría vacía bloquea Guardar y una categoría inactiva no se duplica ni reactiva', async () => {
      await open('NO SE GUARDA'); await unit(); const before = posts; await form().getByRole('button', { name: 'Guardar', exact: true }).click();
      await form().getByText('Completa este campo.', { exact: true }).waitFor(); assert.equal(posts, before); await cancel();
      await db.owner.query("INSERT INTO categoria(nombre,estado) VALUES('BLOQUEADA','INACTIVO')");
      await open('TAMPOCO SE GUARDA'); await category().fill('BLOQUEADA'); await unit(); await form().getByRole('button', { name: 'Guardar', exact: true }).click();
      await form().getByText('Esta categoría está inactiva.', { exact: true }).waitFor(); assert.equal(await category().inputValue(), 'BLOQUEADA'); assert.equal(await count('BLOQUEADA'), 1); await cancel();
    });
    await check('móvil conserva el texto y las sugerencias flotantes no desplazan los campos', async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await open('PRODUCTO MÓVIL'); await category().scrollIntoViewIfNeeded(); const before = (await form().locator('[name=minimum]').boundingBox()).y;
      await category().fill('AGU'); await page.getByRole('option', { name: 'AGUAS', exact: true }).waitFor(); assert.equal((await form().locator('[name=minimum]').boundingBox()).y, before);
      await category().fill('AGUAS NUEVAS'); await category().press('Tab'); assert.equal(await category().inputValue(), 'AGUAS NUEVAS'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot('u036-categoria-movil'); await cancel(); assert.equal(await count('AGUAS NUEVAS'), 0); assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); await db.close(); }
});
