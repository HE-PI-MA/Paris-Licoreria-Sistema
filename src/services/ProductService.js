/** Reglas del catálogo: valida datos, versiones e historial; coordina el repositorio dentro de una transacción por escritura. */
const crypto = require('node:crypto');
const { ProductInput: Input, ProductError } = require('../domain/ProductInput');
class ProductService {
  constructor(repository) { this.repository = repository; }
  required(row) { if (!row) throw new ProductError(404, 'El registro ya no existe. Actualiza el listado.'); return row; }
  version(row, token) {
    if (row.version !== Input.version(token)) throw new ProductError(409, 'Otra operación modificó este registro. Cierra y vuelve a abrir el formulario para revisar los datos actuales.');
  }
  async list(query) { return this.repository.list(Input.page(query, ['name','category','stock','minimum','state'])); }
  async options(kind, query) { return this.repository.options(kind, Input.page(query)); }
  async detail(id) { return this.required(await this.repository.detail(Input.id(id))); }
  async presentations(id, query) { id = Input.id(id); this.required(await this.repository.getProduct(id)); return this.repository.presentations(id, Input.page(query, ['name','price','factor','state'])); }
  async presentation(id, presentationId) {
    id = Input.id(id); presentationId = Input.id(presentationId);
    this.required(await this.repository.getProduct(id));
    return this.required(await this.repository.presentationDetail(id, presentationId));
  }
  async referenceChecks(c, data, previous = null) {
    const category = await this.repository.category(c, data.categoryId);
    if (!category || (category.state !== 'ACTIVO' && (!previous || previous.categoryId !== data.categoryId || data.state === 'ACTIVO'))) {
      throw new ProductError(422, 'Selecciona una categoría activa.', { categoryId: 'La categoría no existe o está inactiva.' });
    }
    if (!await this.repository.unit(c, data.unitId)) throw new ProductError(422, 'Revisa la unidad base.', { unitId: 'Selecciona una unidad registrada.' });
  }
  async perform(actor, key, command, payload, operation) {
    const metadata = { userId: Input.id(actor), key: Input.key(key), hash: crypto.createHash('sha256').update(JSON.stringify([command, payload])).digest('hex') };
    try { return await this.repository.write(metadata, operation); }
    catch (error) {
      if (error instanceof ProductError) throw error;
      if (error.code === 'ER_DUP_ENTRY') {
        // No se publica el mensaje SQL: puede contener valores o nombres internos.
        throw new ProductError(409, 'Ya existe esa presentación o ese código de barras.', { name: 'Revisa que el nombre no esté repetido en este producto.', barcode: 'Si ingresaste un código, comprueba que no pertenezca a otra presentación.' });
      }
      if (['ER_ROW_IS_REFERENCED_2','ER_ROW_IS_REFERENCED'].includes(error.code)) throw new ProductError(409, 'Este registro tiene información relacionada y no puede eliminarse. Puedes desactivarlo.');
      if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new ProductError(409, 'Cambió un registro relacionado. Actualiza el módulo y revisa la selección.');
      if (error.code === 'ER_SIGNAL_EXCEPTION') throw new ProductError(409, 'La base protege este dato porque ya está relacionado con otras operaciones. Actualiza el registro y revisa sus presentaciones.');
      if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new ProductError(409, 'Otra operación está usando el registro. Espera un momento y vuelve a intentarlo.');
      throw error;
    }
  }
  create(actor, key, body) {
    const data = Input.product(body);
    return this.perform(actor, key, 'product:create', data, async c => {
      await this.referenceChecks(c, data);
      return this.repository.insertProduct(c, data);
    });
  }
  update(actor, key, id, body) {
    id = Input.id(id); const data = Input.product(body, true), version = Input.version(body.version);
    return this.perform(actor, key, 'product:update:' + id, { ...data, version }, async c => {
      const previous = this.required(await this.repository.getProduct(id, c, true)); this.version(previous, version);
      const presentations = await this.repository.lockPresentations(c, id);
      if (presentations.length && data.unitId !== previous.unitId) throw new ProductError(409, 'La unidad base está protegida.', { unitId: 'No puede cambiarse mientras el producto tenga presentaciones.' });
      await this.referenceChecks(c, data, previous);
      return this.repository.updateProduct(c, id, data);
    });
  }
  state(actor, key, id, body) {
    id = Input.id(id); Input.body(body, ['state','version']); const state = Input.state(body.state), version = Input.version(body.version);
    return this.perform(actor, key, 'product:state:' + id, { state, version }, async c => {
      const row = this.required(await this.repository.getProduct(id, c, true)); this.version(row, version);
      if (state === 'ACTIVO') await this.referenceChecks(c, { ...row, state }, row);
      return this.repository.productState(c, id, state);
    });
  }
  remove(actor, key, id, body) {
    id = Input.id(id); Input.body(body, ['version']); const version = Input.version(body.version);
    return this.perform(actor, key, 'product:delete:' + id, { version }, async c => {
      const row = this.required(await this.repository.getProduct(id, c, true)); this.version(row, version);
      const presentations = await this.repository.lockPresentations(c, id);
      for (const item of presentations) if (await this.repository.used(c, item.id)) {
        throw new ProductError(409, 'El producto tiene historial de compras o ventas. Se conserva; puedes desactivarlo.');
      }
      // Las presentaciones sin uso se eliminan junto al producto, o se revierte todo si falla.
      return this.repository.deleteProduct(c, id);
    });
  }
  savePresentation(actor, key, productId, id, body) {
    productId = Input.id(productId); if (id !== null) id = Input.id(id);
    const data = Input.presentation(body, id !== null), version = id === null ? null : Input.version(body.version);
    return this.perform(actor, key, 'presentation:' + productId + ':' + (id || 'create'), { ...data, version }, async c => {
      const parent = this.required(await this.repository.getProduct(productId, c, true));
      if (id === null) {
        if (parent.state !== 'ACTIVO') throw new ProductError(409, 'Activa el producto antes de agregar presentaciones.');
        return this.repository.insertPresentation(c, productId, data);
      }
      const previous = this.required(await this.repository.getPresentation(productId, id, c, true)); this.version(previous, version);
      if (data.factor !== previous.factor && await this.repository.used(c, id)) throw new ProductError(409, 'La equivalencia está protegida.', { factor: 'Ya existen compras o ventas con esta presentación; conserva su equivalencia.' });
      if (data.state === 'ACTIVO' && previous.state !== 'ACTIVO' && parent.state !== 'ACTIVO') throw new ProductError(409, 'Activa primero el producto para activar esta presentación.');
      return this.repository.updatePresentation(c, productId, id, data);
    });
  }
  presentationState(actor, key, productId, id, body) {
    productId = Input.id(productId); id = Input.id(id); Input.body(body, ['state','version']); const state = Input.state(body.state), version = Input.version(body.version);
    return this.perform(actor, key, 'presentation:state:' + productId + ':' + id, { state, version }, async c => {
      const parent = this.required(await this.repository.getProduct(productId, c, true));
      const row = this.required(await this.repository.getPresentation(productId, id, c, true)); this.version(row, version);
      if (state === 'ACTIVO' && parent.state !== 'ACTIVO') throw new ProductError(409, 'Activa primero el producto para activar esta presentación.');
      return this.repository.presentationState(c, productId, id, state);
    });
  }
  removePresentation(actor, key, productId, id, body) {
    productId = Input.id(productId); id = Input.id(id); Input.body(body, ['version']); const version = Input.version(body.version);
    return this.perform(actor, key, 'presentation:delete:' + productId + ':' + id, { version }, async c => {
      this.required(await this.repository.getProduct(productId, c, true));
      const row = this.required(await this.repository.getPresentation(productId, id, c, true)); this.version(row, version);
      if (await this.repository.used(c, id)) throw new ProductError(409, 'La presentación tiene historial de compras o ventas. Puedes desactivarla.');
      return this.repository.deletePresentation(c, productId, id);
    });
  }
}
module.exports = ProductService;
