const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U047/U051: elimina el resumen intermedio de stock y subtotal de Nueva compra', () => {
  const form = read('public/js/pages/purchase-form.js');
  assert.doesNotMatch(form, /this\.preview|renderPreview|app-form-summary/);
  assert.doesNotMatch(form, /\['Entrará al stock', base\]/);
});

test('U047/U051: ubicación queda después del vencimiento y ocupa dos columnas', () => {
  const form = read('public/js/pages/purchase-form.js');
  const expiry = form.indexOf("this.expiry = this.field('expiresOn'");
  const location = form.indexOf('this.location = this.lookupLocation()', expiry);
  const productHost = form.indexOf("const productHost = this.product.select.closest('.app-field')", expiry);

  assert.ok(expiry >= 0 && location > expiry && productHost > location);
  assert.match(form, /this\.location\.select\.closest\('\.app-field'\)\.classList\.add\('app-field--span-2'\)/);
});

test('U047/U051: total general permanece en footer y cálculos de filas no cambian', () => {
  const form = read('public/js/pages/purchase-form.js');
  assert.match(form, /this\.total = UI\.element\('output', 'app-form-total', 'Total: Bs 0,00'\)/);
  assert.match(form, /baseQuantity = UI\.Decimal\.multiply\(quantity, factor, 3\)/);
  assert.match(form, /subtotal: UI\.Decimal\.multiply\(quantity, cost, 2\)/);
});
