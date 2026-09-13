/** Reglas de Proveedores: validación, versiones, reintentos y eliminación solo cuando no tiene compras. */
const crypto = require('node:crypto');
const Input = require('../domain/SupplierInput');
const { RecordError } = require('../domain/RecordInput');
class SupplierService {
  constructor(repository) { this.repository = repository; }
  required(row) { if (!row) throw new RecordError(404, 'El proveedor ya no existe. Actualiza el listado.'); return row; }
  async current(c, id, version) {
    const row = this.required(await this.repository.get(id, c, true));
    if (row.version !== version) throw new RecordError(409, 'Otra operación modificó este proveedor. Cierra y vuelve a abrir el registro para revisar los datos actuales.');
    return row;
  }
  list(query) { return this.repository.list(Input.list(query)); }
  async detail(id) { return this.required(await this.repository.get(Input.id(id))); }
  async perform(actor, key, command, payload, operation) {
    const metadata = { userId: Input.id(actor), key: Input.key(key), hash: crypto.createHash('sha256').update(JSON.stringify([command, payload])).digest('hex') };
    try { return await this.repository.write(metadata, operation); }
    catch (error) {
      if (error instanceof RecordError) throw error;
      if (error.code === 'ER_DUP_ENTRY') throw new RecordError(409, 'Ya existe un proveedor con ese NIT.', { nit: 'Este NIT ya está registrado. Busca el proveedor existente.' });
      if (['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) throw new RecordError(409, 'El proveedor tiene información relacionada y no puede eliminarse. Puedes desactivarlo.');
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new RecordError(409, 'Otra operación está usando el proveedor. Espera un momento y vuelve a intentarlo.');
      throw error;
    }
  }
  create(actor, key, body) {
    const data = Input.supplier(body);
    return this.perform(actor, key, 'supplier:create', data, c => this.repository.insert(c, data));
  }
  update(actor, key, id, body) {
    id = Input.id(id); const data = Input.supplier(body, true), version = Input.version(body.version);
    return this.perform(actor, key, 'supplier:update:' + id, { ...data, version }, async c => {
      await this.current(c, id, version); return this.repository.update(c, id, data);
    });
  }
  state(actor, key, id, body) {
    id = Input.id(id); Input.body(body, ['state', 'version']); const state = Input.state(body.state), version = Input.version(body.version);
    return this.perform(actor, key, 'supplier:state:' + id, { state, version }, async c => {
      await this.current(c, id, version); return this.repository.state(c, id, state);
    });
  }
  remove(actor, key, id, body) {
    id = Input.id(id); Input.body(body, ['version']); const version = Input.version(body.version);
    return this.perform(actor, key, 'supplier:delete:' + id, { version }, async c => {
      await this.current(c, id, version);
      if (await this.repository.used(c, id)) throw new RecordError(409, 'El proveedor tiene compras registradas. Se conserva su historial; puedes desactivarlo.');
      return this.repository.remove(c, id);
    });
  }
}
module.exports = SupplierService;
