const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U048/U051: el nombre nuevo se conserva como texto libre y se acompaña de categoría', () => {
  const form = read('public/js/pages/purchase-form.js');

  assert.match(form, /allowCustom:\s*true/);
  assert.match(form, /Buscar o escribir producto/);
  assert.match(form, /control\.input\.maxLength\s*=\s*120/);
  assert.doesNotMatch(form, /openNewProduct|new Catalog\.ProductForm|productModal/);

  assert.match(form, /const product = this\.selectedProduct\?\.id/);
  assert.match(form, /name,/);
  assert.match(form, /categoryId:\s*this\.category\.select\.value/);
  assert.match(form, /categoryName:\s*categoryText/);
});

test('U048/U051: Compras no carga ProductForm ni ProductCapture', () => {
  const workspace = read('views/layouts/workspace.ejs');
  const block = workspace.match(/<% if \(page\.id === 'compras'\) \{ %>[\s\S]*?<% \} %>/)?.[0] || '';

  assert.doesNotMatch(block, /product-capture\.js|product-forms\.js/);
  assert.match(block, /products-api\.js/);
  assert.match(block, /purchase-form\.js/);
});

test('U048/U050: ¿Cómo llegó? usa el selector global con sugerencias', () => {
  const catalog = read('public/js/components/catalog-form.js');
  const purchase = read('public/js/pages/purchase-form.js');

  assert.match(catalog, /suggestChoice\(name, label/);
  assert.match(catalog, /searchable:\s*true/);
  assert.match(purchase, /this\.arrival = this\.suggestChoice\('arrival'/);
});

test('U048/U051: editar una fila nueva restaura nombre y categoría sin convertirlos en producto existente', () => {
  const form = read('public/js/pages/purchase-form.js');

  assert.match(form, /if \(line\.product\.id\)/);
  assert.match(form, /this\.product\.control\.input\.value = record\.product/);
  assert.match(form, /categoryName: line\.product\.categoryName/);
});
