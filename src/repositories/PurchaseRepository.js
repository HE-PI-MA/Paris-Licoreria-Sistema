/** SQL de Compras: consulta por páginas y registra cabecera, detalles y lotes dentro de la transacción externa compartida. */
const Decimal = require('../../public/js/components/decimal');
const OperationStore = require('./OperationStore');
const ProductRepository = require('./ProductRepository');
const SupplierRepository = require('./SupplierRepository');
class PurchaseRepository {
  constructor(pool) {
    this.pool = pool; this.products = new ProductRepository(pool); this.suppliers = new SupplierRepository(pool);
    this.operations = new OperationStore(pool, { repeatableRead: true });
  }
  write(metadata, operation) { return this.operations.write(metadata, operation); }
  async list(input) {
    const { page, pageSize, term, sort, direction } = input;
    const filter = 'WHERE (proveedor LIKE ? ESCAPE \'!\' OR CAST(id_compra AS CHAR)=?)';
    const args = [this.products.search(term),term];
    const columns = { date: 'fecha_hora', supplier: 'proveedor', total: 'total_compra' };
    const c = await this.pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); await c.beginTransaction();
      const [[{ total }]] = await c.query('SELECT COUNT(*) AS total FROM vw_compras_totales ' + filter,args);
      const [records] = await c.query(`SELECT id_compra AS id, DATE_FORMAT(fecha_hora,'%d/%m/%Y %H:%i') AS date, proveedor AS supplier,
        total_compra AS total, usuario AS user FROM vw_compras_totales ${filter} ORDER BY ${columns[sort]} ${direction === 'asc' ? 'ASC' : 'DESC'},id_compra DESC LIMIT ? OFFSET ?`, [...args,pageSize,(page-1)*pageSize]);
      await c.commit(); return { records,total:Number(total) };
    } catch(error) { await c.rollback(); throw error; } finally { c.release(); }
  }
  async locations(input) {
    const args=[this.products.search(input.term)];
    const [[{ total }]] = await this.pool.query("SELECT COUNT(*) AS total FROM ubicacion WHERE estado='ACTIVO' AND nombre LIKE ? ESCAPE '!'",args);
    const [options] = await this.pool.query("SELECT id_ubicacion AS value,nombre AS label FROM ubicacion WHERE estado='ACTIVO' AND nombre LIKE ? ESCAPE '!' ORDER BY nombre,id_ubicacion LIMIT ? OFFSET ?",[...args,input.pageSize,(input.page-1)*input.pageSize]);
    return { options,total:Number(total) };
  }
  async detail(id) {
    const [[record]] = await this.pool.query(`SELECT v.id_compra AS id,DATE_FORMAT(v.fecha_hora,'%d/%m/%Y %H:%i') AS date,v.proveedor AS supplier,
      v.usuario AS user,v.total_compra AS total,c.observacion AS observation FROM vw_compras_totales v JOIN compra c ON c.id_compra=v.id_compra WHERE v.id_compra=?`,[id]);
    if (!record) return null;
    const [lines] = await this.pool.query(`SELECT d.id_detalle_compra AS id,lu.id_lote_ubicacion AS rowId,p.nombre AS product,pr.nombre_presentacion AS presentation,
      d.cantidad AS quantity,d.costo_unitario AS cost,ROUND(d.cantidad*d.costo_unitario,2) AS subtotal,
      pr.factor_conversion AS factor,um.nombre AS unit,l.codigo_lote AS lotCode,DATE_FORMAT(l.fecha_vencimiento,'%Y-%m-%d') AS expiresOn,
      u.nombre AS location,l.cantidad_inicial AS baseQuantity FROM detalle_compra d
      JOIN presentacion_producto pr ON pr.id_presentacion=d.id_presentacion JOIN producto p ON p.id_producto=pr.id_producto
      JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida
      JOIN lote_producto l ON l.id_detalle_compra=d.id_detalle_compra JOIN lote_ubicacion lu ON lu.id_lote=l.id_lote
      JOIN ubicacion u ON u.id_ubicacion=lu.id_ubicacion WHERE d.id_compra=? ORDER BY d.id_detalle_compra,l.id_lote,lu.id_lote_ubicacion`,[id]);
    // Una compra anterior puede tener varios lotes/ubicaciones por detalle: no repetir cantidades ni subtotales en la tabla.
    const grouped=new Map();
    for(const row of lines){
      if(!grouped.has(row.id))grouped.set(row.id,{...row,rowId:row.id,baseQuantity:Decimal.multiply(row.quantity,row.factor,3),locations:new Set(),lots:new Set(),dates:new Set()});
      const line=grouped.get(row.id);line.locations.add(row.location);if(row.lotCode)line.lots.add(row.lotCode);if(row.expiresOn)line.dates.add(row.expiresOn);
    }
    return {...record,lines:[...grouped.values()].map(({locations,lots,dates,...line})=>({...line,location:[...locations].join(', '),lotCode:[...lots].join(', '),expiresOn:[...dates].join(', ')}))};
  }
  /** Bajo REPEATABLE READ, estas lecturas bloquean coincidencias y huecos hasta terminar el alta completa. */
  async namedSupplier(c,name) { const [[row]]=await c.query('SELECT id_proveedor AS id FROM proveedor WHERE nombre=? FOR UPDATE',[name]); return row; }
  async namedProduct(c,name) { const [[row]]=await c.query('SELECT id_producto AS id FROM producto WHERE nombre=? FOR UPDATE',[name]); return row; }
  async namedPresentation(c,id,name) { const [[row]]=await c.query('SELECT id_presentacion AS id FROM presentacion_producto WHERE id_producto=? AND nombre_presentacion=? FOR UPDATE',[id,name]); return row; }
  async location(c,id) { const [[row]]=await c.query('SELECT estado AS state FROM ubicacion WHERE id_ubicacion=? FOR SHARE',[id]); return row; }
  async namedLocation(c,name) { const [[row]]=await c.query('SELECT id_ubicacion AS id,estado AS state FROM ubicacion WHERE nombre=? FOR SHARE',[name]); return row; }
  async insertLocation(c,name) {
    const [row]=await c.query("INSERT INTO ubicacion(nombre,estado) VALUES(?,'ACTIVO')",[name]);return row.insertId;
  }
  async actor(c,id) { const [[row]]=await c.query('SELECT estado AS state FROM usuario WHERE id_usuario=? FOR SHARE',[id]); return row; }
  async insert(c,supplierId,userId,observation) {
    const [r]=await c.query('INSERT INTO compra(id_proveedor,id_usuario,observacion) VALUES(?,?,?)',[supplierId,userId,observation || null]); return r.insertId;
  }
  async insertLine(c,purchaseId,presentationId,locationId,line,baseQuantity) {
    const [detail]=await c.query('INSERT INTO detalle_compra(id_compra,id_presentacion,cantidad,costo_unitario) VALUES(?,?,?,?)',[purchaseId,presentationId,line.quantity,line.cost]);
    const [lot]=await c.query('INSERT INTO lote_producto(id_detalle_compra,codigo_lote,fecha_vencimiento,cantidad_inicial) VALUES(?,?,?,?)',[detail.insertId,line.lotCode,line.expiresOn,baseQuantity]);
    await c.query('INSERT INTO lote_ubicacion(id_lote,id_ubicacion,cantidad_actual) VALUES(?,?,?)',[lot.insertId,locationId,baseQuantity]);
  }
}
module.exports = PurchaseRepository;
