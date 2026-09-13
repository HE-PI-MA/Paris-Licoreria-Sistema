/** Acceso SQL al catálogo: consultas paginadas, transacciones y bloqueo de productos/presentaciones; nunca modifica existencias ni historial. */
const crypto = require('node:crypto');
const OperationStore = require('./OperationStore');
const { ProductError } = require('../domain/ProductInput');
class ProductRepository {
  static productFields = 'p.id_producto AS id, p.nombre AS name, p.id_categoria AS categoryId, p.id_unidad_medida AS unitId, p.descripcion AS description, p.stock_minimo AS minimum, p.estado AS state';
  static presentationFields = 'pp.id_presentacion AS id, pp.id_producto AS productId, pp.nombre_presentacion AS name, pp.factor_conversion AS factor, pp.codigo_barras AS barcode, pp.precio_venta AS price, pp.estado AS state';
  constructor(pool) { this.pool = pool; this.operations = new OperationStore(pool); }
  /** La versión refleja solo los campos editables; el stock no provoca conflictos de formulario. */
  version(row, presentation = false) {
    const keys = presentation ? ['id', 'productId', 'name', 'factor', 'barcode', 'price', 'state'] : ['id', 'name', 'categoryId', 'unitId', 'description', 'minimum', 'state'];
    return crypto.createHash('sha256').update(JSON.stringify(keys.map(key => row[key] == null ? null : String(row[key])))).digest('hex');
  }
  decorate(row, presentation = false) { return row && { ...row, version: this.version(row, presentation) }; }
  search(term) { return '%' + term.replace(/[!%_]/g, char => '!' + char) + '%'; }
  async list(input) {
    const conditions = [], args = [];
    if (input.term) { conditions.push("(p.nombre LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM presentacion_producto b WHERE b.id_producto=p.id_producto AND b.codigo_barras LIKE ? ESCAPE '!'))"); args.push(this.search(input.term), this.search(input.term)); }
    if (input.state) { conditions.push('p.estado=?'); args.push(input.state); }
    if (input.categoryId) { conditions.push('p.id_categoria=?'); args.push(input.categoryId); }
    if (input.lowStock) conditions.push(input.lowStock === 'SI' ? 'v.stock_disponible<=p.stock_minimo' : 'v.stock_disponible>p.stock_minimo');
    const from = ' FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria JOIN unidad_medida u ON u.id_unidad_medida=p.id_unidad_medida JOIN vw_stock_producto v ON v.id_producto=p.id_producto';
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const order = { name: 'p.nombre', category: 'c.nombre', stock: 'v.stock_disponible', minimum: 'p.stock_minimo', state: 'p.estado' }[input.sort];
    if (!order) throw new ProductError(400, 'Orden no permitido.');
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [[count]] = await c.query('SELECT COUNT(*) AS total' + from + where, args);
      const [rows] = await c.query('SELECT ' + ProductRepository.productFields + ', c.nombre AS category, u.nombre AS unit, u.abreviatura AS abbreviation, v.stock_disponible AS stock, (SELECT COUNT(*) FROM presentacion_producto pp WHERE pp.id_producto=p.id_producto) AS presentations' + from + where + ' ORDER BY ' + order + (input.direction === 'desc' ? ' DESC' : ' ASC') + ', p.id_producto ASC LIMIT ? OFFSET ?', [...args, input.pageSize, (input.page - 1) * input.pageSize]);
      await c.commit();
      return { records: rows.map(row => this.decorate(row)), total: Number(count.total) };
    } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
  }
  async getProduct(id, c = this.pool, lock = false) {
    const [rows] = await c.query('SELECT ' + ProductRepository.productFields + ' FROM producto p WHERE p.id_producto=?' + (lock ? ' FOR UPDATE' : ''), [id]);
    return this.decorate(rows[0]);
  }
  async detail(id) {
    const [rows] = await this.pool.query('SELECT ' + ProductRepository.productFields + ', c.nombre AS category, c.estado AS categoryState, u.nombre AS unit, u.abreviatura AS abbreviation, v.stock_disponible AS stock, v.stock_fisico AS physicalStock, (SELECT COUNT(*) FROM presentacion_producto pp WHERE pp.id_producto=p.id_producto) AS presentations FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria JOIN unidad_medida u ON u.id_unidad_medida=p.id_unidad_medida JOIN vw_stock_producto v ON v.id_producto=p.id_producto WHERE p.id_producto=?', [id]);
    return this.decorate(rows[0]);
  }
  async options(kind, input) {
    const category = kind === 'categories';
    const table = category ? 'categoria' : 'unidad_medida', id = category ? 'id_categoria' : 'id_unidad_medida';
    const condition = (category ? "estado='ACTIVO' AND " : '') + "nombre LIKE ? ESCAPE '!'";
    const args = [this.search(input.term)];
    const [[count]] = await this.pool.query('SELECT COUNT(*) AS total FROM ' + table + ' WHERE ' + condition, args);
    const [rows] = await this.pool.query('SELECT ' + id + ' AS value, nombre AS label' + (category ? '' : ', abreviatura AS abbreviation') + ' FROM ' + table + ' WHERE ' + condition + ' ORDER BY nombre, ' + id + ' LIMIT ? OFFSET ?', [...args, input.pageSize, (input.page - 1) * input.pageSize]);
    return { options: rows.map(row => ({ value: String(row.value), label: row.label + (row.abbreviation ? ' (' + row.abbreviation + ')' : '') })), total: Number(count.total) };
  }
  async presentations(productId, input) {
    const where = ' WHERE pp.id_producto=?' + (input.term ? " AND pp.nombre_presentacion LIKE ? ESCAPE '!'" : '');
    const args = [productId, ...(input.term ? [this.search(input.term)] : [])];
    const [[count]] = await this.pool.query('SELECT COUNT(*) AS total FROM presentacion_producto pp' + where, args);
    const order = { name: 'pp.nombre_presentacion', price: 'pp.precio_venta', factor: 'pp.factor_conversion', state: 'pp.estado' }[input.sort];
    if (!order) throw new ProductError(400, 'Orden no permitido.');
    const [rows] = await this.pool.query('SELECT ' + ProductRepository.presentationFields + ', (EXISTS(SELECT 1 FROM detalle_compra dc WHERE dc.id_presentacion=pp.id_presentacion) OR EXISTS(SELECT 1 FROM detalle_venta dv WHERE dv.id_presentacion=pp.id_presentacion)) AS used FROM presentacion_producto pp' + where + ' ORDER BY ' + order + (input.direction === 'desc' ? ' DESC' : ' ASC') + ', pp.id_presentacion LIMIT ? OFFSET ?', [...args, input.pageSize, (input.page - 1) * input.pageSize]);
    return { records: rows.map(row => this.decorate(row, true)), total: Number(count.total) };
  }
  /** Consulta por clave exacta; no depende del orden ni de la página del listado. */
  async presentationDetail(productId, id) {
    const row = await this.getPresentation(productId, id);
    if (!row) return null;
    const [rows] = await this.pool.query(`SELECT
      EXISTS(SELECT 1 FROM detalle_compra WHERE id_presentacion = ?) OR
      EXISTS(SELECT 1 FROM detalle_venta WHERE id_presentacion = ?) AS used`, [id, id]);
    return { ...row, used: Boolean(rows[0].used) };
  }
  async getPresentation(productId, id, c = this.pool, lock = false) {
    const [rows] = await c.query('SELECT ' + ProductRepository.presentationFields + ' FROM presentacion_producto pp WHERE pp.id_producto=? AND pp.id_presentacion=?' + (lock ? ' FOR UPDATE' : ''), [productId, id]);
    return this.decorate(rows[0], true);
  }
  async lockPresentations(c, productId) {
    const [rows] = await c.query('SELECT id_presentacion AS id FROM presentacion_producto WHERE id_producto=? ORDER BY id_presentacion FOR UPDATE', [productId]);
    return rows;
  }
  async used(c, presentationId) {
    // Lecturas actuales con bloqueo: no tomar una instantánea anterior al último movimiento.
    const [purchases] = await c.query('SELECT id_detalle_compra FROM detalle_compra WHERE id_presentacion=? LIMIT 1 FOR SHARE', [presentationId]);
    if (purchases.length) return true;
    const [sales] = await c.query('SELECT id_detalle_venta FROM detalle_venta WHERE id_presentacion=? LIMIT 1 FOR SHARE', [presentationId]);
    return sales.length > 0;
  }
  async category(c, id) { const [[row]] = await c.query('SELECT estado AS state FROM categoria WHERE id_categoria=? FOR SHARE', [id]); return row; }
  async unit(c, id) { const [[row]] = await c.query('SELECT id_unidad_medida AS id FROM unidad_medida WHERE id_unidad_medida=? FOR SHARE', [id]); return row; }
  async insertProduct(c, v) {
    const [result] = await c.query('INSERT INTO producto (nombre,id_categoria,id_unidad_medida,descripcion,stock_minimo,estado) VALUES(?,?,?,?,?,?)', [v.name,v.categoryId,v.unitId,v.description || null,v.minimum,v.state]);
    return { id: result.insertId };
  }
  async updateProduct(c, id, v) { await c.query('UPDATE producto SET nombre=?,id_categoria=?,id_unidad_medida=?,descripcion=?,stock_minimo=?,estado=? WHERE id_producto=?', [v.name,v.categoryId,v.unitId,v.description || null,v.minimum,v.state,id]); return { id }; }
  async productState(c, id, state) { await c.query('UPDATE producto SET estado=? WHERE id_producto=?', [state,id]); return { id }; }
  async deleteProduct(c, id) { await c.query('DELETE FROM presentacion_producto WHERE id_producto=?', [id]); await c.query('DELETE FROM producto WHERE id_producto=?', [id]); return { id, deleted: true }; }
  async insertPresentation(c, productId, v) {
    const [result] = await c.query('INSERT INTO presentacion_producto (id_producto,nombre_presentacion,factor_conversion,codigo_barras,precio_venta,estado) VALUES(?,?,?,?,?,?)', [productId,v.name,v.factor,v.barcode,v.price,v.state]); return { id: result.insertId };
  }
  async updatePresentation(c, productId, id, v) { await c.query('UPDATE presentacion_producto SET nombre_presentacion=?,factor_conversion=?,codigo_barras=?,precio_venta=?,estado=? WHERE id_producto=? AND id_presentacion=?', [v.name,v.factor,v.barcode,v.price,v.state,productId,id]); return { id }; }
  async presentationState(c, productId, id, state) { await c.query('UPDATE presentacion_producto SET estado=? WHERE id_producto=? AND id_presentacion=?', [state,productId,id]); return { id }; }
  async deletePresentation(c, productId, id) { await c.query('DELETE FROM presentacion_producto WHERE id_producto=? AND id_presentacion=?', [productId,id]); return { id, deleted: true }; }
  write(metadata, operation) { return this.operations.write(metadata, operation); }
}
module.exports = ProductRepository;
