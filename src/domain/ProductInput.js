/** Reglas y campos específicos de Productos; reutiliza las validaciones generales del catálogo. */
const { RecordInput, RecordError: ProductError } = require('./RecordInput');

class ProductInput extends RecordInput {
  /** Mantiene el decimal como texto exacto; no redondea silenciosamente lo que se guardará en MySQL. */
  static decimal(value, scale, field, positive = false) {
    const input = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
    if (typeof input !== 'string' || !new RegExp(`^\\d{1,${15 - scale}}(?:\\.\\d{1,${scale}})?$`).test(input) || (positive && /^0+(?:\.0+)?$/.test(input))) {
      throw new ProductError(422, 'Revisa los campos señalados.', { [field]: `Introduce un número ${positive ? 'mayor que' : 'desde'} cero, con hasta ${scale} decimales.` });
    }
    const [whole, fraction = ''] = input.split('.');
    return whole.replace(/^0+(?=\d)/, '') + '.' + fraction.padEnd(scale, '0');
  }

  static product(body, update = false) {
    this.body(body, ['name', 'categoryId', 'unitId', 'description', 'minimum', 'state', 'photo', ...(update ? ['version'] : ['initialPresentation', 'categoryName'])]);

    // En un producto nuevo, los campos administrativos no necesitan mostrarse:
    // inicia activo, con stock mínimo 0 y sin descripción.
    const source = update ? body : {
      description: '',
      minimum: '0',
      state: 'ACTIVO',
      ...body
    };

    const category = update ? { categoryId: this.id(source.categoryId, 'categoryId') } : this.categoryFields(source);
    const data = { ...this.productFields(source, category), ...require('./ProductPhoto').optional(source) };

    // Se conserva compatibilidad del contrato, aunque la interfaz nueva administra las formas de venta aparte.
    if (!update && source.initialPresentation !== undefined) {
      try {
        this.body(source.initialPresentation, ['name', 'factor', 'barcode', 'price']);
        data.initialPresentation = this.presentation({ ...source.initialPresentation, state: data.state });
      } catch (error) {
        if (!(error instanceof ProductError)) throw error;
        throw new ProductError(error.status, error.message,
          Object.fromEntries(Object.entries(error.fieldErrors).map(([key, message]) => [key === 'name' ? 'presentationName' : key, message])));
      }
    }
    return data;
  }

  /** Una categoría existente por ID o un nombre nuevo. */
  static categoryFields(body) {
    if (body.categoryName === undefined) return { categoryId: this.id(body.categoryId, 'categoryId') };
    if (body.categoryId !== undefined) throw new ProductError(422, 'Selecciona una categoría o escribe su nombre, no ambos.', { categoryIdText: 'Indica una sola categoría.' });
    const name = this.text(body.categoryName, 80, 'categoryIdText').replace(/\s+/g, ' ').toLocaleUpperCase('es');
    return { categoryName: this.text(name, 80, 'categoryIdText') };
  }

  static productFields(body, category) {
    return {
      name: this.text(body.name, 120, 'name'),
      ...category,
      unitId: this.id(body.unitId, 'unitId'),
      description: this.text(body.description, 255, 'description', true),
      minimum: this.decimal(body.minimum, 3, 'minimum'),
      state: this.state(body.state)
    };
  }

  static presentation(body, update = false) {
    this.body(body, ['name', 'factor', 'barcode', 'price', 'state', ...(update ? ['version'] : [])]);
    return {
      name: this.text(body.name, 80, 'name'),
      factor: this.decimal(body.factor, 3, 'factor', true),
      barcode: this.text(body.barcode, 50, 'barcode', true) || null,
      price: this.decimal(body.price, 2, 'price'),
      state: this.state(body.state)
    };
  }

  static page(query, columns = ['name']) {
    const page = super.page(query, columns);
    if (query.lowStock !== undefined && !['', 'SI', 'NO'].includes(query.lowStock)) throw new ProductError(400, 'Filtro de stock no válido.');
    return {
      ...page,
      categoryId: query.categoryId === undefined || query.categoryId === '' ? null : this.id(query.categoryId, 'categoryId'),
      lowStock: query.lowStock || ''
    };
  }
}
module.exports = { ProductInput, ProductError };
