/** U051: Compras en memoria con categorías, productos existentes y altas mínimas de productos nuevos. */
const crypto = require('node:crypto');
const Repository = require('../../src/repositories/PurchaseRepository');
const Products = require('../../src/repositories/ProductRepository');
const Decimal = require('../../public/js/components/decimal');

const baseProduct = () => ({
  id: 1,
  name: 'CERVEZA FICTICIA',
  categoryId: 1,
  category: 'BEBIDAS',
  unitId: 1,
  unit: 'UNIDAD',
  description: '',
  minimum: '0.000',
  state: 'ACTIVO',
  photoHash: null
});

const productVersion = row => crypto.createHash('sha256').update(JSON.stringify(
  ['id','name','categoryId','unitId','description','minimum','state','photoHash']
    .map(key => row[key] == null ? null : String(row[key]))
)).digest('hex');

class PurchaseMemoryPool {
  constructor() {
    this.queue = Promise.resolve();
    this.data = {
      categories: [
        { id: 1, name: 'BEBIDAS', state: 'ACTIVO' },
        { id: 2, name: 'PRODUCTO NATURAL', state: 'ACTIVO' },
        { id: 6, name: 'OTROS', state: 'ACTIVO' }
      ],
      units: [
        { id: 1, name: 'UNIDAD' },
        { id: 3, name: 'GRAMO' },
        { id: 4, name: 'MILILITRO' }
      ],
      locations: [{ id: 1, name: 'ALMACÉN DE PRUEBA', state: 'ACTIVO' }],
      products: [baseProduct()],
      purchases: [],
      lines: [],
      operations: new Map()
    };
  }

  async getConnection() {
    const pool = this;
    let release;

    return {
      async beginTransaction() {
        const previous = pool.queue;
        pool.queue = new Promise(r => { release = r; });
        await previous;
        this.data = structuredClone(pool.data);
      },

      async query(sql, args = []) {
        if (sql.startsWith('SET TRANSACTION')) return [[]];

        const id = args[0] + ':' + args[1];

        if (sql.startsWith('INSERT INTO catalogo_operacion')) {
          if (this.data.operations.has(id)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
          this.data.operations.set(id, { hash: args[2], result: null });
          return [{}];
        }

        if (sql.startsWith('SELECT solicitud_hash')) return [[this.data.operations.get(id)]];

        if (sql.startsWith('UPDATE catalogo_operacion')) {
          this.data.operations.get(args[1] + ':' + args[2]).result = args[0];
          return [{}];
        }

        throw new Error('Unexpected SQL: ' + sql);
      },

      async commit() { pool.data = this.data; },
      async rollback() {},
      release() { release?.(); }
    };
  }
}

class PurchaseMemoryProducts extends Products {
  rows(c, key) { return (c?.data || this.pool.data)[key]; }

  async getProduct(id, c) {
    const row = this.rows(c, 'products').find(item => item.id === Number(id));
    return this.decorate(row);
  }

  async detail(id) {
    const row = await this.getProduct(id);
    return row;
  }

  async list(input) {
    const term = String(input.term || '').toLocaleUpperCase('es');
    const rows = this.rows(null, 'products')
      .filter(row => row.state === 'ACTIVO' && row.name.includes(term));

    return {
      records: rows
        .slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
        .map(row => this.decorate(row)),
      total: rows.length
    };
  }

  async category(c, id) {
    return this.rows(c, 'categories').find(row => row.id === Number(id));
  }

  async namedCategory(c, name) {
    return this.rows(c, 'categories').find(row => row.name.toUpperCase() === name.toUpperCase());
  }

  async insertCategory(c, name) {
    const id = Math.max(0, ...c.data.categories.map(row => row.id)) + 1;
    c.data.categories.push({ id, name, state: 'ACTIVO' });
    return id;
  }

  async unit(c, id) {
    return this.rows(c, 'units').find(row => row.id === Number(id));
  }

  async insertProduct(c, data) {
    const id = Math.max(0, ...c.data.products.map(row => row.id)) + 1;
    const category = c.data.categories.find(row => row.id === Number(data.categoryId));
    const unit = c.data.units.find(row => row.id === Number(data.unitId));

    c.data.products.push({
      ...data,
      id,
      categoryId: Number(data.categoryId),
      category: category?.name,
      unitId: Number(data.unitId),
      unit: unit?.name,
      photoHash: null
    });

    return { id };
  }
}

class PurchaseMemoryRepository extends Repository {
  constructor() {
    super(new PurchaseMemoryPool());
    this.products = new PurchaseMemoryProducts(this.pool);
  }

  async actor() { return { state: 'ACTIVO' }; }

  async location(c, id) {
    return c.data.locations.find(row => row.id === Number(id));
  }

  async namedLocation(c, name) {
    return c.data.locations.find(row => row.name.toUpperCase() === name.toUpperCase());
  }

  async insertLocation(c, name) {
    const id = c.data.locations.length + 1;
    c.data.locations.push({ id, name, state: 'ACTIVO' });
    return id;
  }

  async locations(input) {
    const rows = this.pool.data.locations.filter(
      row => row.state === 'ACTIVO' && row.name.includes(input.term.toUpperCase())
    );

    return {
      options: rows
        .slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
        .map(row => ({ value: String(row.id), label: row.name })),
      total: rows.length
    };
  }

  async namedProducts(c, name) {
    return c.data.products
      .filter(row => row.name.toUpperCase() === name.toUpperCase())
      .slice(0, 2)
      .map(row => this.products.decorate(row));
  }

  async purchaseUnit(c, arrival) {
    const unitName = ['GRAMO','KILOGRAMO','LIBRA'].includes(arrival)
      ? 'GRAMO'
      : ['MILILITRO','LITRO'].includes(arrival)
        ? 'MILILITRO'
        : 'UNIDAD';

    return c.data.units.find(row => row.name === unitName)?.id || null;
  }

  async insert(c, userId) {
    const id = c.data.purchases.length + 1;
    c.data.purchases.push({ id, userId });
    return id;
  }

  async insertLine(c, purchaseId, productId, locationId, line, baseQuantity) {
    if (this.failLine) throw new Error('Simulated storage failure');

    const id = c.data.lines.length + 1;
    c.data.lines.push({
      id,
      purchaseId,
      productId,
      locationId,
      ...line,
      baseQuantity,
      lotCode: 'L-' + String(id).padStart(6, '0')
    });
  }

  async list(input) {
    if (this.failList) throw new Error('Simulated connection failure');

    const term = input.term.toUpperCase();
    const rows = this.pool.data.purchases
      .map(p => this.header(p))
      .filter(row =>
        !term ||
        String(row.id) === term ||
        this.pool.data.lines.some(line =>
          line.purchaseId === row.id &&
          this.pool.data.products.find(p => p.id === line.productId)?.name.includes(term)
        )
      );

    return {
      records: rows.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
      total: rows.length
    };
  }

  header(p) {
    const lines = this.pool.data.lines.filter(line => line.purchaseId === p.id);
    return {
      ...p,
      date: '24/09/2026 14:00',
      user: 'USUARIO DE PRUEBA',
      total: Decimal.total(lines)
    };
  }

  async detail(id) {
    const p = this.pool.data.purchases.find(row => row.id === Number(id));
    if (!p) return null;

    return {
      ...this.header(p),
      lines: this.pool.data.lines
        .filter(line => line.purchaseId === p.id)
        .map(line => {
          const product = this.pool.data.products.find(item => item.id === line.productId);
          return {
            ...line,
            rowId: line.id,
            product: product.name,
            categoryId: product.categoryId,
            category: product.category,
            arrival: line.arrival,
            factor: line.factor,
            quantity: line.quantity,
            cost: line.cost,
            subtotal: Decimal.multiply(line.quantity, line.cost, 2),
            baseQuantity: line.baseQuantity,
            unit: product.unit,
            lotCode: line.lotCode,
            expiresOn: line.expiresOn,
            location: this.pool.data.locations.find(row => row.id === line.locationId).name
          };
        })
    };
  }
}

function body() {
  const product = baseProduct();
  return {
    locationId: '1',
    lines: [{
      product: { id: 1, version: productVersion(product) },
      arrival: 'CAJA',
      factor: '6',
      quantity: '2',
      cost: '45.25',
      expiresOn: '2027-12-31'
    }]
  };
}

module.exports = { PurchaseMemoryRepository, body, baseProduct, productVersion };
