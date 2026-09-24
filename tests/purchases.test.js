/** U044: contrato simplificado de Compras con datos ficticios. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { PurchaseMemoryRepository, body } = require('./support/purchase-fixture');
const Service = require('../src/services/PurchaseService'), Input = require('../src/domain/PurchaseInput');
const { server, password } = require('./support/application-fixture');
const key = () => crypto.randomUUID();

test('U044: Compra acepta solo datos propios del ingreso', () => {
  const clean = Input.purchase(body());
  assert.deepEqual(Object.keys(clean).sort(), ['lines','locationId']);
  assert.equal(clean.lines[0].arrival, 'CAJA');
  assert.equal(clean.lines[0].factor, '6.000');
  assert.equal(clean.lines[0].quantity, '2.000');
  for (const extra of [
    { supplier: { name: 'NO' } }, { observation: 'NO' }
  ]) assert.throws(() => Input.purchase({ ...body(), ...extra }), error => error.status === 400);
  for (const extra of [
    { presentation: { id: 1 } }, { lotCode: 'MANUAL' }, { price: '50' }, { barcode: '123' }, { photo: 'x' }
  ]) {
    const data = body(); Object.assign(data.lines[0], extra);
    assert.throws(() => Input.purchase(data), error => error.status === 400);
  }
});

test('U044: guardar compra aumenta stock base con factor propio y genera lote automático', async () => {
  const repo = new PurchaseMemoryRepository(), service = new Service(repo);
  const saved = await service.create(1, key(), body());
  assert.equal(saved.total, '90.50');
  assert.equal(repo.pool.data.purchases.length, 1);
  assert.equal(repo.pool.data.lines[0].baseQuantity, '12.000');
  assert.equal(repo.pool.data.lines[0].lotCode, 'L-000001');
  const detail = await service.detail(saved.id);
  assert.equal(detail.lines[0].product, 'CERVEZA FICTICIA');
  assert.equal(detail.lines[0].arrival, 'CAJA');
  assert.equal(detail.lines[0].lotCode, 'L-000001');
});

test('U044: ubicación nueva e idempotencia conservan una sola compra', async () => {
  const repo = new PurchaseMemoryRepository(), service = new Service(repo), data = body(), operation = key();
  delete data.locationId; data.locationName = 'HELADERA';
  const [a, b] = await Promise.all([service.create(1, operation, data), service.create(1, operation, data)]);
  assert.deepEqual(a, b);
  assert.equal(repo.pool.data.purchases.length, 1);
  assert.equal(repo.pool.data.locations.length, 2);
});

test('U044: versiones y productos inactivos protegen el ingreso', async () => {
  const repo = new PurchaseMemoryRepository(), service = new Service(repo);
  const bad = body(); bad.lines[0].product.version = 'a'.repeat(64);
  await assert.rejects(service.create(1, key(), bad), error => error.status === 409);
  repo.pool.data.products[0].state = 'INACTIVO';
  const inactive = body();
  await assert.rejects(service.create(1, key(), inactive), error => error.status === 409);
});

test('U044: API conserva sesión, CSRF y permiso administrador', async () => {
  const repo = new PurchaseMemoryRepository(), app = await server({ purchaseRepository: repo });
  try {
    assert.equal((await app.request('/api/compras')).status, 401);
    const form = await app.form();
    const login = await app.post('/api/auth/login', { nombre_usuario: 'audit_user', contrasena: password }, form);
    const auth = await app.form('/compras', login.cookie);
    assert.equal((await app.post('/api/compras', body(), { cookie: auth.cookie, token: '' }, { 'x-operation-id': key() })).status, 403);
    const result = await app.post('/api/compras', body(), auth, { 'x-operation-id': key() });
    assert.equal(result.status, 201, result.text);
    app.setUser({ id_usuario: 1, id_rol: 2, nombre: 'Cajero', nombre_usuario: 'audit_user', estado: 'ACTIVO', rol: 'ENCARGADO_VENTA' });
    assert.equal((await app.request('/api/compras', { headers: { Cookie: auth.cookie } })).status, 403);
  } finally { await app.close(); }
});
