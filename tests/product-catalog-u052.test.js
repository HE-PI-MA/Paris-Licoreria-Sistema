const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U052: Productos no ofrece alta directa', () => {
  const layout = read('src/config/module-layouts.js');
  const page = read('public/js/pages/products.js');
  const routes = read('src/routes/product.routes.js');
  const workspace = read('views/layouts/workspace.ejs');

  assert.match(layout, /productos:\s*\{[^}]*hidePrimary:\s*true/);
  assert.doesNotMatch(layout, /productos:\s*\{[^}]*Nuevo producto/);
  assert.doesNotMatch(page, /data-module-primary/);
  assert.doesNotMatch(page, /openProduct\(null/);
  assert.doesNotMatch(routes, /post\('\/',\s*controller\.handle\('create'/);

  const productBlock = workspace.match(/<% if \(page\.id === 'productos'\) \{ %>[\s\S]*?<% \} %>/)?.[0] || '';
  assert.doesNotMatch(productBlock, /product-capture\.js/);
});

test('U052: Productos funciona como catálogo y configuración de venta', () => {
  const page = read('public/js/pages/products.js');
  const form = read('public/js/pages/product-forms.js');

  assert.match(page, /key:\s*'presentations',\s*label:\s*'Formas de venta'/);
  assert.match(page, /Configurar venta/);
  assert.match(page, /Presentaciones/);
  assert.match(page, /id:\s*'edit',\s*label:\s*'Editar'/);
  assert.match(form, /title:\s*'Editar producto'/);
});

test('U052: Editar producto solo contiene los datos del catálogo acordados', () => {
  const form = read('public/js/pages/product-forms.js');
  const productClass = form.match(/class ProductForm[\s\S]*?class PresentationForm/)?.[0] || '';

  assert.match(productClass, /Editar producto requiere un producto existente/);
  assert.match(productClass, /Foto del producto \(opcional\)/);
  assert.match(productClass, /Nombre del producto/);
  assert.match(productClass, /'Categoría'/);
  assert.match(productClass, /'¿Cómo se cuenta\?'/);
  assert.match(productClass, /this\.state\(row\.state\)/);

  assert.doesNotMatch(productClass, /Nuevo producto/);
  assert.doesNotMatch(productClass, /Stock mínimo/);
  assert.doesNotMatch(productClass, /Descripción/);
  assert.doesNotMatch(productClass, /initialPresentation|presentationName/);
});

test('U052: precio y código siguen perteneciendo a Presentaciones', () => {
  const form = read('public/js/pages/product-forms.js');
  const presentationClass = form.match(/class PresentationForm[\s\S]*?Object\.assign/)?.[0] || '';

  assert.match(presentationClass, /Forma de venta/);
  assert.match(presentationClass, /Precio de venta \(Bs\)/);
  assert.match(presentationClass, /Código de barras/);
  assert.match(presentationClass, /¿Cuánto trae\?/);
});

test('U052: editar producto no reescribe campos administrativos ocultos', () => {
  const input = read('src/domain/ProductInput.js');
  const repo = read('src/repositories/ProductRepository.js');

  const updateBranch = input.match(/if \(update\) \{[\s\S]*?\n    \}/)?.[0] || '';
  assert.match(updateBranch, /name/);
  assert.match(updateBranch, /categoryId/);
  assert.match(updateBranch, /unitId/);
  assert.match(updateBranch, /state/);
  assert.doesNotMatch(updateBranch, /description|minimum/);

  assert.match(repo, /UPDATE producto SET nombre=\?,id_categoria=\?,id_unidad_medida=\?,estado=\?/);
  assert.doesNotMatch(repo, /UPDATE producto SET nombre=\?,id_categoria=\?,id_unidad_medida=\?,descripcion=\?,stock_minimo=\?,estado=\?/);
});
