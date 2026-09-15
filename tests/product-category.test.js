/** Categorías U036: contrato común de Productos/Compras y errores antes de escribir. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { ProductInput } = require('../src/domain/ProductInput'), PurchaseInput = require('../src/domain/PurchaseInput'), ProductService = require('../src/services/ProductService');
const product = { name: 'AGUA FICTICIA 2 LITROS', categoryName: '  aguas   de mesa  ', unitId: '1', description: '', minimum: '0', state: 'ACTIVO' };
test('U036: categoría por nombre comparte normalización, límites y contrato por ID con Compras', () => {
  const a = ProductInput.product(product), b = PurchaseInput.newProduct({ ...product, clientKey: crypto.randomUUID() });
  assert.equal(a.categoryName, 'AGUAS DE MESA'); assert.equal(b.categoryName, a.categoryName); assert.equal(a.categoryId, undefined);
  const { categoryName, ...rest } = product;
  assert.equal(ProductInput.product({ ...rest, categoryId: '1' }).categoryId, 1);
  for (const categoryName of ['', '   ', 'x'.repeat(81), 'A\u0000B', {}, null]) assert.throws(() => ProductInput.product({ ...product, categoryName }));
  assert.throws(() => ProductInput.product({ ...product, categoryId: '1' }));
  assert.throws(() => ProductInput.product({ ...product, version: 'a'.repeat(64) }, true));
});
test('U036: reutiliza categorías activas y rechaza las inactivas sin reactivarlas', async () => {
  let inserts = 0;
  const repo = { namedCategory: async () => ({ id: 7, state: 'ACTIVO' }), insertCategory: async () => { inserts++; return 8; } }, service = new ProductService(repo);
  assert.equal(await service.category({}, { categoryName: 'AGUAS' }), 7); assert.equal(inserts, 0);
  repo.namedCategory = async () => ({ id: 7, state: 'INACTIVO' });
  await assert.rejects(service.category({}, { categoryName: 'AGUAS' }), e => e.status === 422 && Boolean(e.fieldErrors.categoryIdText)); assert.equal(inserts, 0);
  repo.namedCategory = async () => undefined;
  assert.equal(await service.category({}, { categoryName: 'AGUAS' }), 8); assert.equal(inserts, 1);
});
