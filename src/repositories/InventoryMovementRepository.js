/** Escribe la bitácora dentro de la operación externa. El historial combina movimientos nuevos y registros previos sin inventar ubicaciones antiguas. */
class InventoryMovementRepository {
 constructor(pool){this.pool=pool;}
 async insert(c,row){
  const [result]=await c.query('INSERT INTO inventario_movimiento(id_lote,id_origen,id_destino,id_usuario,tipo,cantidad,anterior,posterior,destino_anterior,destino_posterior,motivo) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
   [row.lotId,row.sourceId||null,row.destinationId||null,row.userId,row.type,row.quantity,row.before,row.after,row.destinationBefore??null,row.destinationAfter??null,row.reason]);return result.insertId;
 }
 /** Las compras anteriores sin bitácora muestran origen desconocido; una venta anulada aporta cero al saldo. */
 union(){
  const product=" JOIN detalle_compra dc ON dc.id_detalle_compra=lp.id_detalle_compra JOIN presentacion_producto pp ON pp.id_presentacion=dc.id_presentacion JOIN producto p ON p.id_producto=pp.id_producto JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida ";
  return `SELECT CONCAT('M-',m.id_movimiento) AS id,m.fecha_hora AS occurred,m.tipo AS type,m.cantidad AS quantity,p.id_producto AS productId,p.nombre AS product,um.nombre AS unit,
   lp.codigo_lote AS lotCode,lp.id_lote AS lotId,m.id_origen AS sourceId,m.id_destino AS destinationId,o.nombre AS source,d.nombre AS destination,CONCAT(u.nombre,' ',u.apellido) AS user,
   m.motivo AS reason,m.anterior AS beforeQuantity,m.posterior AS afterQuantity,m.destino_anterior AS destinationBefore,m.destino_posterior AS destinationAfter
   FROM inventario_movimiento m JOIN lote_producto lp ON lp.id_lote=m.id_lote ${product} JOIN usuario u ON u.id_usuario=m.id_usuario LEFT JOIN ubicacion o ON o.id_ubicacion=m.id_origen LEFT JOIN ubicacion d ON d.id_ubicacion=m.id_destino
   UNION ALL
   SELECT CONCAT('C-',lp.id_lote),c.fecha_hora,'COMPRA',lp.cantidad_inicial,p.id_producto,p.nombre,um.nombre,lp.codigo_lote,lp.id_lote,NULL,NULL,NULL,NULL,CONCAT(u.nombre,' ',u.apellido),
   CONCAT('COMPRA N.º ',c.id_compra,'. UBICACIÓN ORIGINAL NO REGISTRADA EN EL HISTORIAL.'),NULL,NULL,NULL,NULL
   FROM lote_producto lp ${product} JOIN compra c ON c.id_compra=dc.id_compra JOIN usuario u ON u.id_usuario=c.id_usuario
   WHERE NOT EXISTS(SELECT 1 FROM inventario_movimiento m WHERE m.id_lote=lp.id_lote AND m.tipo='COMPRA')
   UNION ALL
   SELECT CONCAT('A-',a.id_ajuste),a.fecha_hora,'RETIRO',-a.cantidad,p.id_producto,p.nombre,um.nombre,lp.codigo_lote,lp.id_lote,lu.id_ubicacion,NULL,o.nombre,NULL,CONCAT(u.nombre,' ',u.apellido),
   CONCAT(a.tipo_ajuste,': ',COALESCE(a.observacion,'SIN OBSERVACIÓN')),NULL,NULL,NULL,NULL
   FROM ajuste_inventario a JOIN lote_ubicacion lu ON lu.id_lote_ubicacion=a.id_lote_ubicacion JOIN lote_producto lp ON lp.id_lote=lu.id_lote ${product} JOIN ubicacion o ON o.id_ubicacion=lu.id_ubicacion JOIN usuario u ON u.id_usuario=a.id_usuario
   UNION ALL
   SELECT CONCAT('V-',vl.id_detalle_venta_lote),v.fecha_hora,'VENTA',IF(v.estado='ANULADA',0,-vl.cantidad_base),p.id_producto,p.nombre,um.nombre,lp.codigo_lote,lp.id_lote,lu.id_ubicacion,NULL,o.nombre,NULL,CONCAT(u.nombre,' ',u.apellido),
   CONCAT('VENTA N.º ',v.id_venta,IF(v.estado='ANULADA',' ANULADA; EFECTO NETO CERO.','')),NULL,NULL,NULL,NULL
   FROM detalle_venta_lote vl JOIN lote_ubicacion lu ON lu.id_lote_ubicacion=vl.id_lote_ubicacion JOIN lote_producto lp ON lp.id_lote=lu.id_lote ${product}
   JOIN detalle_venta dv ON dv.id_detalle_venta=vl.id_detalle_venta JOIN venta v ON v.id_venta=dv.id_venta JOIN sesion_caja sc ON sc.id_sesion_caja=v.id_sesion_caja JOIN usuario u ON u.id_usuario=sc.id_usuario JOIN ubicacion o ON o.id_ubicacion=lu.id_ubicacion`;
 }
 async list(input){
  const conditions=["(h.product LIKE ? ESCAPE '!' OR COALESCE(h.lotCode,'') LIKE ? ESCAPE '!')"],search='%'+input.term.replace(/[!%_]/g,c=>'!'+c)+'%',args=[search,search];
  if(input.productId){conditions.push('h.productId=?');args.push(input.productId);}
  if(input.locationId){conditions.push('(h.sourceId=? OR h.destinationId=?)');args.push(input.locationId,input.locationId);}
  if(input.type){conditions.push('h.type=?');args.push(input.type);}
  const from=' FROM ('+this.union()+') h WHERE '+conditions.join(' AND '),c=await this.pool.getConnection();
  try{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.beginTransaction();
   const [[{total}]]=await c.query('SELECT COUNT(*) AS total'+from,args);
   const [records]=await c.query("SELECT h.*,DATE_FORMAT(h.occurred,'%d/%m/%Y %H:%i:%s') AS date"+from+` ORDER BY h.occurred ${input.direction==='asc'?'ASC':'DESC'},LEFT(h.id,1) ${input.direction==='asc'?'ASC':'DESC'},CAST(SUBSTRING(h.id,3) AS UNSIGNED) ${input.direction==='asc'?'ASC':'DESC'} LIMIT ? OFFSET ?`,[...args,input.pageSize,(input.page-1)*input.pageSize]);
   await c.commit();return {records,total:Number(total)};
  }catch(error){await c.rollback();throw error;}finally{c.release();}
 }
}
module.exports=InventoryMovementRepository;
