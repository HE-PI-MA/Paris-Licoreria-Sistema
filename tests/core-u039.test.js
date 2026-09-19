/** Regresiones U039 sin MySQL: contratos, SQL versionado, alcance y validaciones críticas. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readSql } = require('../scripts/sql');
const Input = require('../src/domain/OperationInput');
const SaleService = require('../src/services/SaleService');
const CashService = require('../src/services/CashService');
const modules = require('../src/config/module-layouts');

const root = path.join(__dirname, '..');
test('U039: SQL es parseable, aditivo y contiene caja física, FEFO y devoluciones auditadas', () => {
  const file = path.join(root, 'database/migrations/U039.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const statements = readSql(file);
  assert.ok(statements.length >= 32);
  assert.equal(statements.filter(s => /^CREATE PROCEDURE/i.test(s)).length, 4);
  assert.match(sql, /CREATE TABLE caja\s*\(/i);
  assert.match(sql, /CREATE TABLE devolucion_pago\s*\(/i);
  assert.match(sql, /ORDER BY \(lp\.fecha_vencimiento IS NULL\) ASC, lp\.fecha_vencimiento ASC/i);
  assert.match(sql, /uq_venta_operacion/i);
  assert.match(sql, /idx_catalogo_operacion_creada/i);
  assert.match(sql, /CREATE TRIGGER trg_venta_bi_u039/i);
  assert.match(sql, /CREATE TRIGGER trg_venta_bu_u039/i);
  assert.match(sql, /CREATE PROCEDURE sp_limpiar_catalogo_operacion/i);
  assert.ok(!statements.some(s => /^(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM\s+(venta|compra|lote_|sesion_caja))/i.test(s)));
});

test('U039: bootstrap oficial contiene las 21 tablas V2 y no depende de tests', () => {
  const tableFile = path.join(root, 'database/bootstrap/01_tablas_v2.sql');
  const statements = readSql(tableFile);
  assert.equal(statements.filter(s => /^CREATE TABLE/i.test(s)).length, 21);
  for (const name of ['rol','usuario','producto','proveedor','sesion_caja','venta','pago','arqueo_caja']) assert.ok(statements.some(s => new RegExp('CREATE TABLE\\s+' + name + '\\s*\\(', 'i').test(s)));
  assert.ok(fs.existsSync(path.join(root, 'scripts/setup-database.js')));
});

test('U039: validación de Caja, Ventas y fechas rechaza datos ambiguos', () => {
  assert.deepEqual(Input.cashOpen({ cashId: 1, initialAmount: '50.00', observation: '' }), { cashId: 1, initialAmount: '50.00', observation: '' });
  assert.throws(() => Input.cashOpen({ cashId: 0, initialAmount: '50', observation: '' }));
  assert.throws(() => Input.cashClose({ observation: '', count: [{ denominationId: 1, quantity: 1 }, { denominationId: 1, quantity: 2 }] }));
  const sale = Input.sale({ details: [{ presentationId: 2, quantity: '1.500' }], payments: [{ method: 'QR', amount: '25.00', receipt: 'REF-001' }] });
  assert.equal(sale.details[0].cantidad, '1.500'); assert.equal(sale.payments[0].metodo_pago, 'QR');
  assert.throws(() => Input.sale({ details: [{ presentationId: 2, quantity: '1' }, { presentationId: 2, quantity: '1' }], payments: [{ method: 'EFECTIVO', amount: '10', receipt: '' }] }));
  assert.throws(() => Input.sale({ details: [{ presentationId: 2, quantity: '1' }], payments: [{ method: 'QR', amount: '10', receipt: '' }] }));
  assert.throws(() => Input.report({ from: '2026-02-31', to: '2026-03-01' }));
  assert.throws(() => Input.report({ from: '2026-10-01', to: '2026-09-01' }));
});

test('U039: Venta exige turno propio y conserva operación idempotente', async () => {
  const calls = [];
  const repo = { openSession: async () => ({ id: 7 }), create: async (...args) => { calls.push(args); return 21; } };
  const service = new SaleService(repo); const key = crypto.randomUUID();
  const result = await service.create({ idUsuario: 3, rol: 'ENCARGADO_VENTA' }, key, { details: [{ presentationId: 2, quantity: '1' }], payments: [{ method: 'EFECTIVO', amount: '10.00', receipt: '' }] });
  assert.deepEqual(result, { id: 21 }); assert.equal(calls[0][0], 3); assert.equal(calls[0][1], 7); assert.equal(calls[0][2], key);
  assert.match(calls[0][3], /^[a-f0-9]{64}$/);
  const closed = new SaleService({ openSession: async () => null });
  await assert.rejects(closed.create({ idUsuario: 3 }, key, { details: [{ presentationId: 2, quantity: '1' }], payments: [{ method: 'EFECTIVO', amount: '10.00', receipt: '' }] }), e => e.status === 409);
});

test('U039: un reintento concurrente idéntico recupera la venta ya confirmada', async () => {
  const key=crypto.randomUUID(); let expectedHash;
  const repo={
    openSession:async()=>({id:9}),
    create:async(_user,_session,_key,hash)=>{expectedHash=hash;const error=new Error('duplicate');error.code='ER_DUP_ENTRY';throw error;},
    operation:async()=>({id:44,hash:expectedHash})
  };
  const service=new SaleService(repo);
  const result=await service.create({idUsuario:2,rol:'ENCARGADO_VENTA'},key,{details:[{presentationId:3,quantity:'1'}],payments:[{method:'EFECTIVO',amount:'20.00',receipt:''}]});
  assert.deepEqual(result,{id:44});
});

test('U039: Caja bloquea una apertura global ya existente y solo cierra el turno propio', async () => {
  const service = new CashService({ open: async () => { const e = new Error('CAJA_YA_ABIERTA'); e.business = true; throw e; } });
  await assert.rejects(service.open({ idUsuario: 1 }, { cashId: 1, initialAmount: '0', observation: '' }), e => e.status === 409);
  const close = new CashService({ current: async () => null });
  await assert.rejects(close.close({ idUsuario: 1 }, { observation: '', count: [{ denominationId: 1, quantity: 0 }] }), e => e.status === 409);
});

test('U039: los cinco módulos antes pendientes están habilitados y usan vistas reales', () => {
  for (const id of ['inicio','ventas','caja','reportes','usuarios']) {
    const ui = modules.forPage({ id, label: id }); assert.equal(ui.enabled, true); assert.ok(ui.contentView);
    const file = path.join(root, 'views', ui.contentView + '.ejs'); assert.ok(fs.existsSync(file)); assert.doesNotMatch(fs.readFileSync(file,'utf8'), /Módulo en preparación/i);
  }
});

test('U039: permisos mínimos incluyen operaciones nuevas sin privilegios DDL para la app', () => {
  const sql = fs.readFileSync(path.join(root,'database/permisos_minimos.sql'),'utf8');
  for (const name of ['sp_registrar_venta','sp_anular_venta','sp_cerrar_sesion_caja','sp_limpiar_catalogo_operacion']) assert.match(sql,new RegExp('GRANT EXECUTE ON PROCEDURE paris_licoreria\\.'+name,'i'));
  assert.match(sql,/GRANT SELECT, INSERT ON paris_licoreria\.sesion_caja/i);
  assert.match(sql,/GRANT INSERT, UPDATE ON paris_licoreria\.usuario/i);
  assert.doesNotMatch(sql,/GRANT\s+.*\b(CREATE|ALTER|DROP|TRIGGER)\b.*TO 'paris_app'/i);
});
