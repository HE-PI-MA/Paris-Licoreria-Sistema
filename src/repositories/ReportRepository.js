class ReportRepository{
 constructor(pool){this.pool=pool;}
 async summary({from,to}){const range=[from+' 00:00:00',to+' 23:59:59'];
  const [[sales]]=await this.pool.query(`SELECT COALESCE(SUM(CASE WHEN estado='VIGENTE' THEN 1 ELSE 0 END),0) AS count,
    COALESCE(SUM(CASE WHEN estado='VIGENTE' THEN total_venta ELSE 0 END),0) AS total,
    COALESCE(SUM(CASE WHEN estado='ANULADA' THEN 1 ELSE 0 END),0) AS cancelled FROM vw_ventas_totales WHERE fecha_hora BETWEEN ? AND ?`,range);
  const [[purchases]]=await this.pool.query('SELECT COUNT(*) AS count,COALESCE(SUM(total_compra),0) AS total FROM vw_compras_totales WHERE fecha_hora BETWEEN ? AND ?',range);
  const [top]=await this.pool.query(`SELECT p.nombre AS product,pp.nombre_presentacion AS presentation,SUM(dv.cantidad) AS quantity,
    SUM(ROUND(dv.cantidad*dv.precio_unitario,2)) AS income FROM detalle_venta dv JOIN venta v ON v.id_venta=dv.id_venta
    JOIN presentacion_producto pp ON pp.id_presentacion=dv.id_presentacion JOIN producto p ON p.id_producto=pp.id_producto
    WHERE v.estado='VIGENTE' AND v.fecha_hora BETWEEN ? AND ? GROUP BY p.id_producto,p.nombre,pp.id_presentacion,pp.nombre_presentacion
    ORDER BY income DESC,quantity DESC LIMIT 10`,range);
  const [cash]=await this.pool.query(`SELECT d.id_sesion_caja AS id,d.caja,d.usuario,DATE_FORMAT(d.fecha_hora_apertura,'%d/%m/%Y %H:%i') AS openedAt,
    DATE_FORMAT(d.fecha_hora_cierre,'%d/%m/%Y %H:%i') AS closedAt,d.efectivo_esperado AS expected,d.efectivo_contado AS counted,d.diferencia AS difference,d.resultado AS result
    FROM vw_diferencias_caja d WHERE d.fecha_hora_apertura BETWEEN ? AND ? ORDER BY d.fecha_hora_apertura DESC LIMIT 50`,range);
  const [[inventory]]=await this.pool.query(`SELECT COALESCE(SUM(stock_fisico),0) AS physical,COALESCE(SUM(stock_disponible),0) AS available,COALESCE(SUM(stock_vencido),0) AS expired,
    COALESCE(SUM(CASE WHEN estado_stock IN ('AGOTADO','STOCK BAJO') THEN 1 ELSE 0 END),0) AS lowProducts FROM vw_stock_producto`);
  return {period:{from,to},sales:{count:Number(sales.count),total:sales.total,cancelled:Number(sales.cancelled)},purchases:{count:Number(purchases.count),total:purchases.total},inventory,top,cash};}
}
module.exports=ReportRepository;
