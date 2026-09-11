/**
 * Reutiliza funciones EJS compiladas, nunca páginas ni datos del usuario.
 * En desarrollo invalida las plantillas al editar vistas; si la vigilancia falla, desactiva la caché.
 */
const fs = require('node:fs');
const ejs = require('ejs');
class TemplateCache {
  constructor(app, views, { development = true, enabled = true, watch = fs.watch } = {}) {
    this.app = app;
    this.enabled = enabled;
    this.invalidations = 0;
    if (!enabled) { app.disable('view cache'); return; }
    this.invalidate();
    app.enable('view cache');
    if (development) {
      try {
        this.watcher = watch(views, { recursive: true }, (_, file) => {
          if (!file || String(file).endsWith('.ejs')) this.invalidate();
        });
        this.watcher.on('error', () => this.disable());
        this.watcher.unref();
      } catch (_) { this.disable(); }
    }
  }
  invalidate() {
    ++this.invalidations;
    // Express guarda la resolución de vistas y EJS guarda las funciones compiladas.
    this.app.cache = {};
    ejs.clearCache();
  }
  disable() {
    this.enabled = false;
    this.app.disable('view cache');
    this.invalidate();
    this.close();
  }
  close() { this.watcher?.close(); this.watcher = null; }
}
module.exports = TemplateCache;
