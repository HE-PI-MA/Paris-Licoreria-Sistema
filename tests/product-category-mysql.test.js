/** U036: alta/reutilización de categorías con MySQL real, mínimo privilegio y base aleatoria. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./support/inventory-mysql-fixture'), { body } = require('./support/purchase-fixture');
test('U036: categoría y producto se confirman juntos y comparten catálogo con Compras', { skip: process.env.PARIS_MYSQL_TEST !== '1', timeout: 60000 }, async () => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), service = new (require('../src/services/ProductService'))(repo);
  const base = { name: 'AGUA FICTICIA 2 LITROS', categoryName: '  aguas  ', unitId: '1', minimum: '0', description: '', state: 'ACTIVO' };
  const count = async name => (await db.owner.query('SELECT COUNT(*) AS n FROM categoria WHERE nombre=?', [name]))[0][0].n;
  try {
    const key = crypto.randomUUID(), a = await service.create(1, key, base), b = await service.create(1, key, base);
    assert.deepEqual(a, b); assert.equal(await count('AGUAS'), 1); const saved = await service.detail(a.id); assert.equal(saved.category, 'AGUAS'); assert.equal(saved.stock, '0.000');
    const second = await service.create(1, crypto.randomUUID(), { ...base, name: 'OTRA AGUA', categoryName: 'AGUAS' });
    assert.equal((await service.detail(second.id)).categoryId, saved.categoryId); assert.equal(await count('AGUAS'), 1);
    const purchase = body(); delete purchase.lines[0].product.categoryId; purchase.lines[0].product.categoryName = 'aguas'; purchase.lines[0].product.name = 'AGUA DE COMPRA';
    await new (require('../src/services/PurchaseService'))(new (require('../src/repositories/PurchaseRepository'))(db.pool)).create(1, crypto.randomUUID(), purchase);
    assert.equal(await count('AGUAS'), 1); assert.equal((await service.list({ term: 'AGUA DE COMPRA' })).records[0].categoryId, saved.categoryId);
    await assert.rejects(service.create(1, crypto.randomUUID(), { ...base, categoryName: 'NO QUEDA SIN UNIDAD', unitId: '4294967295' }), e => e.status === 422);
    assert.equal(await count('NO QUEDA SIN UNIDAD'), 0);
    const first = { name: 'BOTELLA', factor: '1', price: '8', barcode: 'U036-CODIGO' };
    await service.create(1, crypto.randomUUID(), { ...base, name: 'CON CÓDIGO', initialPresentation: first });
    const before = (await service.list({})).total;
    await assert.rejects(service.create(1, crypto.randomUUID(), { ...base, categoryName: 'NO QUEDA CON ERROR', initialPresentation: first }), e => e.status === 409);
    assert.equal(await count('NO QUEDA CON ERROR'), 0); assert.equal((await service.list({})).total, before);
    await db.owner.query("INSERT INTO categoria(nombre,estado) VALUES('CATEGORÍA INACTIVA','INACTIVO')");
    await assert.rejects(service.create(1, crypto.randomUUID(), { ...base, categoryName: 'categoría inactiva' }), e => e.status === 422 && /inactiva/i.test(e.message));
    assert.equal(await count('CATEGORÍA INACTIVA'), 1);
    const jobs = [1, 2].map(i => ({ key: crypto.randomUUID(), data: { ...base, name: 'CONCURRENTE ' + i, categoryName: 'AGUAS CONCURRENTES' } }));
    const results = await Promise.allSettled(jobs.map(job => service.create(1, job.key, job.data)));
    for (const [i, result] of results.entries()) if (result.status === 'rejected') { assert.equal(result.reason.status, 409); await service.create(1, jobs[i].key, jobs[i].data); }
    assert.equal(await count('AGUAS CONCURRENTES'), 1); assert.equal((await service.list({ term: 'CONCURRENTE' })).total, 2);
  } finally { await db.close(); }
});
