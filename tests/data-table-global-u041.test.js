/** U041/U042: contrato visual y estructural de la tabla global compartida. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('U041: la tabla global usa superficie limpia, cabecera oscura y acento dorado', () => {
  const css = read('public/css/components/data-table.css');
  assert.match(css, /\.app-table-scroll\s*\{[\s\S]*background:\s*var\(--app-surface\)/);
  assert.match(css, /\.app-table th\s*\{[\s\S]*background:\s*var\(--app-black-soft\)/);
  assert.match(css, /border-bottom:\s*2px solid var\(--app-gold-500\)/);
  assert.doesNotMatch(css, /background:\s*#e7e0d4/);
});

test('U041/U042: números y acciones mantienen jerarquía clara sin detalle duplicado', () => {
  const css = read('public/css/components/data-table.css');
  const js = read('public/js/components/data-table.js');
  assert.match(css, /\.app-table \.app-table-number\s*\{[\s\S]*text-align:\s*right/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.app-table-actions-cell\s*\{/);
  assert.doesNotMatch(css, /\.app-table-details-toggle|\.app-table-details\b/);
  assert.match(js, /UI\.element\('th', 'app-table-actions-cell', 'Acciones'\)/);
  assert.match(js, /UI\.element\('td', 'app-table-actions-cell'\)/);
});

test('U042: conserva prioridades, elimina Ver más y oculta N.º en móvil desde DataTable', () => {
  const css = read('public/css/components/data-table.css');
  const js = read('public/js/components/data-table.js');
  assert.match(js, /\[0, 520, 780, 1100\]/);
  assert.match(js, /sequenceVisible/);
  assert.match(js, /width >= 520/);
  assert.doesNotMatch(js, /Ver más|Ver menos|data-table-details|toggleDetails/);
  assert.match(css, /@media \(max-width:\s*40rem\)/);
  assert.doesNotMatch(css, /\.app-table-details-toggle|\.app-table-details\b/);
});
