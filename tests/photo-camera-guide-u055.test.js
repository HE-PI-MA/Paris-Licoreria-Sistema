const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

function classBlock(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0, 'No se encontró ' + from);
  assert.ok(end > start, 'No se encontró el final de ' + from);
  return source.slice(start, end);
}

test('U055 v3: Tomar foto abre cámara propia con guía cuadrada', () => {
  const js = read('public/js/components/product-photo.js');
  const camera = classBlock(js, 'class PhotoCamera', 'class ProductPhoto');
  assert.match(camera, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(camera, /facingMode:\s*\{ ideal:\s*'environment' \}/);
  assert.match(camera, /app-photo-camera-guide/);
  assert.match(camera, /Coloca el producto dentro del cuadrado/);
});

test('U055 v3: captura cámara como cuadrado central', () => {
  const js = read('public/js/components/product-photo.js');
  const camera = classBlock(js, 'class PhotoCamera', 'class ProductPhoto');
  assert.match(camera, /const side = Math\.min\(width, height\)/);
  assert.match(camera, /const sourceX = \(width - side\) \/ 2/);
  assert.match(camera, /const sourceY = \(height - side\) \/ 2/);
  assert.match(camera, /canvas\.width = side/);
  assert.match(camera, /canvas\.height = side/);
  assert.match(camera, /context\.drawImage\(\s*this\.video,\s*sourceX,\s*sourceY,\s*side,\s*side,\s*0,\s*0,\s*side,\s*side\s*\)/);
});

test('U055 v3: captura usa el mismo PhotoField.choose', () => {
  const js = read('public/js/components/product-photo.js');
  assert.match(js, /onCapture:\s*file => this\.choose\(file\)/);
  assert.match(js, /const photo = await ImageFile\.photo\(file\)/);
});

test('U055 v3: elegir foto y respaldo nativo continúan disponibles', () => {
  const js = read('public/js/components/product-photo.js');
  assert.match(js, /chooseInput\.click\(\)/);
  assert.match(js, /captureInput\.setAttribute\('capture', 'environment'\)/);
  assert.match(js, /if \(PhotoCamera\.available\(\)\)/);
  assert.match(js, /captureInput\.click\(\)/);
});

test('U055 v3: guía se alinea al área real visible del video', () => {
  const js = read('public/js/components/product-photo.js');
  const css = read('public/css/components/media.css');
  assert.match(js, /displayedVideoRect\(\)/);
  assert.match(js, /rect\.left \+ \(rect\.width - side\) \/ 2/);
  assert.match(js, /rect\.top \+ \(rect\.height - side\) \/ 2/);
  const guide = css.match(/\.app-photo-camera-guide\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(guide, /border:/);
  assert.match(guide, /box-shadow:/);
});
