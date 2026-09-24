const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U046/U047: Compra no muestra textos de ayuda decorativos debajo de sus inputs', () => {
  const form = read('public/js/pages/purchase-form.js');
  assert.doesNotMatch(form, /help:\s*'Ej\.: si una caja/);
  assert.doesNotMatch(form, /help:\s*'Costo de una caja/);
  assert.doesNotMatch(form, /help:\s*'Opcional\.'/);
  assert.match(form, /Vencimiento \(opcional\)/);
  assert.match(form, /app-sr-only/);
});

test('U046/U047: ubicación usa grid y span global sin bloque resumen', () => {
  const form = read('public/js/pages/purchase-form.js');
  const css = read('public/css/components/forms.css');
  assert.match(form, /app-form-grid--3/);
  assert.match(form, /app-field--span-2/);
  assert.doesNotMatch(form, /app-form-summary|renderPreview|Entrará al stock/);
  assert.doesNotMatch(css, /\.app-form-summary/);
});

test('U046/U047: forms.css no conserva clases visuales específicas de Compra', () => {
  const css = read('public/css/components/forms.css');
  assert.doesNotMatch(css, /app-form-grid--purchase|app-field--purchase-product|app-field-action-row/);
});
