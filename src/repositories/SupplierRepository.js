/** Consultas de Proveedores y protección del historial de compras; nunca escribe existencias, compras ni ventas. */
const crypto = require('node:crypto');
const OperationStore = require('./OperationStore');
const { RecordError } = require('../domain/RecordInput');
class SupplierRepository {
  static fields = 'p.id_proveedor AS id, p.nombre AS name, p.contacto AS contact, p.telefono AS phone, p.direccion AS address, p.nit AS nit, p.estado AS state';
  constructor(pool) { this.pool = pool; this.operations = new OperationStore(pool); }
  decorate(row) {
    if (!row) return null;
    const values = ['id', 'name', 'contact', 'phone', 'address', 'nit', 'state'].map(key => row[key] == null ? null : String(row[key]));
    return { ...row, version: crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex') };
  }
  async list(input) {
    const clauses = [], args = [];
    if (input.term) {
      const term = '%' + input.term.replace(/[!%_]/g, char => '!' + char) + '%';
      clauses.push("(p.nombre LIKE ? ESCAPE '!' OR p.contacto LIKE ? ESCAPE '!' OR p.telefono LIKE ? ESCAPE '!' OR p.nit LIKE ? ESCAPE '!')");
      args.push(term, term, term, term);
    }
    if (input.state) { clauses.push('p.estado=?'); args.push(input.state); }
    const from = ' FROM proveedor p' + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '');
    const order = { name: 'p.nombre', contact: 'p.contacto', phone: 'p.telefono', state: 'p.estado' }[input.sort];
    if (!order) throw new RecordError(400, 'Orden no permitido.');
    const c = await this.pool.getConnection();
    try {
      // Total y filas se leen en la misma transacción para mantener un listado coherente.
      await c.beginTransaction();
      const [[count]] = await c.query('SELECT COUNT(*) AS total' + from, args);
      const [rows] = await c.query('SELECT ' + SupplierRepository.fields + from + ' ORDER BY ' + order + (input.direction === 'desc' ? ' DESC' : ' ASC') + ', p.id_proveedor ASC LIMIT ? OFFSET ?', [...args, input.pageSize, (input.page - 1) * input.pageSize]);
      await c.commit(); return { records: rows.map(row => this.decorate(row)), total: Number(count.total) };
    } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
  }
  async get(id, c = this.pool, lock = false) {
    const [rows] = await c.query('SELECT ' + SupplierRepository.fields + ' FROM proveedor p WHERE p.id_proveedor=?' + (lock ? ' FOR UPDATE' : ''), [id]);
    return this.decorate(rows[0]);
  }
  async used(c, id) {
    // El proveedor ya está bloqueado; la FK impide una compra concurrente durante su eliminación.
    const [rows] = await c.query('SELECT id_compra FROM compra WHERE id_proveedor=? LIMIT 1 FOR SHARE', [id]);
    return rows.length > 0;
  }
  async insert(c, data) {
    const [result] = await c.query('INSERT INTO proveedor (nombre,contacto,telefono,direccion,nit,estado) VALUES(?,?,?,?,?,?)', this.values(data));
    return { id: result.insertId };
  }
  values(data) { return [data.name, data.contact || null, data.phone || null, data.address || null, data.nit, data.state]; }
  async update(c, id, data) {
    await c.query('UPDATE proveedor SET nombre=?,contacto=?,telefono=?,direccion=?,nit=?,estado=? WHERE id_proveedor=?', [...this.values(data), id]); return { id };
  }
  async state(c, id, state) { await c.query('UPDATE proveedor SET estado=? WHERE id_proveedor=?', [state, id]); return { id }; }
  async remove(c, id) { await c.query('DELETE FROM proveedor WHERE id_proveedor=?', [id]); return { id, deleted: true }; }
  write(metadata, operation) { return this.operations.write(metadata, operation); }
}
module.exports = SupplierRepository;
