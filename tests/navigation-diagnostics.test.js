/** Verifica aislamiento de mediciones y conservación del resultado original; no usa MySQL. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const NavigationDiagnostics = require('../src/utils/NavigationDiagnostics');
const { DiagnosticApp, probe: configured } = require('../scripts/diagnosticar-navegacion');
const navigation = require('../src/config/navigation');
test('U010: diagnóstico conserva resultados, errores y separa peticiones concurrentes', async () => {
  const reports = [], probe = new NavigationDiagnostics({ paths: ['/uno', '/dos'], report: record => reports.push(record) });
  const app = express(); app.use((req, res, next) => probe.middleware(req, res, next));
  const service = { prefix: 'ok', async read(value) { await new Promise(resolve => setTimeout(resolve, 10)); return this.prefix + value; },
    async fail() { throw new Error('failure'); }, readCallback(value, callback) { callback(null, this.prefix + value); } };
  probe.observeAsync(service, 'read', 'lectura_ms'); probe.observeAsync(service, 'fail', 'error_ms'); probe.observeCallback(service, 'readCallback', 'callback_ms');
  app.get('/:page', async (req, res) => {
    await assert.rejects(service.fail(), /failure/);
    service.readCallback('callback', (error, result) => assert.equal(result, 'okcallback'));
    res.send(await service.read(req.params.page));
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const responses = await Promise.all(['/uno', '/dos', '/ignorado'].map(async route => (await fetch(base + route)).text()));
    assert.deepEqual(responses, ['okuno', 'okdos', 'okignorado']); assert.equal(reports.length, 2);
    for (const record of reports) {
      assert.ok(record.total_ms >= 0); assert.equal(record.estado, 200);
      assert.deepEqual(Object.keys(record.etapas).sort(), ['callback_ms', 'error_ms', 'lectura_ms']);
      assert.equal(Object.keys(record).some(key => /cookie|usuario|password/.test(key)), false);
    }
    assert.equal(typeof DiagnosticApp, 'function');
    for (const page of navigation.modules) assert.equal(configured.paths.has(page.href), true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
