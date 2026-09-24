/** U036/U044: las categorías se administran en Productos; Compras ya no crea catálogos. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { ProductInput } = require('../src/domain/ProductInput');
const PurchaseInput = require('../src/domain/PurchaseInput');
const ProductService = require('../src/services/ProductService');

const product = {
  name: 'AGUA FICTICIA 2 LITROS',
  categoryName: '  aguas   de mesa  ',
  unitId: '1',
  description: '',
  minimum: '0',
  state: 'ACTIVO'
};

test('U036/U049: categoría por nombre se normaliza en Productos y Compra no expone el alta completa de catálogo', () => {
  const a = ProductInput.product(product);
  assert.equal(a.categoryName, 'AGUAS DE MESA');
  assert.equal(a.categoryId, undefined);
  assert.equal(typeof PurchaseInput.newProduct, 'undefined');

  const { categoryName, ...rest } = product;
  assert.equal(ProductInput.product({ ...rest, categoryId: '1' }).categoryId, 1);

  for (const categoryName of ['', '   ', 'x'.repeat(81), 'A\u0000B', {}, null]) {
    assert.throws(() => ProductInput.product({ ...product, categoryName }));
  }
  assert.throws(() => ProductInput.product({ ...product, categoryId: '1' }));
  assert.throws(() => ProductInput.product({ ...product, version: 'a'.repeat(64) }, true));
});

test('U036: reutiliza categorías activas y rechaza las inactivas sin reactivarlas', async () => {
  let inserts = 0;
  const repo = {
    namedCategory: async () => ({ id: 7, state: 'ACTIVO' }),
    insertCategory: async () => { inserts++; return 8; }
  };
  const service = new ProductService(repo);

  assert.equal(await service.category({}, { categoryName: 'AGUAS' }), 7);
  assert.equal(inserts, 0);

  repo.namedCategory = async () => ({ id: 7, state: 'INACTIVO' });
  await assert.rejects(
    service.category({}, { categoryName: 'AGUAS' }),
    e => e.status === 422 && Boolean(e.fieldErrors.categoryIdText)
  );
  assert.equal(inserts, 0);

  repo.namedCategory = async () => undefined;
  assert.equal(await service.category({}, { categoryName: 'AGUAS' }), 8);
  assert.equal(inserts, 1);
});
