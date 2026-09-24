const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U045/U051: Nueva compra mantiene un único bloque y ubicación junto al vencimiento', () => {
  const form = read('public/js/pages/purchase-form.js');
  const data = form.indexOf("this.section('Datos de la compra'");
  const expiry = form.indexOf("this.expiry = this.field('expiresOn'", data);
  const location = form.indexOf('this.location = this.lookupLocation()', expiry);
  assert.ok(data >= 0 && expiry > data && location > expiry);
  assert.doesNotMatch(form, /this\.section\('Ubicación/);
  assert.match(form, /this\.location\.select\.closest\('\.app-field'\)\.classList\.add\('app-field--span-2'\)/);
});

test('U045/U051: Compra usa utilidades globales de formulario', () => {
  const form = read('public/js/pages/purchase-form.js');
  const css = read('public/css/components/forms.css');
  assert.match(form, /app-form-grid--3/);
  assert.match(form, /app-field--span-2/);
  assert.match(form, /app-field-control-row/);
  assert.doesNotMatch(form, /app-form-grid--purchase|app-field--purchase-product|app-field-action-row/);
  assert.match(css, /\.app-form-grid--3/);
  assert.match(css, /\.app-field--span-2/);
  assert.match(css, /\.app-field-control-row/);
});
