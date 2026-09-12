/** U015: aspecto uniforme, selector reutilizado, mayúsculas y cabecera móvil. Solo utiliza datos ficticios. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');
test('U015: interfaz compartida compacta', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6000);
  const errors = [], queries = []; page.on('pageerror', e => errors.push(e.message));
  const rows = ['Bebida de demostración', 'Maní de demostración', 'Producto de ejemplo'].map((name, i) => ({ id: 80 + i, name, category: i ? 'Otros' : 'Bebidas alcohólicas', categoryId: i ? 2 : 1, unit: i === 1 ? 'Gramo' : 'Unidad', stock: i === 1 ? '2203.592' : 30, minimum: 10, presentations: 2, state: 'ACTIVO' }));
  await page.route('**/api/productos**', async route => {
    const url = new URL(route.request().url());
    const options = [{ value: '1', label: 'Bebidas alcohólicas' }, { value: '2', label: 'Otros' }];
    const query = Object.fromEntries(url.searchParams); queries.push(query);
    const selected = rows.filter(row => !query.categoryId || row.categoryId === Number(query.categoryId));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.pathname.includes('/opciones/') ? { options, total: 2 } : { records: selected, total: selected.length }) });
  });
  const ready = () => page.waitForFunction(() => document.querySelector('#products-table tbody [data-row-index]') && !document.querySelector('#module-category').disabled);
  const screenshot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name) }); } };
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password);
    assert.equal(await page.locator('[name=contrasena]').inputValue(), password);
    await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await page.goto(app.base + '/productos'); await ready();
    await t.test('filas uniformes, acciones primarias, icono único y tabla sin franja ni contador visible', async () => {
      await page.mouse.move(0, 0);
      const result = await page.evaluate(() => {
        const table = document.querySelector('#products-table'), scroll = table.querySelector('.app-table-scroll');
        const colors = Array.from(table.querySelectorAll('tr[data-row-index]'), row => getComputedStyle(row).backgroundColor);
        const action = table.querySelector('.app-action-menu > button'), primary = document.querySelector('[data-module-primary]');
        const sample = ParisUI.Button.create({ label: 'Agregar', icon: 'plus', variant: 'primary' });
        return { colors, sameButton: getComputedStyle(action).backgroundColor === getComputedStyle(primary).backgroundColor,
          sameIcon: primary.querySelector('svg').innerHTML.trim() === sample.querySelector('svg').innerHTML.trim(),
          scrollbar: getComputedStyle(scroll).scrollbarWidth, gutter: getComputedStyle(scroll).scrollbarGutter,
          gap: scroll.getBoundingClientRect().right - scroll.querySelector('th:last-child').getBoundingClientRect().right,
          unbroken: getComputedStyle(action).whiteSpace === 'nowrap' && getComputedStyle(table.querySelector('.app-badge')).whiteSpace === 'nowrap',
          counter: table.querySelector('[role=status]').classList.contains('app-sr-only'), footer: table.querySelector('footer').hidden,
          upper: getComputedStyle(document.querySelector('h1')).textTransform };
      });
      assert.equal(new Set(result.colors).size, 1); assert.equal(result.sameButton, true); assert.equal(result.sameIcon, true);
      assert.equal(result.scrollbar, 'none'); assert.equal(result.gutter, 'auto'); assert.ok(result.gap <= 2);
      assert.equal(result.unbroken, true); assert.equal(result.counter, true); assert.equal(result.footer, true); assert.equal(result.upper, 'uppercase');
    });
    await t.test('categoría por teclado, cierre con Escape, elección vacía y menú sin desplazar contenido', async () => {
      const input = page.getByRole('combobox', { name: 'Categoría', exact: true });
      const before = await page.locator('#products-table').boundingBox();
      await input.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('option').count(), 3);
      assert.equal((await page.locator('#products-table').boundingBox()).y, before.y);
      await page.keyboard.press('End'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#products-table tbody').querySelectorAll('[data-row-index]').length === 2);
      assert.equal(await input.inputValue(), 'Otros'); assert.equal(queries.at(-1).categoryId, '2');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Escape');
      assert.equal(await input.inputValue(), 'Otros'); assert.equal(await input.getAttribute('aria-expanded'), 'false');
      await input.press('Enter'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#products-table tbody').querySelectorAll('[data-row-index]').length === 3);
      assert.equal(await input.inputValue(), 'Todas las categorías');
      await input.press('b'); await page.keyboard.press('Enter');
      assert.equal(await input.inputValue(), 'Bebidas alcohólicas');
      await input.press('Enter'); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await ready();
    });
    await t.test('texto editable en mayúsculas conserva cursor, composición y códigos exactos', async () => {
      await page.locator('[data-module-primary]').click();
      const name = page.locator('[name=name]'); await name.fill('caña café'); assert.equal(await name.inputValue(), 'CAÑA CAFÉ');
      await name.evaluate(input => input.setSelectionRange(2, 2)); await page.keyboard.type('ñ');
      assert.equal(await name.inputValue(), 'CAÑÑA CAFÉ'); assert.equal(await name.evaluate(input => input.selectionStart), 3);
      const result = await page.evaluate(() => {
        const input = document.querySelector('[name=name]'); input.value = 'composición';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })); const composing = input.value;
        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        const codes = document.createElement('input'); codes.value = 'aBc-01'; document.body.append(codes); codes.dispatchEvent(new Event('input', { bubbles: true })); codes.remove();
        const secret = document.createElement('input'); secret.type = 'password'; secret.dataset.uppercase = ''; secret.value = 'Abc-XyZ'; document.body.append(secret); secret.dispatchEvent(new Event('input', { bubbles: true })); const password = secret.value; secret.remove();
        return { composing, ended: input.value, code: codes.value, password };
      });
      assert.deepEqual(result, { composing: 'composición', ended: 'COMPOSICIÓN', code: 'aBc-01', password: 'Abc-XyZ' });
      await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Descartar cambios', exact: true }).getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      assert.equal(await page.locator('[data-module-primary]').evaluate(el => el === document.activeElement), true);
    });
    await t.test('logo mayor dentro de la cabecera existente y una sola cabecera móvil con hamburguesa operativa', async () => {
      const sizes = await page.evaluate(() => ({ header: document.querySelector('.sidebar-header').getBoundingClientRect().height, logo: document.querySelector('.sidebar-logo-full img').getBoundingClientRect().height }));
      assert.equal(sizes.header, 84); assert.equal(sizes.logo, 112);
      await page.evaluate(() => ParisModule.showMessage('info', 'Datos ficticios · Vista previa U015'));
      await page.mouse.move(1438, 898); await screenshot('productos-u015-desktop.png');
      await page.locator('#module-category').click(); await screenshot('productos-u015-categorias.png'); await page.keyboard.press('Escape');
      for (const width of [760, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('.workspace-mobile-header').count(), 0); assert.equal(await page.locator('[data-sidebar-open]').count(), 1);
        assert.equal((await page.locator('.module-header').boundingBox()).y, 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Ancho ' + width);
        await page.locator('[data-sidebar-open]').click(); assert.equal(await page.locator('#paris-workspace').evaluate(el => el.inert), true);
        await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-sidebar-open]').evaluate(el => el === document.activeElement), true);
        if (width === 390) { await page.locator('[data-sidebar-open]').blur(); await screenshot('productos-u015-mobile.png'); }
      }
      await page.goto(app.base + '/perfil');
      assert.equal(await page.locator('.workspace-mobile-header').count(), 0); await page.locator('[data-sidebar-open]').click(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-sidebar-open]').evaluate(el => el === document.activeElement), true);
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
