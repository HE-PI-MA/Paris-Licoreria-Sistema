/** Validaciones y errores compartidos por catálogos; no depende de HTTP ni de SQL. */
class RecordError extends Error {
  constructor(status, message, fieldErrors = {}) { super(message); this.status = status; this.fieldErrors = fieldErrors; }
}
class RecordInput {
  static id(value, field = 'id') {
    if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 4294967295) {
      throw new RecordError(400, 'Identificador no válido.', { [field]: 'Selecciona un registro válido.' });
    }
    return Number(value);
  }
  static text(value, max, field, optional = false) {
    if (optional && (value === null || value === undefined || value === '')) return '';
    if (typeof value !== 'string' || (!optional && !value.trim()) || [...value.trim()].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new RecordError(422, 'Revisa los campos señalados.', { [field]: `Escribe ${optional ? 'hasta' : 'entre 1 y'} ${max} caracteres válidos.` });
    }
    return value.trim();
  }
  static state(value) {
    if (!['ACTIVO', 'INACTIVO'].includes(value)) throw new RecordError(422, 'Estado no válido.', { state: 'Selecciona Activo o Inactivo.' });
    return value;
  }
  static body(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
      throw new RecordError(400, 'El formulario contiene campos no permitidos.');
    }
    return value;
  }
  static version(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new RecordError(409, 'Vuelve a abrir el registro para obtener su versión actual.');
    return value;
  }
  static key(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
      throw new RecordError(400, 'No se recibió un identificador válido para el guardado. Recarga el módulo.');
    }
    return value.toLowerCase();
  }
  static page(query, columns = ['name']) {
    const positive = (value, fallback, max) => {
      if (value === undefined || value === '') return fallback;
      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new RecordError(400, 'Paginación no válida.');
      return Number(value);
    };
    const term = query.term === undefined ? '' : this.text(query.term, 120, 'term', true);
    const sort = query.sort === undefined || query.sort === '' ? 'name' : query.sort;
    const direction = query.direction === undefined ? 'asc' : query.direction;
    if (!columns.includes(sort) || !['asc', 'desc'].includes(direction)) throw new RecordError(400, 'Orden no permitido.');
    const state = query.state === undefined || query.state === '' ? '' : this.state(query.state);
    return { page: positive(query.page, 1, 100000), pageSize: positive(query.pageSize, 10, 100), term, sort, direction, state };
  }
}
module.exports = { RecordInput, RecordError };
