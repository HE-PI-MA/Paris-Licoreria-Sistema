/** Lecturas de existencias y escrituras bloqueadas por lote. Todas las cantidades se conservan como DECIMAL, nunca como coma flotante. */
const crypto=require('node:crypto');
const ProductRepository=require('./ProductRepository'),LocationRepository=require('./LocationRepository'),MovementRepository=require('./InventoryMovementRepository'),OperationStore=require('./OperationStore');
class InventoryRepository {
 constructor(pool){this.pool=pool;this.products=new ProductRepository(pool);this.places=new LocationRepository(pool);this.movements=new MovementRepository(pool);this.operations=new OperationStore(pool,{repeatableRead:true});}
 write(metadata,operation){return this.operations.write(metadata,operation);}
 version(row){return crypto.createHash('sha256').update(JSON.stringify(['id','lotId','locationId','physicalStock','expiresOn','productState','locationState'].map(k=>row[k]??null))).digest('hex');}
 decorate(row){return row&&{...row,version:this.version(row)};}
 summary(){return `SELECT p.id_producto AS id,p.nombre AS name,c.nombre AS category,p.estado AS state,um.nombre AS unit,p.stock_minimo AS minimum,
  v.stock_fisico AS physicalStock,v.stock_disponible AS stock,v.stock_vencido AS expired,
  COALESCE((SELECT SUM(s.stock_fisico) FROM vw_stock_lote_ubicacion s WHERE s.id_producto=p.id_producto AND s.fecha_vencimiento>CURRENT_DATE AND s.fecha_vencimiento<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)),0) AS expiring
  FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida JOIN vw_stock_producto v ON v.id_producto=p.id_producto`;}
 async list(input){
  const parts=["p.nombre LIKE ? ESCAPE '!'"];const args=[this.products.search(input.term)];
  if(input.categoryId){parts.push('p.id_categoria=?');args.push(input.categoryId);}
  const alerts={BAJO:'v.stock_disponible<=p.stock_minimo',AGOTADO:'v.stock_disponible=0',VENCIDO:'v.stock_vencido>0',PROXIMO:'EXISTS(SELECT 1 FROM vw_stock_lote_ubicacion s WHERE s.id_producto=p.id_producto AND s.stock_fisico>0 AND s.fecha_vencimiento>CURRENT_DATE AND s.fecha_vencimiento<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY))'};
  if(input.alert)parts.push(alerts[input.alert]);
  const query=this.summary()+' WHERE '+parts.join(' AND '),columns={name:'name',stock:'stock',physicalStock:'physicalStock'},c=await this.pool.getConnection();
  try{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.beginTransaction();
   const [[{total}]]=await c.query('SELECT COUNT(*) AS total FROM ('+query+') items',args);
   const [records]=await c.query(query+` ORDER BY ${columns[input.sort]} ${input.direction==='desc'?'DESC':'ASC'},p.id_producto LIMIT ? OFFSET ?`,[...args,input.pageSize,(input.page-1)*input.pageSize]);
   await c.commit();return {records,total:Number(total)};
  }catch(error){await c.rollback();throw error;}finally{c.release();}
 }
 async detail(id){const [[row]]=await this.pool.query(this.summary()+' WHERE p.id_producto=?',[id]);return row;}
 stockQuery(){return `SELECT s.id_lote_ubicacion AS id,s.id_producto AS productId,s.producto AS product,s.unidad_base AS unit,s.id_lote AS lotId,s.codigo_lote AS lotCode,
  s.id_ubicacion AS locationId,s.ubicacion AS location,s.stock_fisico AS physicalStock,s.stock_disponible AS stock,DATE_FORMAT(s.fecha_vencimiento,'%Y-%m-%d') AS expiresOn,
  s.estado_vencimiento AS expiryStatus,p.estado AS productState,u.estado AS locationState
  FROM vw_stock_lote_ubicacion s JOIN producto p ON p.id_producto=s.id_producto JOIN ubicacion u ON u.id_ubicacion=s.id_ubicacion`;}
 async lots(id,input){
  const parts=['s.id_producto=?',"(s.ubicacion LIKE ? ESCAPE '!' OR COALESCE(s.codigo_lote,'') LIKE ? ESCAPE '!')"],args=[id,this.products.search(input.term),this.products.search(input.term)];
  if(input.locationId){parts.push('s.id_ubicacion=?');args.push(input.locationId);}
  const from=this.stockQuery()+' WHERE '+parts.join(' AND '),sort={location:'location',expiresOn:'expiresOn',stock:'physicalStock'},c=await this.pool.getConnection();
  try{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.beginTransaction();
   const [[{total}]]=await c.query('SELECT COUNT(*) AS total FROM ('+from+') items',args);
   const [rows]=await c.query(from+` ORDER BY ${sort[input.sort]} ${input.direction==='desc'?'DESC':'ASC'},s.id_lote_ubicacion LIMIT ? OFFSET ?`,[...args,input.pageSize,(input.page-1)*input.pageSize]);
   await c.commit();return {records:rows.map(r=>this.decorate(r)),total:Number(total)};
  }catch(error){await c.rollback();throw error;}finally{c.release();}
 }
 async stock(id,c=this.pool,lock=false){const [[row]]=await c.query(this.stockQuery()+' WHERE s.id_lote_ubicacion=?'+(lock?' FOR SHARE':''),[id]);return this.decorate(row);}
 /** Lectura protegida del lote y bloqueo exclusivo de todas sus ubicaciones en orden estable. */
 async lockStock(c,id){
  const [[ref]]=await c.query('SELECT id_lote AS lotId FROM lote_ubicacion WHERE id_lote_ubicacion=?',[id]);if(!ref)return null;
  await c.query('SELECT id_lote FROM lote_producto WHERE id_lote=? FOR SHARE',[ref.lotId]);
  const [rows]=await c.query('SELECT id_lote_ubicacion AS id,id_ubicacion AS locationId,cantidad_actual AS quantity FROM lote_ubicacion WHERE id_lote=? ORDER BY id_lote_ubicacion FOR UPDATE',[ref.lotId]);
  const row=await this.stock(id,c,true);return row&&{...row,locations:rows};
 }
 async actor(c,id){const [[row]]=await c.query('SELECT estado AS state FROM usuario WHERE id_usuario=? FOR SHARE',[id]);return row;}
 async setQuantity(c,id,quantity){await c.query('UPDATE lote_ubicacion SET cantidad_actual=? WHERE id_lote_ubicacion=?',[quantity,id]);}
 async addLocation(c,lotId,locationId){const [row]=await c.query('INSERT INTO lote_ubicacion(id_lote,id_ubicacion,cantidad_actual) VALUES(?,?,0)',[lotId,locationId]);return row.insertId;}
 async remove(c,userId,data){const [row]=await c.query('INSERT INTO ajuste_inventario(id_lote_ubicacion,id_usuario,tipo_ajuste,cantidad,observacion) VALUES(?,?,?,?,?)',[data.stockId,userId,data.type,data.quantity,data.reason]);return row.insertId;}
}
module.exports=InventoryRepository;
