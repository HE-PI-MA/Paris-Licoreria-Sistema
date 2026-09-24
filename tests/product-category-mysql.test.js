/** U036/U044: categorías pertenecen a Productos; Compras utiliza productos ya registrados. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./support/inventory-mysql-fixture');

test('U036/U044: alta y reutilización de categorías permanecen en Productos', {
  skip: process.env.PARIS_MYSQL_TEST !== '1',
  timeout: 60000
}, async () => {
  const db = await database();
  const repo = new (require('../src/repositories/ProductRepository'))(db.pool);
  const service = new (require('../src/services/ProductService'))(repo);
  const base = {
    name: 'AGUA FICTICIA 2 LITROS',
    categoryName: '  aguas  ',
    unitId: '1',
    minimum: '0',
    description: '',
    state: 'ACTIVO'
  };
  const count = async name => (await db.owner.query(
    'SELECT COUNT(*) AS n FROM categoria WHERE nombre=?', [name]
  ))[0][0].n;

  try {
    const key = crypto.randomUUID();
    const a = await service.create(1, key, base);
    const b = await service.create(1, key, base);
    assert.deepEqual(a, b);
    assert.equal(await count('AGUAS'), 1);

    const saved = await service.detail(a.id);
    assert.equal(saved.category, 'AGUAS');
    assert.equal(saved.stock, '0.000');

    const second = await service.create(1, crypto.randomUUID(), {
      ...base, name: 'OTRA AGUA', categoryName: 'AGUAS'
    });
    assert.equal((await service.detail(second.id)).categoryId, saved.categoryId);
    assert.equal(await count('AGUAS'), 1);

    await assert.rejects(
      service.create(1, crypto.randomUUID(), {
        ...base,
        categoryName: 'NO QUEDA SIN UNIDAD',
        unitId: '4294967295'
      }),
      e => e.status === 422
    );
    assert.equal(await count('NO QUEDA SIN UNIDAD'), 0);

    const first = { name: 'BOTELLA', factor: '1', price: '8', barcode: 'U036-CODIGO' };
    await service.create(1, crypto.randomUUID(), {
      ...base, name: 'CON CÓDIGO', initialPresentation: first
    });
    const before = (await service.list({})).total;
    await assert.rejects(
      service.create(1, crypto.randomUUID(), {
        ...base, categoryName: 'NO QUEDA CON ERROR', initialPresentation: first
      }),
      e => e.status === 409
    );
    assert.equal(await count('NO QUEDA CON ERROR'), 0);
    assert.equal((await service.list({})).total, before);

    await db.owner.query("INSERT INTO categoria(nombre,estado) VALUES('CATEGORÍA INACTIVA','INACTIVO')");
    await assert.rejects(
      service.create(1, crypto.randomUUID(), {
        ...base, categoryName: 'categoría inactiva'
      }),
      e => e.status === 422 && /inactiva/i.test(e.message)
    );
    assert.equal(await count('CATEGORÍA INACTIVA'), 1);

    const jobs = [1, 2].map(i => ({
      key: crypto.randomUUID(),
      data: { ...base, name: 'CONCURRENTE ' + i, categoryName: 'AGUAS CONCURRENTES' }
    }));
    const results = await Promise.allSettled(jobs.map(job => service.create(1, job.key, job.data)));
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        assert.equal(result.reason.status, 409);
        await service.create(1, jobs[i].key, jobs[i].data);
      }
    }
    assert.equal(await count('AGUAS CONCURRENTES'), 1);
    assert.equal((await service.list({ term: 'CONCURRENTE' })).total, 2);
  } finally {
    await db.close();
  }
});
