/** Valida los contratos de Productos y presenta errores por campo sin depender de Express ni MySQL. */
class ProductError extends Error {
  constructor(status, message, fieldErrors = {}) { super(message); this.status = status; this.fieldErrors = fieldErrors; }
}
class ProductInput {
  static id(value, field = 'id') {
    if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 4294967295) {
      throw new ProductError(400, 'Identificador no válido.', { [field]: 'Selecciona un registro válido.' });
    }
    return Number(value);
  }
  static text(value, max, field, optional = false) {
    if (optional && (value === null || value === undefined || value === '')) return '';
    if (typeof value !== 'string' || (!optional && !value.trim()) || [...value.trim()].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new ProductError(422, 'Revisa los campos señalados.', { [field]: `Escribe ${optional ? 'hasta' : 'entre 1 y'} ${max} caracteres válidos.` });
    }
    return value.trim();
  }
  /** Mantiene el decimal como texto exacto; no redondea silenciosamente lo que se guardará en MySQL. */
  static decimal(value, scale, field, positive = false) {
    const input = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
    if (typeof input !== 'string' || !new RegExp(`^\\d{1,${15 - scale}}(?:\\.\\d{1,${scale}})?$`).test(input) || (positive && /^0+(?:\.0+)?$/.test(input))) {
      throw new ProductError(422, 'Revisa los campos señalados.', { [field]: `Introduce un número ${positive ? 'mayor que' : 'desde'} cero, con hasta ${scale} decimales.` });
    }
    const [whole, fraction = ''] = input.split('.');
    return whole.replace(/^0+(?=\d)/, '') + '.' + fraction.padEnd(scale, '0');
  }
  static state(value) {
    if (!['ACTIVO', 'INACTIVO'].includes(value)) throw new ProductError(422, 'Estado no válido.', { state: 'Selecciona Activo o Inactivo.' });
    return value;
  }
  static body(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
      throw new ProductError(400, 'El formulario contiene campos no permitidos.');
    }
    return value;
  }
  static version(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ProductError(409, 'Vuelve a abrir el registro para obtener su versión actual.');
    return value;
  }
  static product(body, update = false) {
    this.body(body, ['name', 'categoryId', 'unitId', 'description', 'minimum', 'state', ...(update ? ['version'] : [])]);
    return { name: this.text(body.name, 120, 'name'), categoryId: this.id(body.categoryId, 'categoryId'), unitId: this.id(body.unitId, 'unitId'),
      description: this.text(body.description, 255, 'description', true), minimum: this.decimal(body.minimum, 3, 'minimum'), state: this.state(body.state) };
  }
  static presentation(body, update = false) {
    this.body(body, ['name', 'factor', 'barcode', 'price', 'state', ...(update ? ['version'] : [])]);
    return { name: this.text(body.name, 80, 'name'), factor: this.decimal(body.factor, 3, 'factor', true),
      barcode: this.text(body.barcode, 50, 'barcode', true) || null, price: this.decimal(body.price, 2, 'price'), state: this.state(body.state) };
  }
  static page(query, columns = ['name']) {
    const positive = (value, fallback, max) => {
      if (value === undefined || value === '') return fallback;
      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new ProductError(400, 'Paginación no válida.');
      return Number(value);
    };
    const term = query.term === undefined ? '' : this.text(query.term, 120, 'term', true);
    const sort = query.sort === undefined || query.sort === '' ? 'name' : query.sort;
    const direction = query.direction === undefined ? 'asc' : query.direction;
    if (!columns.includes(sort) || !['asc', 'desc'].includes(direction)) throw new ProductError(400, 'Orden no permitido.');
    const state = query.state === undefined || query.state === '' ? '' : this.state(query.state);
    if (query.lowStock !== undefined && !['', 'SI', 'NO'].includes(query.lowStock)) throw new ProductError(400, 'Filtro de stock no válido.');
    return { page: positive(query.page, 1, 100000), pageSize: positive(query.pageSize, 10, 100), term, sort, direction, state,
      categoryId: query.categoryId === undefined || query.categoryId === '' ? null : this.id(query.categoryId, 'categoryId'), lowStock: query.lowStock || '' };
  }
  static key(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
      throw new ProductError(400, 'No se recibió un identificador válido para el guardado. Recarga el módulo.');
    }
    return value.toLowerCase();
  }
}
module.exports = { ProductInput, ProductError };
