/** Regresiones U011: autenticación y caché de plantillas, sin MySQL ni datos de la instalación. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const express = require('express');
const ejs = require('ejs');
const bcrypt = require('bcrypt');
const AuthService = require('../src/services/AuthService');
const TemplateCache = require('../src/core/TemplateCache');
const { server, user, password } = require('./support/application-fixture');

test('U011: bcrypt recibe cuentas ausentes e inactivas y la respuesta excluye el hash', async () => {
  let current = null;
  const calls = [];
  const service = new AuthService({ findByUsername: async () => current, findById: async () => current }, {
    hasher: { compare: async (plain, hash) => { calls.push({ plain, hash }); return true; } }
  });
  await assert.rejects(service.authenticate('ausente', 'incorrecta'), /CREDENCIALES_INVALIDAS/);
  assert.equal(calls[0].hash, AuthService.DUMMY_HASH);
  assert.equal(bcrypt.getRounds(AuthService.DUMMY_HASH), 12);
  assert.equal(await bcrypt.compare('incorrecta', AuthService.DUMMY_HASH), false);
  current = { ...user, estado: 'INACTIVO' };
  await assert.rejects(service.authenticate('audit_user', password), /CREDENCIALES_INVALIDAS/);
  assert.equal(calls.length, 2);
  assert.equal(await service.getAuthenticatedUser(1), null);
  current = { ...user };
  const result = await service.authenticate('audit_user', password);
  assert.equal(result.nombreUsuario, 'audit_user');
  assert.equal(Object.hasOwn(result, 'contrasena'), false);
  assert.deepEqual(await service.getAuthenticatedUser(1), result);
});

test('U011: el límite de contraseña se mide en bytes y no admite sufijos truncados por bcrypt', async () => {
  let lookups = 0;
  const service = new AuthService({ findByUsername: async () => { lookups++; return user; } }, {
    hasher: { compare: async () => true }
  });
  for (const value of ['a'.repeat(73), 'á'.repeat(37), '🔐'.repeat(19)]) {
    await assert.rejects(service.authenticate('audit_user', value), /CREDENCIALES_INVALIDAS/);
  }
  assert.equal(lookups, 0);
  for (const value of ['a'.repeat(72), 'á'.repeat(36), '🔐'.repeat(18)]) {
    assert.equal((await service.authenticate('audit_user', value)).idUsuario, 1);
  }
  assert.equal(lookups, 3);
});

test('U011: las plantillas compiladas se reutilizan pero usuario, permisos y licencia se revalidan', async () => {
  const s = await server();
  const loader = ejs.fileLoader;
  let reads = 0;
  try {
    const form = await s.form();
    const login = await s.post('/api/auth/login', { nombre_usuario: 'audit_user', contrasena: password }, form);
    assert.equal(login.status, 200);
    const headers = { Cookie: login.cookie };
    ejs.fileLoader = file => { reads++; return loader(file); };
    assert.equal((await s.request('/inventario', { headers })).status, 200);
    const warmReads = reads;
    assert.ok(warmReads > 0);
    s.setUser({ ...user, nombre: 'Nombre actualizado' });
    const fresh = await s.request('/inventario', { headers });
    assert.match(fresh.text, /Nombre actualizado/);
    assert.equal(reads, warmReads, 'Una segunda renderización no vuelve a leer las plantillas.');
    s.setUser({ ...user, rol: 'ENCARGADO_VENTA', id_rol: 2 });
    assert.equal((await s.request('/usuarios', { headers })).status, 403);
    s.setUser({ ...user, estado: 'INACTIVO' });
    assert.equal((await s.request('/inicio', { headers })).status, 302);
    s.setUser({ ...user });
    const second = await s.form();
    const newLogin = await s.post('/api/auth/login', { nombre_usuario: 'audit_user', contrasena: password }, second);
    s.setLicense(null);
    assert.equal((await s.request('/inicio', { headers: { Cookie: newLogin.cookie } })).status, 302);
  } finally { ejs.fileLoader = loader; await s.close(); }
});

test('U011: la edición y el reemplazo de un include invalidan la caché en desarrollo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paris-views-'));
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', dir);
  fs.mkdirSync(path.join(dir, 'components'));
  fs.writeFileSync(path.join(dir, 'page.ejs'), '<%- include("components/value") %>');
  const partial = path.join(dir, 'components/value.ejs');
  fs.writeFileSync(partial, 'Inicial: <%= value %>');
  const cache = new TemplateCache(app, dir);
  const render = value => new Promise((resolve, reject) => app.render('page', { value }, (error, html) => error ? reject(error) : resolve(html)));
  const waitInvalidation = async previous => {
    const deadline = Date.now() + 3000;
    while (cache.invalidations === previous && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(cache.invalidations > previous);
  };
  try {
    assert.equal(cache.enabled, true);
    assert.equal(await render('Ana'), 'Inicial: Ana');
    let previous = cache.invalidations;
    fs.writeFileSync(partial, 'Editado: <%= value %>');
    await waitInvalidation(previous);
    assert.equal(await render('Luis'), 'Editado: Luis');
    previous = cache.invalidations;
    fs.writeFileSync(partial + '.tmp', 'Reemplazado: <%= value %>');
    fs.renameSync(partial + '.tmp', partial);
    await waitInvalidation(previous);
    assert.equal(await render('Rosa'), 'Reemplazado: Rosa');
  } finally { cache.close(); assert.equal(cache.watcher, null); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('U011: fallo de vigilancia desactiva la caché y producción no abre un vigilante', () => {
  const app = express();
  const unsupported = new TemplateCache(app, '.', { watch: () => { throw new Error('No disponible'); } });
  assert.equal(unsupported.enabled, false);
  assert.equal(app.enabled('view cache'), false);
  const watcher = new EventEmitter();
  let closed = 0;
  watcher.unref = () => {};
  watcher.close = () => { closed++; };
  const cache = new TemplateCache(app, '.', { watch: () => watcher });
  watcher.emit('error', new Error('Vigilancia interrumpida'));
  assert.equal(app.enabled('view cache'), false);
  assert.equal(closed, 1);
  cache.close(); assert.equal(closed, 1);
  const production = new TemplateCache(app, '.', { development: false, watch: () => { throw new Error('No debe abrirse'); } });
  assert.equal(production.enabled, true);
  production.close();
});
