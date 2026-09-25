const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { ProductInput } = require('../src/domain/ProductInput');
const ProductService = require('../src/services/ProductService');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

function classBlock(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0, 'No se encontró ' + from);
  assert.ok(end > start, 'No se encontró el final de ' + from);
  return source.slice(start, end);
}

test('U053: Editar producto permite escribir una categoría y conserva el texto', () => {
  const form = read('public/js/pages/product-forms.js');
  const productClass = classBlock(form, 'class ProductForm', 'class PresentationForm');

  assert.match(productClass, /Buscar o escribir categoría/);
  assert.match(productClass, /allowCustom:\s*true/);
  assert.match(productClass, /maxLength:\s*80/);
  assert.match(productClass, /categoryIdText/);
  assert.match(productClass, /categoryName:\s*categoryIdText/);
});

test('U053: ProductInput acepta categoría escrita al editar y la normaliza', () => {
  const data = ProductInput.product({
    name: 'Coca Cola',
    categoryName: '  gaseosas  ',
    unitId: '1',
    state: 'ACTIVO',
    version: 'a'.repeat(64)
  }, true);

  assert.equal(data.name, 'Coca Cola');
  assert.equal(data.categoryName, 'GASEOSAS');
  assert.equal(data.categoryId, undefined);
  assert.equal(data.unitId, 1);
  assert.equal(data.state, 'ACTIVO');
});

test('U053: ProductInput sigue aceptando una categoría seleccionada por ID', () => {
  const data = ProductInput.product({
    name: 'Coca Cola',
    categoryId: '7',
    unitId: '1',
    state: 'ACTIVO',
    version: 'a'.repeat(64)
  }, true);

  assert.equal(data.categoryId, 7);
  assert.equal(data.categoryName, undefined);
});

test('U053: Editar producto reutiliza una categoría activa escrita por nombre', async () => {
  const current = {
    id: 5,
    name: 'COCA COLA',
    categoryId: 1,
    unitId: 1,
    state: 'ACTIVO',
    photoHash: null,
    version: 'a'.repeat(64)
  };

  let saved;

  const repo = {
    write: async (_, operation) => operation({}),
    getProduct: async () => current,
    lockPresentations: async () => [],
    namedCategory: async (_, name) => {
      assert.equal(name, 'GASEOSAS');
      return { id: 9, state: 'ACTIVO' };
    },
    insertCategory: async () => assert.fail('No debe duplicar una categoría existente.'),
    category: async (_, id) => id === 9 ? { state: 'ACTIVO' } : undefined,
    unit: async (_, id) => id === 1 ? { id: 1 } : undefined,
    updateProduct: async (_, id, data) => {
      saved = { id, data };
      return { id };
    }
  };

  const service = new ProductService(repo);

  await service.update(
    1,
    crypto.randomUUID(),
    5,
    {
      name: 'COCA COLA',
      categoryName: 'gaseosas',
      unitId: '1',
      state: 'ACTIVO',
      version: current.version
    }
  );

  assert.equal(saved.id, 5);
  assert.equal(saved.data.categoryId, 9);
});

test('U053: una categoría nueva escrita se crea al guardar la edición', async () => {
  const current = {
    id: 5,
    name: 'COCA COLA',
    categoryId: 1,
    unitId: 1,
    state: 'ACTIVO',
    photoHash: null,
    version: 'a'.repeat(64)
  };

  let inserted = 0;
  let saved;

  const repo = {
    write: async (_, operation) => operation({}),
    getProduct: async () => current,
    lockPresentations: async () => [],
    namedCategory: async () => undefined,
    insertCategory: async (_, name) => {
      inserted++;
      assert.equal(name, 'GASEOSAS');
      return 11;
    },
    category: async (_, id) => id === 11 ? { state: 'ACTIVO' } : undefined,
    unit: async (_, id) => id === 1 ? { id: 1 } : undefined,
    updateProduct: async (_, id, data) => {
      saved = { id, data };
      return { id };
    }
  };

  const service = new ProductService(repo);

  await service.update(
    1,
    crypto.randomUUID(),
    5,
    {
      name: 'COCA COLA',
      categoryName: 'gaseosas',
      unitId: '1',
      state: 'ACTIVO',
      version: current.version
    }
  );

  assert.equal(inserted, 1);
  assert.equal(saved.data.categoryId, 11);
});

test('U053: Presentaciones siguen sin manejar fotos propias', () => {
  const form = read('public/js/pages/product-forms.js');
  const presentationClass = classBlock(form, 'class PresentationForm', 'Object.assign');

  assert.doesNotMatch(presentationClass, /PhotoField|Foto del producto|photo/);
  assert.match(presentationClass, /Precio de venta \(Bs\)/);
  assert.match(presentationClass, /Código de barras/);
});
