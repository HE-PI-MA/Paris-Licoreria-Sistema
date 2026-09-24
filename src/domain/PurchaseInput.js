/**
 * U051: Compras acepta productos existentes o nombres nuevos con su categoría.
 * Las formas de venta siguen perteneciendo exclusivamente a Productos.
 */
const { ProductInput, ProductError: RecordError } = require('./ProductInput');

class PurchaseInput extends ProductInput {
  static arrivals = new Set([
    'UNIDAD','DOCENA','PAQUETE','CAJA','BOLSA','BOTELLA',
    'GRAMO','KILOGRAMO','LIBRA','MILILITRO','LITRO'
  ]);

  static reference(value) {
    this.body(value, ['id', 'version']);
    return { id: this.id(value.id, 'productIdText'), version: this.version(value.version) };
  }

  static product(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new RecordError(422, 'Indica el nombre del producto.', { productIdText: 'Busca o escribe el producto.' });
    }
    if (value.id !== undefined) return this.reference(value);
    this.body(value, ['name', 'categoryId', 'categoryName']);
    const name = this.text(value.name, 120, 'productIdText').replace(/\s+/g, ' ').toLocaleUpperCase('es');
    return { name, ...this.categoryFields(value) };
  }

  static arrival(value) {
    const arrival = this.text(value, 80, 'arrival').replace(/\s+/g, ' ').toLocaleUpperCase('es');
    if (!this.arrivals.has(arrival)) throw new RecordError(422, 'Forma de ingreso no válida.', { arrival: 'Selecciona una opción de la lista.' });
    return arrival;
  }

  static standardFactor(arrival) {
    return {
      UNIDAD: '1.000',
      DOCENA: '12.000',
      GRAMO: '1.000',
      KILOGRAMO: '1000.000',
      LIBRA: '453.592',
      MILILITRO: '1.000',
      LITRO: '1000.000'
    }[arrival] || null;
  }

  static location(body) {
    if (body.locationName === undefined) return { locationId: this.id(body.locationId, 'locationIdText') };
    if (body.locationId !== undefined) throw new RecordError(422, 'Selecciona una ubicación o escribe su nombre.', { locationIdText: 'Indica una sola ubicación de ingreso.' });
    const name = this.text(body.locationName, 80, 'locationIdText').replace(/\s+/g, ' ').toLocaleUpperCase('es');
    return { locationName: this.text(name, 80, 'locationIdText') };
  }

  static date(value) {
    if (!value) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || value > '9999-12-31' ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
      throw new RecordError(422, 'Fecha de vencimiento no válida.', { expiresOn: 'Escribe una fecha válida o deja el campo vacío.' });
    }
    return value;
  }

  static purchase(body) {
    this.body(body, ['locationId', 'locationName', 'lines']);
    if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 50) {
      throw new RecordError(422, 'Agrega entre 1 y 50 productos a la compra.');
    }

    const lines = body.lines.map((line, index) => {
      try {
        this.body(line, ['product', 'arrival', 'factor', 'quantity', 'cost', 'expiresOn']);
        const product = this.product(line.product);
        const arrival = this.arrival(line.arrival);
        const receivedFactor = this.decimal(line.factor, 3, 'factor', true);
        const factor = product.id ? receivedFactor : (this.standardFactor(arrival) || receivedFactor);
        return {
          product, arrival, factor,
          quantity: this.decimal(line.quantity, 3, 'quantity', true),
          cost: this.decimal(line.cost, 2, 'cost'),
          expiresOn: this.date(line.expiresOn)
        };
      } catch (error) {
        if (error instanceof RecordError) throw new RecordError(error.status, 'Producto ' + (index + 1) + ': ' + error.message, error.fieldErrors);
        throw error;
      }
    });

    return { ...this.location(body), lines };
  }

  static list(query) {
    this.body(query, ['term', 'page', 'pageSize', 'sort', 'direction']);
    return super.page({ ...query, sort: query.sort || 'date', direction: query.direction || 'desc' }, ['date', 'total']);
  }
}
module.exports = PurchaseInput;
