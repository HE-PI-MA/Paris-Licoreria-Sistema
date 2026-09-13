/** Conserva una escritura y su resultado en la misma transacción para reintentar sin duplicar datos. Compartido por Productos y Proveedores. */
const { RecordError } = require('../domain/RecordInput');
class OperationStore {
  constructor(pool) { this.pool = pool; }
  /** Guarda operación y resultado en la MISMA transacción para que un reintento no duplique una escritura confirmada. */
  async write({ userId, key, hash }, operation) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      try { await c.query('INSERT INTO catalogo_operacion (id_usuario,clave,solicitud_hash) VALUES(?,?,?)', [userId,key,hash]); }
      catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        const [[saved]] = await c.query('SELECT solicitud_hash AS hash, resultado AS result FROM catalogo_operacion WHERE id_usuario=? AND clave=? FOR UPDATE', [userId,key]);
        if (!saved || saved.hash !== hash || !saved.result) throw new RecordError(409, 'Este identificador de guardado ya fue usado con otros datos. Vuelve a abrir el formulario.');
        await c.commit();
        return typeof saved.result === 'string' ? JSON.parse(saved.result) : saved.result;
      }
      const result = await operation(c);
      await c.query('UPDATE catalogo_operacion SET resultado=? WHERE id_usuario=? AND clave=?', [JSON.stringify(result),userId,key]);
      await c.commit(); return result;
    } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
  }
}
module.exports = OperationStore;
