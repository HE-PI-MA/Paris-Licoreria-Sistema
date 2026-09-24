const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('U044: Nueva compra contiene solo datos propios de compra', () => {
  const form = read('public/js/pages/purchase-form.js');
  for (const forbidden of ['supplierText','phone','observation','unitId','this.price','this.barcode','lotCode','PhotoField']) {
    assert.equal(form.includes(forbidden), false, forbidden);
  }
  for (const required of ['Nombre del producto','Categoría','¿Cómo llegó?','¿Cuánto trae?','Cantidad comprada','Costo de compra (Bs)','Vencimiento','Ubicación de ingreso']) {
    assert.equal(form.includes(required), true, required);
  }
  assert.match(form, /new UI\.BarcodeField/);
});

test('U044: lote automático y compra separada de presentación de venta', () => {
  const repo = read('src/repositories/PurchaseRepository.js');
  const input = read('src/domain/PurchaseInput.js');
  assert.match(repo, /id_producto,id_presentacion,forma_ingreso,factor_ingreso/);
  assert.match(repo, /'L-' \+ String\(detail\.insertId\)\.padStart\(6, '0'\)/);
  assert.doesNotMatch(input, /supplier|observation|presentation|lotCode|barcode|photo|price/);
});

test('U044: el esquema raíz y el bootstrap conservan la separación', () => {
  const tables = read('database/bootstrap/01_tablas_v2.sql');
  const routines = read('database/bootstrap/03_rutinas_v2.sql');
  const views = read('database/bootstrap/04_vistas_v2.sql');
  const installer = read('scripts/setup-database.js');
  assert.match(tables, /id_producto INT UNSIGNED NULL/);
  assert.match(tables, /forma_ingreso VARCHAR\(80\) NULL/);
  assert.match(tables, /factor_ingreso DECIMAL\(15,3\) NULL/);
  assert.match(routines, /dc\.factor_ingreso/);
  assert.match(routines, /dc\.id_producto\s*=\s*v_id_producto/);
  assert.match(routines, /SELECT dc\.id_producto,\s*lu\.cantidad_actual,\s*lp\.fecha_vencimiento/);
  assert.doesNotMatch(routines, /pp\.id_presentacion\s*=\s*dc\.id_presentacion[\s\S]{0,160}NEW\.id_lote_ubicacion/);
  assert.match(views, /JOIN producto p ON p\.id_producto\s*=\s*dc\.id_producto/);
  assert.match(installer, /PurchasesU044Setup/);
});

test('U044: etiquetas globales de formulario no agregan asterisco automático', () => {
  const form = read('public/js/components/catalog-form.js');
  assert.doesNotMatch(form, /required \? ' \*'/);
});
