/** Repositorio de prueba aislado: usa OperationStore real con transacciones en memoria y nunca consulta MySQL. */
const SupplierRepository = require('../../src/repositories/SupplierRepository');
class SupplierMemoryPool {
  constructor() { this.data = { rows: [], operations: new Map(), nextId: 1, purchases: new Set() }; this.queue = Promise.resolve(); this.writes = 0; }
  async getConnection() {
    const pool = this; let unlock;
    return {
      async beginTransaction() { const previous = pool.queue; pool.queue = new Promise(r => { unlock = r; }); await previous; this.data = structuredClone(pool.data); },
      async query(sql, args) {
        const id = args[0] + ':' + args[1];
        if (sql.startsWith('INSERT INTO catalogo_operacion')) {
          if (this.data.operations.has(id)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
          this.data.operations.set(id, { hash: args[2], result: null }); return [{}];
        }
        if (sql.startsWith('SELECT solicitud_hash')) return [[this.data.operations.get(id)]];
        if (sql.startsWith('UPDATE catalogo_operacion')) { this.data.operations.get(args[1] + ':' + args[2]).result = args[0]; return [{}]; }
        throw new Error('Unexpected SQL: ' + sql);
      },
      async commit() { pool.data = this.data; }, async rollback() {}, release() { unlock?.(); }
    };
  }
}
class SupplierMemoryRepository extends SupplierRepository {
  constructor() { super(new SupplierMemoryPool()); this.failList = false; }
  async list(input) {
    if (this.failList) throw new Error('Simulated network error');
    let rows = this.pool.data.rows.filter(row => (!input.state || row.state === input.state) && [row.name,row.contact,row.phone,row.nit].some(value => String(value || '').toUpperCase().includes(input.term.toUpperCase())));
    rows = rows.slice().sort((a,b) => String(a[input.sort] || '').localeCompare(String(b[input.sort] || ''), 'es') * (input.direction === 'desc' ? -1 : 1) || a.id - b.id);
    const start = (input.page - 1) * input.pageSize;
    return { records: rows.slice(start, start + input.pageSize).map(row => this.decorate(row)), total: rows.length };
  }
  async get(id, c) { return this.decorate((c?.data || this.pool.data).rows.find(row => row.id === id)); }
  async used(c, id) { return c.data.purchases.has(id); }
  checkNit(c, id, value) { if (value && c.data.rows.some(row => row.id !== id && row.nit === value)) throw Object.assign(new Error('SQL private value'), { code: 'ER_DUP_ENTRY' }); }
  async insert(c, values) { this.checkNit(c, null, values.nit); const id = c.data.nextId++; c.data.rows.push({ ...values, id }); this.pool.writes++; return { id }; }
  async update(c, id, values) { this.checkNit(c, id, values.nit); Object.assign(c.data.rows.find(row => row.id === id), values); this.pool.writes++; return { id }; }
  async state(c, id, state) { c.data.rows.find(row => row.id === id).state = state; this.pool.writes++; return { id }; }
  async remove(c, id) { c.data.rows = c.data.rows.filter(row => row.id !== id); this.pool.writes++; return { id, deleted: true }; }
}
module.exports = { SupplierMemoryRepository };
