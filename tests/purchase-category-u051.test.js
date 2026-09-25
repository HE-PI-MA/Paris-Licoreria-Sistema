const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PurchaseInput = require('../src/domain/PurchaseInput');
const PurchaseService = require('../src/services/PurchaseService');
const { PurchaseMemoryRepository, body } = require('./support/purchase-fixture');

const key = () => crypto.randomUUID();
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U051: producto nuevo en Compra exige categoría y la normaliza', () => {
  const data = body();
  data.lines[0].product = { name: '  coca nueva ', categoryId: '2' };
  const clean = PurchaseInput.purchase(data);
  assert.equal(clean.lines[0].product.name, 'COCA NUEVA');
  assert.equal(clean.lines[0].product.categoryId, 2);

  const custom = body();
  custom.lines[0].product = { name: 'AZÚCAR', categoryName: '  productos   naturales ' };
  assert.equal(PurchaseInput.purchase(custom).lines[0].product.categoryName, 'PRODUCTOS NATURALES');

  const missing = body();
  missing.lines[0].product = { name: 'SIN CATEGORÍA' };
  assert.throws(() => PurchaseInput.purchase(missing), error => error.status === 400 || error.status === 422);
});

test('U051: Compra crea producto nuevo con la categoría elegida, no con Otros', async () => {
  const repo = new PurchaseMemoryRepository();
  const service = new PurchaseService(repo);
  const data = body();

  data.lines[0].product = { name: 'COCA NUEVA', categoryId: '2' };
  data.lines[0].arrival = 'KILOGRAMO';
  data.lines[0].factor = '1000';

  const saved = await service.create(1, key(), data);
  assert.equal(saved.total, '90.50');

  const created = repo.pool.data.products.at(-1);
  assert.equal(created.name, 'COCA NUEVA');
  assert.equal(created.categoryId, 2);
  assert.equal(created.category, 'PRODUCTO NATURAL');
  assert.equal(created.unitId, 3);
  assert.notEqual(created.category, 'OTROS');
});

test('U051: categoría escrita puede crearse dentro de la misma compra', async () => {
  const repo = new PurchaseMemoryRepository();
  const service = new PurchaseService(repo);
  const data = body();

  data.lines[0].product = { name: 'PRODUCTO ESPECIAL', categoryName: 'NUEVA CATEGORÍA' };

  await service.create(1, key(), data);

  const category = repo.pool.data.categories.find(row => row.name === 'NUEVA CATEGORÍA');
  const product = repo.pool.data.products.find(row => row.name === 'PRODUCTO ESPECIAL');

  assert.ok(category);
  assert.equal(product.categoryId, category.id);
});

test('U051: Nueva compra muestra Categoría y la bloquea para productos existentes', () => {
  const form = read('public/js/pages/purchase-form.js');

  assert.match(form, /categoryLookup\(\)/);
  assert.match(form, /'Categoría'/);
  assert.match(form, /Buscar o escribir categoría/);
  assert.match(form, /this\.setCategory\(record, true\)/);
  assert.match(form, /categoryName:\s*categoryText/);
  assert.doesNotMatch(form, /categoryId:\s*6/);
});

test('U051: detalle de Compra conserva la categoría', () => {
  const view = read('public/js/pages/purchase-view.js');
  const repo = read('src/repositories/PurchaseRepository.js');

  assert.match(view, /\{ key: 'category', label: 'Categoría'/);
  assert.match(repo, /cat\.nombre AS category/);
  assert.match(repo, /JOIN categoria cat/);
});

test('U051/U052: el producto nace desde Compra y Productos solo lo administra', () => {
  const form = read('public/js/pages/product-forms.js');
  const page = read('public/js/pages/products.js');
  const layout = read('src/config/module-layouts.js');

  const productClass = form.match(/class ProductForm[\s\S]*?class PresentationForm/)?.[0] || '';

  assert.match(productClass, /Editar producto requiere un producto existente/);
  assert.match(productClass, /Foto del producto \(opcional\)/);
  assert.match(productClass, /Nombre del producto/);
  assert.match(productClass, /'Categoría'/);
  assert.match(productClass, /'¿Cómo se cuenta\?'/);
  assert.match(productClass, /this\.state\(row\.state\)/);

  assert.doesNotMatch(productClass, /Nuevo producto/);
  assert.doesNotMatch(page, /openProduct\(null/);
  assert.match(layout, /productos:\s*\{[^}]*hidePrimary:\s*true/);
});

test('U051: backend de Producto aplica valores por defecto al crear', () => {
  const { ProductInput } = require('../src/domain/ProductInput');
  const data = ProductInput.product({
    name: 'PRODUCTO SIMPLE',
    categoryId: '1',
    unitId: '1'
  });

  assert.equal(data.minimum, '0.000');
  assert.equal(data.state, 'ACTIVO');
  assert.equal(data.description, '');
});
