const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const PurchaseInput = require('../src/domain/PurchaseInput');
const PurchaseService = require('../src/services/PurchaseService');
const { PurchaseMemoryRepository, body } = require('./support/purchase-fixture');

test('U049/U051: Compra acepta nombre nuevo con categoría sin abrir el formulario completo de Producto', () => {
  const data = body();
  data.lines[0].product = { name: '  coca   cola  ', categoryId: '2' };
  const clean = PurchaseInput.purchase(data);

  assert.equal(clean.lines[0].product.name, 'COCA COLA');
  assert.equal(clean.lines[0].product.categoryId, 2);
  assert.equal(Object.hasOwn(clean.lines[0].product, 'unitId'), false);
});

test('U049/U051: guardar compra crea producto mínimo con la categoría elegida y registra stock', async () => {
  const repo = new PurchaseMemoryRepository(), service = new PurchaseService(repo);
  const data = body();

  data.lines[0].product = { name: 'COCA COLA NUEVA', categoryId: '2' };

  const saved = await service.create(1, crypto.randomUUID(), data);
  assert.equal(saved.total, '90.50');
  assert.equal(repo.pool.data.products.length, 2);

  const created = repo.pool.data.products[1];
  assert.equal(created.name, 'COCA COLA NUEVA');
  assert.equal(created.categoryId, 2);
  assert.equal(created.unitId, 1);
  assert.equal(created.state, 'ACTIVO');
  assert.equal(repo.pool.data.lines[0].productId, created.id);
  assert.equal(repo.pool.data.lines[0].baseQuantity, '12.000');
});

test('U049/U051: dos filas con mismo producto nuevo y misma categoría crean un solo producto', async () => {
  const repo = new PurchaseMemoryRepository(), service = new PurchaseService(repo);
  const data = body();

  data.lines[0].product = { name: 'AGUA NUEVA', categoryId: '1' };
  data.lines.push({ ...structuredClone(data.lines[0]), arrival: 'PAQUETE', quantity: '1' });

  await service.create(1, crypto.randomUUID(), data);

  assert.equal(repo.pool.data.products.filter(row => row.name === 'AGUA NUEVA').length, 1);
  assert.equal(repo.pool.data.lines.length, 2);
  assert.equal(repo.pool.data.lines[0].productId, repo.pool.data.lines[1].productId);
});

test('U049/U051: si el nombre ya existe, Compra reutiliza el producto activo', async () => {
  const repo = new PurchaseMemoryRepository(), service = new PurchaseService(repo);
  const data = body();

  data.lines[0].product = { name: 'CERVEZA FICTICIA', categoryId: '2' };

  await service.create(1, crypto.randomUUID(), data);

  assert.equal(repo.pool.data.products.length, 1);
  assert.equal(repo.pool.data.lines[0].productId, 1);
});
