/**
 * U051: Compras admite productos existentes y productos nuevos con categoría elegida por la persona.
 * La unidad base de un producto nuevo se infiere por la forma de ingreso.
 */
const crypto = require('node:crypto');
const Input = require('../domain/PurchaseInput');
const { RecordError } = require('../domain/RecordInput');
const ProductService = require('./ProductService');
const Decimal = require('../../public/js/components/decimal');

class PurchaseService {
  constructor(repository) {
    this.repository = repository;
    this.products = new ProductService(repository.products);
  }

  list(query) { return this.repository.list(Input.list(query)); }
  locations(query) { Input.body(query, ['term', 'page', 'pageSize']); return this.repository.locations(Input.page(query)); }
  async detail(id) { const row = await this.repository.detail(Input.id(id)); if (!row) throw new RecordError(404, 'La compra no existe.'); return row; }

  current(row, ref, label) {
    if (!row || row.state !== 'ACTIVO') throw new RecordError(409, label + ' no está disponible. Vuelve a seleccionarlo.');
    if (row.version !== ref.version) throw new RecordError(409, label + ' cambió. Vuelve a seleccionarlo para revisar sus datos actuales.');
    return row;
  }

  arrivalGroup(arrival) {
    if (['GRAMO','KILOGRAMO','LIBRA'].includes(arrival)) return 'GRAMO';
    if (['MILILITRO','LITRO'].includes(arrival)) return 'MILILITRO';
    return 'UNIDAD';
  }

  async location(c, data) {
    const row = data.locationId ? await this.repository.location(c, data.locationId) : await this.repository.namedLocation(c, data.locationName);
    if (row?.state === 'ACTIVO') return data.locationId || row.id;
    if (row || data.locationId) throw new RecordError(422, 'La ubicación no está disponible.', { locationIdText: 'Elige una ubicación activa o escribe otro nombre.' });
    return this.repository.insertLocation(c, data.locationName);
  }

  async product(c, data, cache, arrival) {
    if (data.id) return this.current(await this.repository.products.getProduct(data.id, c, true), data, 'El producto');

    const key = data.name.toLocaleUpperCase('es');
    const group = this.arrivalGroup(arrival);
    const categoryFingerprint = JSON.stringify([data.categoryId || null, data.categoryName || null]);
    const cached = cache.get(key);

    if (cached) {
      if (cached.group !== group || cached.categoryFingerprint !== categoryFingerprint) {
        throw new RecordError(422, 'El mismo producto nuevo debe usar la misma categoría y el mismo tipo de medida dentro de la compra.');
      }
      return cached.row;
    }

    const matches = await this.repository.namedProducts(c, data.name);
    if (matches.length > 1) {
      throw new RecordError(409, 'Hay más de un producto con ese nombre. Selecciona el producto correcto desde las sugerencias.');
    }
    if (matches.length === 1) {
      if (matches[0].state !== 'ACTIVO') throw new RecordError(409, 'Ese producto existe pero está inactivo. Actívalo en Productos antes de comprarlo.');
      return matches[0];
    }

    const unitId = await this.repository.purchaseUnit(c, arrival);
    if (!unitId) throw new RecordError(409, 'Falta la unidad base necesaria para crear este producto nuevo.');

    const categoryId = await this.products.category(c, data);
    const values = {
      name: data.name,
      categoryId,
      unitId,
      description: '',
      minimum: '0.000',
      state: 'ACTIVO'
    };

    await this.products.referenceChecks(c, values);
    const created = await this.repository.products.insertProduct(c, values);
    const row = { ...values, ...created, photoHash: null };
    cache.set(key, { group, categoryFingerprint, row });
    return row;
  }

  async create(actor, key, body) {
    const data = Input.purchase(body), userId = Input.id(actor), total = Decimal.total(data.lines);
    if (Decimal.units(total, 2) > 999999999999999n) throw new RecordError(422, 'El total supera el importe permitido de la compra.');
    const metadata = {
      userId,
      key: Input.key(key),
      hash: crypto.createHash('sha256').update(JSON.stringify(['purchase:create:u051', data])).digest('hex')
    };

    try {
      return await this.repository.write(metadata, async c => {
        if ((await this.repository.actor(c, userId))?.state !== 'ACTIVO') throw new RecordError(403, 'El usuario ya no está activo.');
        const locationId = await this.location(c, data);
        const id = await this.repository.insert(c, userId);
        const products = new Map();

        for (const [index, line] of data.lines.entries()) {
          try {
            const product = await this.product(c, line.product, products, line.arrival);
            const baseQuantity = Decimal.multiply(line.quantity, line.factor, 3);
            const units = Decimal.units(baseQuantity, 3);
            if (units <= 0n || units > 999999999999999n) throw new RecordError(422, 'La cantidad convertida debe estar entre 0,001 y 999.999.999.999,999 unidades base.');
            await this.repository.insertLine(c, id, product.id, locationId, line, baseQuantity);
          } catch (error) {
            if (error instanceof RecordError) throw new RecordError(error.status, 'Fila ' + (index + 1) + ': ' + error.message, error.fieldErrors);
            throw error;
          }
        }
        return { id, total };
      });
    } catch (error) {
      if (error instanceof RecordError) throw error;
      if (error.code === 'ER_DUP_ENTRY') throw new RecordError(409, 'La compra coincide con un registro que cambió. Actualiza y vuelve a intentarlo.');
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new RecordError(409, 'Otra operación está usando estos registros. Reintenta guardar la misma compra.');
      if (['ER_NO_REFERENCED_ROW_2', 'ER_SIGNAL_EXCEPTION', 'ER_CHECK_CONSTRAINT_VIOLATED'].includes(error.code)) throw new RecordError(409, 'Los datos cambiaron o no cumplen las reglas de stock. Revisa las filas antes de reintentar.');
      throw error;
    }
  }
}
module.exports = PurchaseService;
