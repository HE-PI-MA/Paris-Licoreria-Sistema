const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PurchaseInput = require('../src/domain/PurchaseInput');
const PurchaseService = require('../src/services/PurchaseService');
const { PurchaseMemoryRepository, body } = require('./support/purchase-fixture');
const { server, password } = require('./support/application-fixture');

const key = () => crypto.randomUUID();
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const newProduct = name => ({ name, categoryId: '2' });

test('U050/U051: medidas estándar normalizan el factor de un producto nuevo', () => {
  for (const [arrival, factor] of [
    ['UNIDAD','1.000'],
    ['DOCENA','12.000'],
    ['GRAMO','1.000'],
    ['KILOGRAMO','1000.000'],
    ['LIBRA','453.592'],
    ['MILILITRO','1.000'],
    ['LITRO','1000.000']
  ]) {
    const data = body();
    data.lines[0].product = newProduct('PRODUCTO ' + arrival);
    data.lines[0].arrival = arrival;
    data.lines[0].factor = '7';

    assert.equal(PurchaseInput.purchase(data).lines[0].factor, factor);
  }
});

test('U050/U051: caja, paquete, bolsa y botella conservan factor manual', () => {
  for (const arrival of ['CAJA','PAQUETE','BOLSA','BOTELLA']) {
    const data = body();
    data.lines[0].product = newProduct('PRODUCTO ' + arrival);
    data.lines[0].arrival = arrival;
    data.lines[0].factor = '24';

    assert.equal(PurchaseInput.purchase(data).lines[0].factor, '24.000');
  }
});

test('U050/U051: producto nuevo infiere Unidad, Gramo o Mililitro según cómo llegó', async () => {
  for (const [arrival, expectedUnit] of [['CAJA',1],['KILOGRAMO',3],['LIBRA',3],['LITRO',4]]) {
    const repo = new PurchaseMemoryRepository(), service = new PurchaseService(repo);
    const data = body();

    data.lines[0].product = newProduct('NUEVO ' + arrival);
    data.lines[0].arrival = arrival;
    data.lines[0].factor = '2';

    await service.create(1, key(), data);
    assert.equal(repo.pool.data.products.at(-1).unitId, expectedUnit);
  }
});

test('U050/U051: un producto nuevo no mezcla peso y volumen dentro de la misma compra', async () => {
  const repo = new PurchaseMemoryRepository(), service = new PurchaseService(repo), data = body();

  data.lines[0].product = newProduct('PRODUCTO MIXTO');
  data.lines[0].arrival = 'KILOGRAMO';

  const second = structuredClone(data.lines[0]);
  second.arrival = 'LITRO';
  data.lines.push(second);

  await assert.rejects(service.create(1, key(), data), error => error.status === 422);
  assert.equal(repo.pool.data.purchases.length, 0);
});

test('U050/U051: API acepta una compra con producto nuevo y categoría y responde 201', async () => {
  const repo = new PurchaseMemoryRepository(), app = await server({ purchaseRepository: repo });

  try {
    const form = await app.form();
    const login = await app.post('/api/auth/login', {
      nombre_usuario: 'audit_user',
      contrasena: password
    }, form);

    const auth = await app.form('/compras', login.cookie);
    const data = body();

    data.lines[0].product = newProduct('AZÚCAR NUEVA');
    data.lines[0].arrival = 'KILOGRAMO';
    data.lines[0].factor = '1000';

    const result = await app.post('/api/compras', data, auth, { 'x-operation-id': key() });

    assert.equal(result.status, 201, result.text);
    assert.equal(repo.pool.data.products.at(-1).name, 'AZÚCAR NUEVA');
    assert.equal(repo.pool.data.products.at(-1).categoryId, 2);
    assert.equal(repo.pool.data.products.at(-1).unitId, 3);
  } finally {
    await app.close();
  }
});

test('U050: Cómo llegó permite escribir para filtrar sugerencias y autocompleta medidas', () => {
  const catalog = read('public/js/components/catalog-form.js');
  const form = read('public/js/pages/purchase-form.js');

  assert.match(catalog, /suggestChoice\(name, label/);
  assert.match(catalog, /searchable:\s*true/);
  assert.match(form, /this\.suggestChoice\('arrival'/);

  for (const text of ['Gramo (g)','Kilogramo (kg)','Libra (lb)','Mililitro (ml)','Litro (L)']) {
    assert.ok(form.includes(text), text);
  }

  assert.match(form, /LIBRA:\s*'453\.592'/);
  assert.match(form, /KILOGRAMO:\s*'1000'/);
  assert.match(form, /LITRO:\s*'1000'/);
  assert.match(form, /this\.factor\.readOnly = true/);
});

test('U050: columnas numéricas y N.º se centran desde la clase global de tabla', () => {
  const css = read('public/css/components/data-table.css');
  const number = css.match(/\.app-table \.app-table-number\s*\{([^}]*)\}/)?.[1] || '';
  const sequence = css.match(/\.app-table-sequence\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(number, /text-align:\s*center/);
  assert.match(sequence, /text-align:\s*center/);
});
