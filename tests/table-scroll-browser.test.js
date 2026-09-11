/** U014: verifica scroll continuo, numeración y prioridades con registros ficticios; no usa MySQL. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { server, password } = require('./support/application-fixture');
test('U014: DataTable continua y adaptable', { skip: process.env.PARIS_UI_BROWSER_TESTS !== '1', timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PARIS_PLAYWRIGHT_PATH || 'playwright');
  const app = await server();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PARIS_BROWSER_EXECUTABLE || undefined, args: JSON.parse(process.env.PARIS_BROWSER_ARGS || '[]') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(6000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(app.base + '/login'); await page.locator('[name=nombre_usuario]').fill('audit_user'); await page.locator('[name=contrasena]').fill(password);
    await page.locator('[data-login-submit]').click(); await page.waitForURL('**/inicio');
    await t.test('scroll carga todos los registros una vez y mantiene cabecera fija y numeración independiente', async () => {
      await page.evaluate(async () => {
        const UI = window.ParisUI;
        const host = document.createElement('div'); host.id = 'scroll-test'; host.style.cssText = 'height:260px;flex:0 0 260px;width:100%;display:flex;flex-direction:column'; document.querySelector('.module-content-area').replaceChildren(host);
        window.scrollCalls = [];
        window.scrollTable = new UI.DataTable({ container: host, mode: 'scroll', numbered: true, pageSize: 10,
          columns: [{ key: 'name', label: 'Producto', sortable: true }, { key: 'stock', label: 'Stock', type: 'quantity', priority: 1 }],
          load: async ({ page, pageSize }) => {
            scrollCalls.push(page); await new Promise(r => setTimeout(r, 40));
            return { records: Array.from({ length: Math.min(pageSize, 23 - (page - 1) * pageSize) }, (_, i) => ({ id: 500 + (page - 1) * pageSize + i, name: 'Producto ' + ((page - 1) * pageSize + i + 1), stock: i })), total: 23 };
          }
        }); await scrollTable.ready;
      });
      assert.equal(await page.locator('#scroll-test .app-table-sequence').nth(1).textContent(), '1');
      assert.equal(await page.locator('#scroll-test .app-table-sort span').count(), 0);
      for (const expected of [20, 23]) {
        await page.evaluate(() => { const s = scrollTable.scroll; s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')); s.dispatchEvent(new Event('scroll')); });
        await page.waitForFunction(n => scrollTable.rows.length === n, expected);
      }
      assert.deepEqual(await page.evaluate(() => scrollCalls), [1, 2, 3]);
      assert.equal(await page.locator('#scroll-test tbody tr[data-row-index]').count(), 23);
      assert.equal(await page.locator('#scroll-test .app-table-sequence').last().textContent(), '23');
      assert.equal(await page.locator('#scroll-test [data-table-more]').isVisible(), false);
      assert.equal(await page.locator('#scroll-test .app-table-pagination').count(), 0);
      const rect = await page.evaluate(() => ({ table: scrollTable.scroll.getBoundingClientRect().top, head: scrollTable.table.querySelector('th').getBoundingClientRect().top }));
      assert.ok(Math.abs(rect.table - rect.head) <= 2);
    });
    await t.test('errores al continuar conservan filas y foco; reintento no duplica ni omite registros', async () => {
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.querySelector('#scroll-test'); scrollTable.destroy();
        let fault = 'network', calls = 0;
        const rows = Array.from({ length: 13 }, (_, i) => ({ id: i + 70, name: 'Fila ' + i }));
        const table = window.scrollTable = new UI.DataTable({ container: host, columns: [{ key: 'name', label: 'Nombre' }], mode: 'scroll', numbered: true, pageSize: 10,
          load: async ({ page }) => {
            calls++; if (page === 2 && fault === 'network') throw new Error('Fallo simulado');
            const records = rows.slice((page - 1) * 10, page * 10);
            if (page === 2 && fault === 'duplicate') records[0] = rows[0];
            if (page === 2 && fault === 'partial') records.pop();
            return { records, total: fault === 'changed' && page === 2 ? 14 : rows.length };
          }
        });
        await table.ready; const outcomes = [];
        for (const kind of ['network', 'duplicate', 'partial', 'changed']) {
          fault = kind; await table.loadMore({ retry: true });
          const oldCalls = calls; await table.loadMore();
          outcomes.push(table.rows.length === 10 && table.page === 1 && table.appendError && !table.continuation.hidden && calls === oldCalls);
        }
        fault = ''; await table.loadMore({ retry: true });
        return { outcomes, count: table.rows.length, ids: new Set(table.rows.map(row => row.id)).size, last: table.body.querySelector('tr[data-row-index="12"] .app-table-sequence').textContent, hiddenError: table.continuation.hidden };
      });
      assert.deepEqual(result, { outcomes: [true, true, true, true], count: 13, ids: 13, last: '13', hiddenError: true });
    });
    await t.test('una búsqueda nueva o destroy descarta respuestas antiguas y conserva el número de escuchas', async () => {
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.querySelector('#scroll-test'); scrollTable.destroy();
        let pending, signal, actions = 0;
        const oldRows = Array.from({ length: 20 }, (_, i) => ({ id: i + 80, name: 'ANTIGUO' }));
        const table = window.scrollTable = new UI.DataTable({ container: host, columns: [{ key: 'name', label: 'Nombre' }], mode: 'scroll', pageSize: 10,
          actions: [{ id: 'edit', label: 'Editar' }], onAction: () => actions++,
          load: ({ page, query, signal: requestSignal }) => {
            if (query.term) return Promise.resolve({ records: [{ id: 8, name: 'NUEVO' }], total: 1 });
            if (page === 2) { signal = requestSignal; return new Promise(r => { pending = r; }); }
            return Promise.resolve({ records: oldRows.slice(0, 10), total: 20 });
          }
        });
        await table.ready; const next = table.loadMore(); await table.setQuery({ term: 'NUEVO' });
        pending({ records: oldRows.slice(10), total: 20 }); await next;
        const latest = table.rows.length === 1 && table.rows[0].name === 'NUEVO' && signal.aborted;
        table.destroy();
        const local = new UI.DataTable({ container: host, mode: 'scroll', columns: [{ key: 'name', label: 'Nombre' }], records: [{ id: 9, name: 'Local' }],
          actions: [{ id: 'edit', label: 'Editar' }], onAction: () => actions++ });
        await local.ready; host.querySelector('[data-table-action]').click(); await Promise.resolve(); local.destroy();
        const disposed = new UI.DataTable({ container: host, columns: [{ key: 'name', label: 'Nombre' }], mode: 'scroll', load: ({ signal: s }) => { signal = s; return new Promise(r => { pending = r; }); } });
        disposed.destroy(); pending({ records: [{ id: 10, name: 'TARDE' }], total: 1 }); await disposed.ready;
        return { latest, actions, aborted: signal.aborted, empty: host.childNodes.length === 0 };
      });
      assert.deepEqual(result, { latest: true, actions: 1, aborted: true, empty: true });
    });
    await t.test('prioridades conservan cada valor en Ver más y numeración cambia con el orden, sin usar el ID', async () => {
      await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.querySelector('#scroll-test'); host.style.width = '300px';
        const table = window.scrollTable = new UI.DataTable({ container: host, mode: 'scroll', numbered: true,
          columns: [{ key: 'name', label: 'Producto', sortable: true }, { key: 'stock', label: 'Stock', priority: 1, type: 'quantity' },
            { key: 'category', label: 'Categoría', priority: 2 }, { key: 'unit', label: 'Unidad', priority: 3 }],
          records: [{ id: 900, name: 'B', stock: 8, category: '<img src=x onerror=alert(1)>', unit: 'Unidad' }, { id: 10, name: 'A', stock: 6, category: 'Otros', unit: 'Gramo' }]
        }); await table.ready;
      });
      const button = page.locator('#scroll-test [data-table-details="0"]'); await button.waitFor(); await button.focus(); await button.press('Enter');
      const detail = page.locator('#scroll-test tr[data-details-index="0"]');
      assert.equal(await detail.isVisible(), true); assert.ok((await detail.textContent()).includes('<img src=x onerror=alert(1)>')); assert.equal(await detail.locator('img').count(), 0);
      assert.equal(await page.locator('#scroll-test th[data-column-key=stock]').isVisible(), false);
      await page.evaluate(() => { document.querySelector('#scroll-test').style.width = '1200px'; });
      await page.waitForFunction(() => !scrollTable.table.querySelector('th[data-column-key="unit"]').hidden);
      assert.equal(await detail.isVisible(), false);
      assert.equal(await page.locator('#scroll-test [data-table-details="0"]').isVisible(), false);
      await page.evaluate(async () => { await scrollTable.setSort({ key: 'name', direction: 'asc' }); });
      assert.equal(await page.locator('#scroll-test tbody tr[data-row-index="0"] [data-column-key=name]').textContent(), 'AVer más');
      assert.equal(await page.locator('#scroll-test tbody tr[data-row-index="0"] .app-table-sequence').textContent(), '1');
      assert.equal(await page.evaluate(() => scrollTable.rows[0].id), 10);
      await page.evaluate(() => { scrollTable.destroy(); document.querySelector('#scroll-test').remove(); });
    });
    await t.test('Productos contiene el scroll, carga hasta el final y devuelve el foco al agotar la lista', async () => {
      const queries = [];
      await page.route('**/api/productos**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/opciones/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ options: [], total: 0 }) });
        const number = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('pageSize'));
        queries.push(number);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: Array.from({ length: Math.min(size, 113 - (number - 1) * size) }, (_, i) => ({ id: 800 + (number - 1) * size + i, name: 'Registro ' + i, category: 'Otros', unit: 'Unidad', stock: 10, minimum: 1, state: 'ACTIVO' })), total: 113 }) });
      });
      await page.goto(app.base + '/productos'); await page.getByText('Mostrando 1–50 de 113 registros', { exact: true }).waitFor();
      await page.locator('#products-table .app-table-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.getByText('Mostrando 1–100 de 113 registros', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cargar más', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByText('Mostrando 1–113 de 113 registros', { exact: true }).waitFor();
      assert.deepEqual(queries, [1, 2, 3]);
      assert.equal(await page.locator('#products-table .app-table-scroll').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#products-table tbody tr[data-row-index]').count(), 113);
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
      assert.equal(await page.locator('#products-table .app-table-scroll').evaluate(el => el.scrollHeight > el.clientHeight), true);
    });
    await t.test('la modalidad paginada conserva numeración consecutiva en cada página', async () => {
      const result = await page.evaluate(async () => {
        const UI = window.ParisUI, host = document.createElement('div'); document.body.append(host);
        const table = new UI.DataTable({ container: host, numbered: true, columns: [{ key: 'name', label: 'Nombre' }], pageSize: 5,
          records: Array.from({ length: 12 }, (_, i) => ({ id: 50 - i, name: 'Registro ' + i })) });
        await table.ready; table.page = 2; await table.refresh();
        const numbers = Array.from(host.querySelectorAll('tbody .app-table-sequence'), el => el.textContent);
        table.destroy(); host.remove(); return numbers;
      });
      assert.deepEqual(result, ['6', '7', '8', '9', '10']); assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await app.close(); }
});
