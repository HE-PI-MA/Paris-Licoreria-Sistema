/** U016: tamaños automáticos, marca sin enlace y foco al cambiar de pantalla. Usa servidor y productos ficticios. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { server, password } = require('./support/application-fixture');
test('U016: sidebar automático en navegador', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('paris.sidebar.collapsed', 'true'));
  await page.route('**/api/productos**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().includes('/opciones/') ? { options: [{value:'1',label:'Bebidas alcohólicas'}], total: 1 } : {
    records: ['Bebida de demostración', 'Producto de ejemplo', 'Presentación de prueba'].map((name, i) => ({id: 30+i, name, category: 'Bebidas alcohólicas', unit: 'Unidad', presentations:2, stock:30, minimum:5, state:'ACTIVO'})), total: 3
  }) }));
  const viewport = async width => {
    await page.setViewportSize({ width, height: 900 });
    // matchMedia entrega sus eventos en el siguiente ciclo de renderizado.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const screenshot = async name => { if (process.env.PARIS_UI_SCREENSHOTS) { fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.PARIS_UI_SCREENSHOTS, name) }); } };
  try {
    await page.goto(app.base+'/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password); await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await page.goto(app.base+'/productos'); await page.locator('#products-table tr[data-row-index="0"]').waitFor();
    await t.test('marca centrada sin navegación ni botón antiguo; se ignora la preferencia almacenada', async () => {
      assert.equal(await page.locator('[data-sidebar-toggle]').count(), 0);
      assert.equal(await page.locator('script[src*="sidebar-preference"]').count(), 0);
      const logo = page.getByRole('img', { name: 'París Licorería', exact: true }); const before = page.url(); await logo.click(); assert.equal(page.url(), before);
      assert.equal(await logo.evaluate(el => el.tagName), 'DIV');
      const geometry = await page.evaluate(() => {
        const side=document.querySelector('.paris-sidebar').getBoundingClientRect(), image=document.querySelector('.sidebar-logo-full img').getBoundingClientRect();
        return { width:side.width, centered:Math.abs((side.left+side.right)/2-(image.left+image.right)/2), height:document.querySelector('.sidebar-header').getBoundingClientRect().height };
      });
      assert.equal(geometry.width,224); assert.equal(geometry.height,84); assert.ok(geometry.centered <= 1);
      await page.getByRole('link', {name:'Inicio',exact:true}).click(); await page.waitForURL('**/inicio');
      await page.goto(app.base+'/productos');
    });
    await t.test('límites exactos y cambio repetido entre completo, iconos y móvil sin desbordamiento', async () => {
      for (const width of [1440,1200,1201,1000,769,768,390,320,1440]) {
        await viewport(width);
        const result = await page.evaluate(() => ({ side:document.querySelector('.paris-sidebar').getBoundingClientRect().width, margin:getComputedStyle(document.querySelector('.paris-workspace')).marginLeft, overflow:document.documentElement.scrollWidth > innerWidth, inert:document.querySelector('.paris-sidebar').inert }));
        assert.equal(result.overflow,false,'ancho '+width);
        if(width>1200){assert.equal(result.side,224);assert.equal(result.margin,'224px');assert.equal(await page.locator('.sidebar-logo-full').isVisible(),true);}
        else if(width>768){assert.equal(result.side,88);assert.equal(result.margin,'88px');assert.equal(await page.locator('.sidebar-logo-symbol').isVisible(),true);assert.equal(await page.locator('.sidebar-logo-full').isVisible(),false);}
        else {assert.equal(result.margin,'0px');assert.equal(result.inert,true);assert.equal(await page.locator('.paris-sidebar').isVisible(),false);}
        assert.equal(await page.locator('[data-sidebar-open]').isVisible(),width<=768);
        assert.equal(await page.locator('[data-sidebar-close]').isVisible(),false);
      }
    });
    await t.test('iconos mantienen nombres, ayudas, perfil por teclado y foco al redimensionar', async () => {
      await viewport(1000); const link=page.getByRole('link',{name:'Productos',exact:true}); await link.focus();
      await page.locator('#sidebar-tooltip').waitFor(); assert.equal(await page.locator('#sidebar-tooltip').textContent(),'Productos');
      await page.locator('#profile-trigger').focus(); await page.keyboard.press('ArrowDown'); await page.getByRole('menuitem',{name:'Mi perfil',exact:true}).waitFor();
      await viewport(1440); assert.equal(await page.locator('#profile-menu').isVisible(),false); assert.equal(await page.locator('#profile-trigger').evaluate(el=>el===document.activeElement),true);
      await link.focus(); await viewport(390); assert.equal(await page.locator('[data-sidebar-open]').evaluate(el=>el===document.activeElement),true);
      await page.locator('[data-sidebar-open]').click(); assert.equal(await link.evaluate(el=>el===document.activeElement),true);
      await page.locator('[data-sidebar-close]').focus(); await viewport(1000);
      assert.equal(await page.locator('#paris-workspace').evaluate(el=>el.inert),false); assert.equal(await link.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('[data-sidebar-backdrop]').isVisible(),false);
    });
    await t.test('móvil: cierre táctil, fondo, Escape, trampa de Tab y retorno a la hamburguesa', async () => {
      await viewport(390); const opener=page.locator('[data-sidebar-open]'),close=page.locator('[data-sidebar-close]');
      await opener.click(); assert.equal(await page.locator('.paris-sidebar').getAttribute('aria-modal'),'true'); assert.equal(await page.locator('#paris-workspace').evaluate(el=>el.inert),true);
      await page.locator('#profile-trigger').focus(); await page.keyboard.press('Tab'); assert.equal(await close.evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.locator('#profile-trigger').evaluate(el=>el===document.activeElement),true);
      await close.click(); assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
      await opener.click(); await page.mouse.click(385,450); assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
      await opener.click(); await page.keyboard.press('Escape'); assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('.paris-sidebar').getAttribute('aria-modal'),null);
      await page.evaluate(()=>ParisModule.showMessage('info','Datos ficticios · Vista previa U016'));
      await opener.blur(); await screenshot('sidebar-u016-mobile.png'); await opener.click(); await screenshot('sidebar-u016-mobile-open.png'); await page.keyboard.press('Escape');
      await viewport(1000); await screenshot('sidebar-u016-icons.png'); await viewport(1440); await screenshot('sidebar-u016-expanded.png');
      assert.deepEqual(errors,[]);
    });
    await t.test('CSS elige el ancho inicial incluso sin ejecutar JavaScript', async () => {
      const plainBrowser=await chromium.launch({ headless:true, executablePath:process.env.PARIS_BROWSER_EXECUTABLE || undefined, args:JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
      const plain=await plainBrowser.newContext({ javaScriptEnabled:false, viewport:{width:1000,height:900}, reducedMotion:'reduce' });
      try { await plain.addCookies(await page.context().cookies()); const quiet=await plain.newPage(); await quiet.goto(app.base+'/inicio');
        assert.equal((await quiet.locator('.paris-sidebar').boundingBox()).width,88); assert.equal(await quiet.locator('.sidebar-logo-symbol').isVisible(),true);
        await quiet.setViewportSize({width:1440,height:900}); assert.equal((await quiet.locator('.paris-sidebar').boundingBox()).width,224);
      } finally { await plainBrowser.close(); }
    });
  } finally { await browser.close(); await app.close(); }
});
