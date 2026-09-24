/** U040: contrato del escáner visual compartido y su integración con Ventas. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('U040: cámara directa, overlay, beep y vibración son globales', () => {
  const file = read('public/js/components/barcode-reader.js');
  assert.match(file, /void this\.camera\(\)/);
  assert.match(file, /getResultPoints/);
  assert.match(file, /app-scanner-overlay/);
  assert.match(file, /navigator\.vibrate/);
  assert.match(file, /createOscillator/);
  assert.match(file, /Código detectado:/);
  assert.match(file, /UPC_A/);
  assert.match(file, /facingMode/);
});

test('U040: Productos, Compras y Ventas comparten el mismo lector', () => {
  const layout = read('views/layouts/workspace.ejs');
  assert.match(layout, /\['productos', 'compras', 'ventas'\]/);
  assert.match(read('public/js/pages/product-capture.js'), /new UI\.BarcodeField/);
  assert.match(read('public/js/pages/purchase-form.js'), /new UI\.BarcodeField/);
  const sales = read('public/js/pages/sales.js');
  assert.match(sales, /new UI\.BarcodeScanner/);
  assert.match(sales, /applyBarcode/);
  assert.match(sales, /this\.addLine\(\)/);
});

test('U040: Ventas reconoce equivalencia UPC-A y EAN-13', () => {
  const file = read('src/repositories/SaleRepository.js');
  assert.match(file, /Barcode\.alternatives\(term\)/);
  assert.match(file, /codigo_barras IN/);
});

test('U040: el overlay no bloquea cámara ni controles', () => {
  const css = read('public/css/components/media.css');
  assert.match(css, /\.app-scanner-preview/);
  assert.match(css, /\.app-scanner-overlay/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /\.app-scanner-guide/);
});
