/**
 * Medición opcional por petición, sin registrar usuarios, cookies, consultas SQL ni credenciales.
 * Solo la usa scripts/diagnosticar-navegacion.js; las comprobaciones originales se ejecutan completas.
 */
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
class NavigationDiagnostics {
  constructor({ paths = [], report = result => console.log(JSON.stringify(result)) } = {}) {
    this.paths = new Set(paths); this.report = report; this.context = new AsyncLocalStorage();
  }
  middleware(req, res, next) {
    if (req.method !== 'GET' || !this.paths.has(req.path)) return next();
    const record = { ruta: req.path, etapas: {} }, start = performance.now();
    res.once('finish', () => this.report({ ...record, estado: res.statusCode, total_ms: this.round(performance.now() - start) }));
    this.context.run(record, next);
  }
  round(value) { return Math.round(value * 10) / 10; }
  add(record, label, started) {
    if (!record) return;
    record.etapas[label] = this.round((record.etapas[label] || 0) + performance.now() - started);
  }
  /** Envuelve una instancia, nunca un prototipo global; conserva this, errores y argumentos. */
  observeAsync(target, method, label) {
    const original = target[method], probe = this;
    target[method] = async function (...args) {
      const record = probe.context.getStore(), start = performance.now();
      try { return await original.apply(this, args); }
      finally { probe.add(record, label, start); }
    };
  }
  observeCallback(target, method, label) {
    const original = target[method], probe = this;
    target[method] = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback !== 'function') return original.apply(this, args);
      const record = probe.context.getStore(), start = performance.now(); let recorded = false;
      const finish = () => { if (!recorded) { recorded = true; probe.add(record, label, start); } };
      args[args.length - 1] = function (...values) { finish(); return callback.apply(this, values); };
      try { return original.apply(this, args); } catch (error) { finish(); throw error; }
    };
  }
}
module.exports = NavigationDiagnostics;
