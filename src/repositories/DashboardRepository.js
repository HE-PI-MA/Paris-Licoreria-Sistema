class DashboardRepository{
 constructor(pool){this.pool=pool;}
 async summary(actor){const own=actor.rol!=='ADMINISTRADOR';const args=own?[actor.idUsuario]:[];const filter=own?' AND sc.id_usuario=?':'';
  const [[sales]]=await this.pool.query(`SELECT COUNT(*) AS count,COALESCE(SUM(vt.total_venta),0) AS total FROM vw_ventas_totales vt JOIN sesion_caja sc ON sc.id_sesion_caja=vt.id_sesion_caja
   WHERE vt.estado='VIGENTE' AND vt.fecha_hora>=CURRENT_DATE AND vt.fecha_hora<DATE_ADD(CURRENT_DATE,INTERVAL 1 DAY)${filter}`,args);
  const [[open]]=await this.pool.query(`SELECT sc.id_sesion_caja AS id,COALESCE(c.nombre,'Caja histórica') AS cash,CONCAT(u.nombre,' ',u.apellido) AS user,
   DATE_FORMAT(sc.fecha_hora_apertura,'%d/%m/%Y %H:%i') AS openedAt,ee.efectivo_esperado AS expectedCash FROM sesion_caja sc JOIN usuario u ON u.id_usuario=sc.id_usuario
   LEFT JOIN caja c ON c.id_caja=sc.id_caja JOIN vw_efectivo_esperado_sesion ee ON ee.id_sesion_caja=sc.id_sesion_caja WHERE sc.estado='ABIERTA' LIMIT 1`);
  const result={salesToday:{count:Number(sales.count),total:sales.total},openCash:open||null};
  if(actor.rol==='ADMINISTRADOR'){
    const [[stock]]=await this.pool.query("SELECT SUM(CASE WHEN estado_stock='AGOTADO' THEN 1 ELSE 0 END) AS empty,SUM(CASE WHEN estado_stock='STOCK BAJO' THEN 1 ELSE 0 END) AS low FROM vw_stock_producto");
    const [[expiring]]=await this.pool.query('SELECT COUNT(*) AS total FROM vw_lotes_proximos_vencer');result.stock={empty:Number(stock.empty||0),low:Number(stock.low||0),expiring:Number(expiring.total||0)};
  }
  return result;}
}
module.exports=DashboardRepository;
