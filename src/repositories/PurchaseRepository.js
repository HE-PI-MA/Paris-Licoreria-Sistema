/**
 * U049: persistencia de Compras separada de las presentaciones de venta.
 * Una compra puede resolver un producto existente o crear uno mínimo antes de registrar el ingreso.
 */
const LocationRepository = require('./LocationRepository');
const MovementRepository = require('./InventoryMovementRepository');
const Decimal = require('../../public/js/components/decimal');
const OperationStore = require('./OperationStore');
const ProductRepository = require('./ProductRepository');

class PurchaseRepository {
  constructor(pool) {
    this.places = new LocationRepository(pool);
    this.movements = new MovementRepository(pool);
    this.pool = pool;
    this.products = new ProductRepository(pool);
    this.operations = new OperationStore(pool, { repeatableRead: true });
  }

  write(metadata, operation) { return this.operations.write(metadata, operation); }

  async list(input) {
    const { page, pageSize, term, sort, direction } = input;
    const like = this.products.search(term);
    const filter = `WHERE (?='' OR CAST(v.id_compra AS CHAR)=? OR EXISTS (
      SELECT 1 FROM detalle_compra dc JOIN producto p ON p.id_producto=dc.id_producto
      WHERE dc.id_compra=v.id_compra AND p.nombre LIKE ? ESCAPE '!'
    ))`;
    const args = [term, term, like];
    const columns = { date: 'v.fecha_hora', total: 'v.total_compra' };
    const c = await this.pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await c.beginTransaction();
      const [[{ total }]] = await c.query('SELECT COUNT(*) AS total FROM vw_compras_totales v ' + filter, args);
      const [records] = await c.query(`SELECT v.id_compra AS id,DATE_FORMAT(v.fecha_hora,'%d/%m/%Y %H:%i') AS date,
        v.total_compra AS total,v.usuario AS user FROM vw_compras_totales v ${filter}
        ORDER BY ${columns[sort]} ${direction === 'asc' ? 'ASC' : 'DESC'},v.id_compra DESC LIMIT ? OFFSET ?`,
        [...args, pageSize, (page - 1) * pageSize]);
      await c.commit();
      return { records, total: Number(total) };
    } catch (error) {
      await c.rollback(); throw error;
    } finally { c.release(); }
  }

  locations(input) { return this.places.list(input); }

  async detail(id) {
    const [[record]] = await this.pool.query(`SELECT v.id_compra AS id,DATE_FORMAT(v.fecha_hora,'%d/%m/%Y %H:%i') AS date,
      v.usuario AS user,v.total_compra AS total FROM vw_compras_totales v WHERE v.id_compra=?`, [id]);
    if (!record) return null;

    const [lines] = await this.pool.query(`SELECT d.id_detalle_compra AS id,lu.id_lote_ubicacion AS rowId,
      p.nombre AS product,p.id_categoria AS categoryId,cat.nombre AS category,d.forma_ingreso AS arrival,
      d.cantidad AS quantity,d.costo_unitario AS cost,
      ROUND(d.cantidad*d.costo_unitario,2) AS subtotal,d.factor_ingreso AS factor,um.nombre AS unit,
      l.codigo_lote AS lotCode,DATE_FORMAT(l.fecha_vencimiento,'%Y-%m-%d') AS expiresOn,
      u.nombre AS location,l.cantidad_inicial AS baseQuantity
      FROM detalle_compra d
      JOIN producto p ON p.id_producto=d.id_producto
      JOIN categoria cat ON cat.id_categoria=p.id_categoria
      JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida
      JOIN lote_producto l ON l.id_detalle_compra=d.id_detalle_compra
      JOIN lote_ubicacion lu ON lu.id_lote=l.id_lote
      JOIN ubicacion u ON u.id_ubicacion=lu.id_ubicacion
      WHERE d.id_compra=? ORDER BY d.id_detalle_compra,l.id_lote,lu.id_lote_ubicacion`, [id]);

    const grouped = new Map();
    for (const row of lines) {
      if (!grouped.has(row.id)) grouped.set(row.id, {
        ...row,
        rowId: row.id,
        baseQuantity: Decimal.multiply(row.quantity, row.factor, 3),
        locations: new Set(), lots: new Set(), dates: new Set()
      });
      const line = grouped.get(row.id);
      line.locations.add(row.location);
      if (row.lotCode) line.lots.add(row.lotCode);
      if (row.expiresOn) line.dates.add(row.expiresOn);
    }
    return {
      ...record,
      lines: [...grouped.values()].map(({ locations, lots, dates, ...line }) => ({
        ...line,
        location: [...locations].join(', '),
        lotCode: [...lots].join(', '),
        expiresOn: [...dates].join(', ')
      }))
    };
  }

  location(c, id) { return this.places.get(c, id); }
  namedLocation(c, name) { return this.places.named(c, name); }
  insertLocation(c, name) { return this.places.insert(c, name); }
  async actor(c, id) { const [[row]] = await c.query('SELECT estado AS state FROM usuario WHERE id_usuario=? FOR SHARE', [id]); return row; }

  async namedProducts(c, name) {
    const [rows] = await c.query(
      'SELECT ' + ProductRepository.productFields + ' FROM producto p WHERE TRIM(p.nombre)=? ORDER BY p.id_producto LIMIT 2 FOR UPDATE',
      [name]
    );
    return rows.map(row => this.products.decorate(row));
  }

  async purchaseUnit(c, arrival) {
    const unitName = ['GRAMO','KILOGRAMO','LIBRA'].includes(arrival) ? 'GRAMO'
      : ['MILILITRO','LITRO'].includes(arrival) ? 'MILILITRO' : 'UNIDAD';
    const [[unit]] = await c.query(
      "SELECT id_unidad_medida AS id FROM unidad_medida WHERE UPPER(TRIM(nombre))=? ORDER BY id_unidad_medida LIMIT 1 FOR SHARE",
      [unitName]
    );
    return unit?.id || null;
  }

  async insert(c, userId) {
    const [r] = await c.query('INSERT INTO compra(id_proveedor,id_usuario,observacion) VALUES(NULL,?,NULL)', [userId]);
    return r.insertId;
  }

  async insertLine(c, purchaseId, productId, locationId, line, baseQuantity) {
    const [detail] = await c.query(
      `INSERT INTO detalle_compra(id_compra,id_producto,id_presentacion,forma_ingreso,factor_ingreso,cantidad,costo_unitario)
       VALUES(?,?,NULL,?,?,?,?)`,
      [purchaseId, productId, line.arrival, line.factor, line.quantity, line.cost]
    );
    const lotCode = 'L-' + String(detail.insertId).padStart(6, '0');
    const [lot] = await c.query(
      'INSERT INTO lote_producto(id_detalle_compra,codigo_lote,fecha_vencimiento,cantidad_inicial) VALUES(?,?,?,?)',
      [detail.insertId, lotCode, line.expiresOn, baseQuantity]
    );
    await c.query('INSERT INTO lote_ubicacion(id_lote,id_ubicacion,cantidad_actual) VALUES(?,?,?)', [lot.insertId, locationId, baseQuantity]);
    const [[purchase]] = await c.query('SELECT id_usuario AS userId FROM compra WHERE id_compra=?', [purchaseId]);
    await this.movements.insert(c, {
      lotId: lot.insertId, destinationId: locationId, userId: purchase.userId,
      type: 'COMPRA', quantity: baseQuantity, before: '0.000', after: baseQuantity,
      reason: 'COMPRA N.º ' + purchaseId
    });
    return { detailId: detail.insertId, lotId: lot.insertId, lotCode };
  }
}
module.exports = PurchaseRepository;
