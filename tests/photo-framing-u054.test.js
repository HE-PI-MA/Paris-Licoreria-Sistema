const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('U054/U055: fotos normales se muestran completas, sin recorte visual forzado', () => {
  const css = read('public/css/components/media.css');
  const tablePhoto = css.match(/\.app-product-photo > img\s*\{([^}]*)\}/)?.[1] || '';
  const previewPhoto = css.match(/\.app-photo-preview > img\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(tablePhoto, /object-fit:\s*contain/);
  assert.doesNotMatch(tablePhoto, /object-fit:\s*cover/);
  assert.match(previewPhoto, /object-fit:\s*contain/);
  assert.doesNotMatch(previewPhoto, /object-fit:\s*cover/);
});

test('U054/U055: marcos globales siguen siendo cuadrados', () => {
  const css = read('public/css/components/media.css');
  assert.match(css, /\.app-product-photo\s*\{[^}]*width:\s*42px;[^}]*height:\s*42px;/);
  assert.match(css, /\.app-product-photo--large\s*\{[^}]*width:\s*112px;[^}]*height:\s*112px;/);
  assert.match(css, /\.app-photo-preview\s*\{[^}]*width:\s*112px;[^}]*height:\s*112px;/);
});

test('U054/U055: preparación y envío habituales siguen intactos', () => {
  const js = read('public/js/components/product-photo.js');
  assert.match(js, /static async canvas\(file, maxSide = 768\)/);
  assert.match(js, /static async photo\(file\)/);
  assert.match(js, /const photo = await ImageFile\.photo\(file\)/);
  assert.match(js, /this\.value = photo/);
  assert.match(js, /payload\(\)/);
});
