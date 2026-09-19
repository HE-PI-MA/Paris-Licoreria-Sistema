/** Consultas y ejecución de los procedimientos transaccionales de Ventas U039. */
class SaleRepository {
  constructor(pool){this.pool=pool;}
  escape(value){return String(value).replace(/[!%_]/g,'!$&');}
  async openSession(userId){const [[row]]=await this.pool.query("SELECT id_sesion_caja AS id FROM sesion_caja WHERE id_usuario=? AND estado='ABIERTA' ORDER BY fecha_hora_apertura DESC LIMIT 1",[userId]);return row||null;}
  async products(term=''){
    const like='%'+this.escape(term)+'%';
    const [rows]=await this.pool.query(`SELECT pp.id_presentacion AS id,p.nombre AS product,pp.nombre_presentacion AS presentation,pp.codigo_barras AS barcode,
      pp.factor_conversion AS factor,pp.precio_venta AS price,um.abreviatura AS unit,s.stock_disponible AS stockBase,
      TRUNCATE(s.stock_disponible/pp.factor_conversion,3) AS available
      FROM presentacion_producto pp JOIN producto p ON p.id_producto=pp.id_producto JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida
      JOIN vw_stock_producto s ON s.id_producto=p.id_producto
      WHERE pp.estado='ACTIVO' AND p.estado='ACTIVO' AND s.stock_disponible>0
        AND TRUNCATE(s.stock_disponible/pp.factor_conversion,3)>0
        AND (?='' OR p.nombre LIKE ? ESCAPE '!' OR pp.nombre_presentacion LIKE ? ESCAPE '!' OR pp.codigo_barras=?)
      ORDER BY p.nombre,pp.nombre_presentacion LIMIT 500`,[term,like,like,term]);return rows;
  }
  async create(userId,sessionId,key,hash,data){
    const c=await this.pool.getConnection();try{
      await c.query('SET @paris_venta_id=NULL');
      await c.query('CALL sp_registrar_venta(?,?,?,?,?,?,@paris_venta_id)',[sessionId,userId,key,hash,JSON.stringify(data.details),JSON.stringify(data.payments)]);
      const [[out]]=await c.query('SELECT @paris_venta_id AS id');return Number(out.id);
    }finally{c.release();}
  }
  async operation(sessionId,key){
    const [[row]]=await this.pool.query('SELECT id_venta AS id,solicitud_hash AS hash FROM venta WHERE id_sesion_caja=? AND operacion_clave=? LIMIT 1',[sessionId,key]);
    return row||null;
  }
  async cancel(userId,id,data){const c=await this.pool.getConnection();try{await c.query('CALL sp_anular_venta(?,?,?,?)',[id,userId,data.reason,data.qrRefundReference||null]);}finally{c.release();}}
  async list(input,actor){
    const where=[],args=[];if(actor.rol!=='ADMINISTRADOR'){where.push('v.id_usuario=?');args.push(actor.idUsuario);}if(input.state){where.push('v.estado=?');args.push(input.state);}
    if(input.term){where.push("(CAST(v.id_venta AS CHAR)=? OR v.usuario LIKE ? ESCAPE '!' OR v.caja LIKE ? ESCAPE '!')");const like='%'+this.escape(input.term)+'%';args.push(input.term,like,like);}
    const clause=where.length?'WHERE '+where.join(' AND '):'';const columns={date:'v.fecha_hora',total:'v.total_venta',user:'v.usuario',state:'v.estado'};
    const [[count]]=await this.pool.query(`SELECT COUNT(*) AS total FROM vw_ventas_totales v ${clause}`,args);
    const [records]=await this.pool.query(`SELECT v.id_venta AS id,DATE_FORMAT(v.fecha_hora,'%d/%m/%Y %H:%i') AS date,v.caja,v.usuario AS user,v.total_venta AS total,v.estado AS state,
      v.motivo_anulacion AS cancellationReason FROM vw_ventas_totales v ${clause} ORDER BY ${columns[input.sort]} ${input.direction==='asc'?'ASC':'DESC'},v.id_venta DESC LIMIT ? OFFSET ?`,[...args,input.pageSize,(input.page-1)*input.pageSize]);
    return {records,total:Number(count.total)};
  }
  async detail(id,actor){
    const [[sale]]=await this.pool.query(`SELECT v.id_venta AS id,DATE_FORMAT(v.fecha_hora,'%d/%m/%Y %H:%i') AS date,v.caja,v.usuario AS user,v.id_usuario AS userId,
      v.total_venta AS total,v.estado AS state,v.motivo_anulacion AS cancellationReason,DATE_FORMAT(v.fecha_hora_anulacion,'%d/%m/%Y %H:%i') AS cancelledAt,
      v.anulada_por AS cancelledBy
      FROM vw_ventas_totales v WHERE v.id_venta=?`,[id]);
    if(!sale|| (actor.rol!=='ADMINISTRADOR'&&sale.userId!==actor.idUsuario))return null;
    const [lines]=await this.pool.query(`SELECT p.nombre AS product,pp.nombre_presentacion AS presentation,dv.cantidad AS quantity,dv.precio_unitario AS price,
      ROUND(dv.cantidad*dv.precio_unitario,2) AS subtotal FROM detalle_venta dv JOIN presentacion_producto pp ON pp.id_presentacion=dv.id_presentacion
      JOIN producto p ON p.id_producto=pp.id_producto WHERE dv.id_venta=? ORDER BY dv.id_detalle_venta`,[id]);
    const [payments]=await this.pool.query(`SELECT p.id_pago AS id,p.metodo_pago AS method,p.monto AS amount,p.comprobante_qr AS receipt,
      dp.referencia AS refundReference,DATE_FORMAT(dp.fecha_hora,'%d/%m/%Y %H:%i') AS refundedAt FROM pago p LEFT JOIN devolucion_pago dp ON dp.id_pago=p.id_pago WHERE p.id_venta=? ORDER BY p.id_pago`,[id]);
    return {...sale,lines,payments};
  }
}
module.exports=SaleRepository;
