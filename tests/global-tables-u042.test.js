/** U042: contrato estructural de tablas globales; no usa navegador ni MySQL. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('U042: DataTable no genera Ver más y controla N.º por ancho', () => {
  const source=read('public/js/components/data-table.js');
  assert.doesNotMatch(source,/data-table-details|toggleDetails|Ver más datos de la fila/);
  assert.match(source,/sequenceVisible/);
  assert.match(source,/width >= 520/);
  assert.match(source,/visibleKeys/);
});

test('U042: no quedan tablas operativas ops-lines fuera de DataTable', () => {
  const pages=fs.readdirSync(path.join(root,'public/js/pages')).filter(name=>name.endsWith('.js'));
  for(const name of pages)assert.doesNotMatch(read('public/js/pages/'+name),/ops-lines/,name);
  assert.doesNotMatch(read('public/css/components/operations.css'),/\.ops-lines/);
  assert.match(read('public/js/pages/sales.js'),/new UI\.DataTable/);
  assert.match(read('public/js/pages/reports.js'),/new UI\.DataTable/);
});

test('U042: tablas con columnas secundarias auditadas tienen detalle explícito', () => {
  assert.match(read('public/js/pages/products.js'),/Detalle de presentación/);
  assert.match(read('public/js/pages/inventory-view.js'),/detailLot/);
  assert.match(read('public/js/pages/cash.js'),/Detalle del turno de caja/);
  assert.match(read('public/js/pages/sales.js'),/Detalle del producto vendido/);
  assert.match(read('public/js/pages/reports.js'),/Detalle del cierre de caja/);
});
