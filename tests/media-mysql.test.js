/** Integración de fotos y códigos con compras y existencias reales en una base temporal. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./support/inventory-mysql-fixture'), { body } = require('./support/purchase-fixture');
const jpeg = require('../src/vendor/jpeg-js');
test('U031: fotos transaccionales, códigos exactos y migración reanudable en MySQL', { skip: process.env.PARIS_MYSQL_TEST !== '1', timeout: 120000 }, async t => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), products = new (require('../src/services/ProductService'))(repo);
  const purchases = new (require('../src/services/PurchaseService'))(new (require('../src/repositories/PurchaseRepository'))(db.pool));
  const key = () => crypto.randomUUID(), image = 'data:image/jpeg;base64,' + jpeg.encode({ width: 16, height: 16, data: Buffer.alloc(1024, 180) }, 80).data.toString('base64');
  let saved, product;
  try {
    await t.test('migración: repetición, registro interrumpido, estructura ajena y cuenta limitada', async () => {
      const Setup = require('../scripts/setup-media'); await new Setup(db.owner).run(); await new Setup(db.pool).run({ check: true });
      await db.owner.query("DELETE FROM app_migration WHERE id='U031'"); await assert.rejects(new Setup(db.owner).run({ check: true }), /pendiente/); await new Setup(db.owner).run();
      await db.owner.query('ALTER TABLE producto_imagen ADD COLUMN extra INT'); await assert.rejects(new Setup(db.owner).run(), /otra estructura/); await db.owner.query('ALTER TABLE producto_imagen DROP COLUMN extra');
      await new Setup(db.owner).run(); await assert.rejects(db.pool.query('ALTER TABLE producto_imagen ADD COLUMN no_permitida INT'), e => e.code === 'ER_TABLEACCESS_DENIED_ERROR');
    });
    await t.test('compra y foto se guardan juntas una vez, incluso al perderse la respuesta', async () => {
      const data = body(); data.lines[0].product.photo = image; data.lines[0].presentation.barcode = '0012345678905'; const operation = key();
      const [a, b] = await Promise.all([purchases.create(1, operation, data), purchases.create(1, operation, data)]); assert.deepEqual(a, b); saved = a;
      product = (await products.list({})).records[0]; assert.match(product.photoHash, /^[a-f0-9]{64}$/);
      assert.equal((await products.photo(product.id)).bytes.length > 100, true);
      assert.equal((await products.detail(product.id)).stock, '12.000');
      const [[count]] = await db.owner.query('SELECT COUNT(*) AS n FROM producto_imagen'); assert.equal(count.n, 1);
      const match = await products.barcode('0012345678905'); assert.equal(match.product.id, product.id); assert.equal(match.presentation.factor, '6.000');
      assert.deepEqual(await products.barcode('12345678905'), { found: false });
      assert.equal((await products.barcode('012345678905')).product.id, product.id);
      await assert.rejects(products.savePresentation(1, key(), product.id, null, { name: 'OTRA CAJA', factor: '12', barcode: '012345678905', price: '100', state: 'ACTIVO' }), e => e.status === 409);
      await products.savePresentation(1, key(), product.id, null, { name: 'UNIDAD', factor: '1', barcode: 'UNIT-01', price: '12', state: 'ACTIVO' });
      assert.equal((await products.barcode('UNIT-01')).presentation.factor, '1.000');
    });
    await t.test('historial ordena numéricamente movimientos simultáneos y respeta ambas direcciones', async () => {
      const Inventory = require('../src/services/InventoryService'), Stock = require('../src/repositories/InventoryRepository');
      const stockRepo = new Stock(db.pool), inventory = new Inventory(stockRepo);
      const insert = stockRepo.movements.insert.bind(stockRepo.movements);
      stockRepo.movements.insert = async (c, row) => { await c.query("SET timestamp=UNIX_TIMESTAMP('2026-09-13 12:00:00')"); try { return await insert(c, row); } finally { await c.query('SET timestamp=0'); } };
      for (let i = 0; i < 12; i++) {
        const row = (await inventory.lots(product.id, {})).records[0];
        await inventory.count(1, key(), { stockId: row.id, version: row.version, quantity: i % 2 === 0 ? '13' : '12', reason: 'VERIFICAR ORDEN' });
      }
      // Se fijó el reloj de inserción de la conexión de prueba; el historial permanece inmutable.
      for (const direction of ['asc','desc']) {
        const rows = (await stockRepo.movements.list({ productId: product.id, type: 'CONTEO', direction, term: '', page: 1, pageSize: 50 })).records;
        const ids = rows.map(r => Number(r.id.slice(2)));
        assert.equal(ids.length, 12); assert.deepEqual(ids, [...ids].sort((a,b) => direction === 'asc' ? a-b : b-a));
      }
      assert.equal((await products.detail(product.id)).stock, '12.000');
    });
    await t.test('un fallo tardío revierte también la foto, los registros y la compra', async () => {
      const data = body(); data.supplier.name = 'PROVEEDOR FALLIDO'; data.lines[0].product.name = 'PRODUCTO FALLIDO'; data.lines[0].product.photo = image; data.lines[0].presentation.barcode = 'ROLLBACK-ONE';
      const last = structuredClone(data.lines[0]); last.product.clientKey = key(); last.product.name = 'SEGUNDO FALLIDO'; last.presentation.barcode = '0012345678905'; data.lines.push(last);
      await assert.rejects(purchases.create(1, key(), data), e => e.status === 409);
      for (const table of ['compra', 'producto_imagen']) { const [[count]] = await db.owner.query('SELECT COUNT(*) AS n FROM ' + table); assert.equal(count.n, 1); }
      assert.equal((await products.list({ term: 'FALLIDO' })).total, 0); assert.equal((await products.detail(product.id)).stock, '12.000'); assert.equal((await purchases.detail(saved.id)).lines.length, 1);
    });
    await t.test('editar conserva la foto si no se cambia, quitarla invalida la versión y no modifica stock', async () => {
      let row = await products.detail(product.id), fields = { name: row.name, categoryId: row.categoryId, unitId: row.unitId, description: row.description || '', minimum: row.minimum, state: row.state };
      await products.update(1, key(), row.id, { ...fields, description: 'EDITADA', version: row.version }); const next = await products.detail(row.id); assert.equal(next.photoHash, row.photoHash);
      await products.update(1, key(), next.id, { ...fields, description: 'EDITADA', photo: null, version: next.version }); const removed = await products.detail(row.id); assert.equal(removed.photoHash, null); assert.notEqual(removed.version, next.version);
      await assert.rejects(products.update(1, key(), row.id, { ...fields, photo: image, version: next.version }), e => e.status === 409); assert.equal(removed.stock, '12.000'); await assert.rejects(products.photo(row.id), e => e.status === 404);
      await products.state(1, key(), removed.id, { state: 'INACTIVO', version: removed.version }); await assert.rejects(products.barcode('0012345678905'), e => e.status === 409);
    });
    await t.test('UPC/EAN simultáneos no duplican códigos; una ambigüedad antigua se bloquea', async () => {
      const fields = { categoryId: 1, unitId: 1, description: '', minimum: '0', state: 'ACTIVO' };
      const a = await products.create(1, key(), { ...fields, name: 'CODIGO A' }), b = await products.create(1, key(), { ...fields, name: 'CODIGO B' });
      const base = { name: 'UNIDAD', factor: '1', price: '1', state: 'ACTIVO' }, codes = ['036000291452','0036000291452'];
      const results = await Promise.allSettled([products.savePresentation(1, key(), a.id, null, { ...base, barcode: codes[0] }), products.savePresentation(1, key(), b.id, null, { ...base, barcode: codes[1] })]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length, 1); assert.equal(results.find(r=>r.status==='rejected').reason.status, 409);
      const loser = results.findIndex(r=>r.status==='rejected');
      await assert.rejects(products.savePresentation(1, key(), [a,b][loser].id, null, { ...base, barcode: codes[loser] }), e => e.status === 409);
      // Simula datos históricos importados, sin quitar protecciones de la base.
      await db.owner.query('INSERT INTO presentacion_producto(id_producto,nombre_presentacion,factor_conversion,codigo_barras,precio_venta,estado) VALUES(?,?,?,?,?,?)', [[a,b][loser].id, 'LEGADO', '1', codes[loser], '1', 'ACTIVO']);
      await assert.rejects(products.barcode(codes[0]), e => e.status === 409 && /dos formas/.test(e.message));
    });
  } finally { await db.close(); }
});
