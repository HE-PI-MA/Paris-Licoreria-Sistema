/** U043: contrato único para modales, formularios, detalles, tablas y escáner responsive. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('U043: Modal sigue siendo la única estructura de diálogo y clasifica contenido global', () => {
  const modal = read('public/js/components/modal.js');
  assert.match(modal, /class Modal/);
  assert.match(modal, /class Confirm/);
  assert.match(modal, /new Modal\(\{/);
  assert.match(modal, /classifyContent\(\)/);
  for (const token of ['app-modal--form', 'app-modal--detail', 'app-modal--table', 'app-modal--scanner']) assert.match(modal, new RegExp(token));
  assert.match(modal, /this\.body\.querySelector\('\.app-scanner'\)/);
  assert.match(modal, /this\.body\.querySelector\('form'\)/);
  assert.match(modal, /this\.body\.querySelector\('\.app-record-details'\)/);
  assert.match(modal, /this\.body\.querySelector\('\.app-data-table'\)/);

  const files = [
    'public/js/components/catalog-form.js', 'public/js/components/filter-bar.js', 'public/js/components/barcode-reader.js',
    'public/js/pages/products.js', 'public/js/pages/suppliers.js', 'public/js/pages/purchase-view.js',
    'public/js/pages/inventory-view.js', 'public/js/pages/sales.js', 'public/js/pages/cash.js', 'public/js/pages/users.js'
  ];
  assert.ok(files.some(file => read(file).includes('new UI.Modal')));
  for (const file of files) assert.doesNotMatch(read(file), /createElement\(['"]dialog['"]\)|UI\.element\(['"]dialog['"]/);
});

test('U043: header, body y footer comparten responsive real sin perder scroll ni acciones', () => {
  const css = read('public/css/components/modal.css');
  assert.match(css, /\.app-modal-header,[\s\S]*\.app-modal-footer[\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /\.app-modal-body\s*\{[\s\S]*overflow-x:\s*hidden[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /@media \(max-width:\s*40rem\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 12px\)/);
  assert.match(css, /\.app-modal-footer > \.app-form-total[\s\S]*flex:\s*1 1 100%/);
  assert.match(css, /\.app-modal-footer > \.app-button[\s\S]*flex:\s*1 1 8rem/);
  assert.match(css, /@media \(max-width:\s*25rem\)[\s\S]*\.app-modal:not\(\.app-modal--small\)[\s\S]*height:\s*100dvh/);
  assert.match(css, /\.app-modal--small[\s\S]*calc\(100vw - 20px\)/);
});

test('U043: formularios, detalles, tablas y escáner se adaptan dentro del mismo modal', () => {
  const forms = read('public/css/components/forms.css');
  const details = read('public/css/components/record-details.css');
  const modal = read('public/css/components/modal.css');
  const media = read('public/css/components/media.css');

  assert.match(forms, /@media \(max-width:\s*40rem\)[\s\S]*\.app-form-grid,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(forms, /\.app-form-toolbar[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(details, /@media \(max-width:\s*40rem\)[\s\S]*\.app-record-detail,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(modal, /\.app-modal--table \.app-data-table--fit \.app-table-scroll[\s\S]*42dvh/);
  assert.match(media, /\.app-scanner-preview, \.app-scanner-video \{ max-height:\s*min\(56dvh, 30rem\); \}/);
  assert.match(media, /\.app-scanner \.app-section-toolbar[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});
