/** Producto, foto y primera presentación: atomicidad y reintentos sobre MySQL temporal. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./support/inventory-mysql-fixture'), { image } = require('./support/media-fixture');
test('U034: alta completa sin duplicados ni existencias inventadas', { skip: process.env.PARIS_MYSQL_TEST !== '1', timeout: 60000 }, async () => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), service = new (require('../src/services/ProductService'))(repo);
  const data = { name: 'PRODUCTO ESCANEADO', categoryId: 1, unitId: 1, minimum: '0', description: '', state: 'ACTIVO', photo: 'data:image/jpeg;base64,' + image().toString('base64'),
    initialPresentation: { name: 'PAQUETE DE 6', factor: '6', price: '25.50', barcode: '0036000291452' } };
  try {
    const key = crypto.randomUUID(), [a, b] = await Promise.all([service.create(1, key, data), service.create(1, key, data)]);
    assert.deepEqual(a, b); assert.ok(a.presentationId);
    const found = await service.barcode('036000291452'); assert.equal(found.product.id, a.id); assert.equal(found.presentation.factor, '6.000'); assert.equal(found.product.stock, '0.000'); assert.ok(found.product.photoHash);
    await assert.rejects(service.create(1, crypto.randomUUID(), { ...data, name: 'NO DEBE QUEDAR', initialPresentation: { ...data.initialPresentation, barcode: '036000291452' } }), e => e.status === 409);
    const [[counts]] = await db.owner.query('SELECT (SELECT COUNT(*) FROM producto) AS products,(SELECT COUNT(*) FROM producto_imagen) AS photos,(SELECT COUNT(*) FROM presentacion_producto) AS presentations');
    assert.deepEqual(counts, { products: 1, photos: 1, presentations: 1 });
    const code = '0012345678905', results = await Promise.allSettled([1, 2].map(i => service.create(1, crypto.randomUUID(), { ...data, name: 'CONCURRENTE ' + i, initialPresentation: { ...data.initialPresentation, barcode: code } })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await service.list({ term: 'CONCURRENTE' })).total, 1);
  } finally { await db.close(); }
});
