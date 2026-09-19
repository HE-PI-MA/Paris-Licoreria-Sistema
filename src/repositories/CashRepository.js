/** Persistencia de Caja: dos cajas físicas, un turno abierto global y arqueos trazables. */
class CashRepository {
  constructor(pool) { this.pool = pool; }
  async boxes() {
    const [rows] = await this.pool.query("SELECT id_caja AS id,nombre AS name,estado AS state FROM caja ORDER BY id_caja"); return rows;
  }
  async denominations() {
    const [rows] = await this.pool.query("SELECT id_denominacion AS id,valor AS value,tipo AS type FROM denominacion WHERE estado='ACTIVO' ORDER BY valor DESC,id_denominacion"); return rows;
  }
  async current(userId = null) {
    const args = []; let where = "WHERE sc.estado='ABIERTA'";
    if (userId) { where += ' AND sc.id_usuario=?'; args.push(userId); }
    const [[row]] = await this.pool.query(`SELECT sc.id_sesion_caja AS id,sc.id_caja AS cashId,COALESCE(c.nombre,'Caja histórica') AS cash,
      sc.id_usuario AS userId,CONCAT(u.nombre,' ',u.apellido) AS user,DATE_FORMAT(sc.fecha_hora_apertura,'%d/%m/%Y %H:%i') AS openedAt,
      sc.monto_inicial AS initialAmount,ee.efectivo_esperado AS expectedCash,
      COALESCE(SUM(CASE WHEN v.estado='VIGENTE' THEN 1 ELSE 0 END),0) AS salesCount,
      COALESCE(SUM(CASE WHEN v.estado='VIGENTE' THEN vt.total_venta ELSE 0 END),0) AS salesTotal
      FROM sesion_caja sc JOIN usuario u ON u.id_usuario=sc.id_usuario LEFT JOIN caja c ON c.id_caja=sc.id_caja
      JOIN vw_efectivo_esperado_sesion ee ON ee.id_sesion_caja=sc.id_sesion_caja
      LEFT JOIN venta v ON v.id_sesion_caja=sc.id_sesion_caja LEFT JOIN vw_ventas_totales vt ON vt.id_venta=v.id_venta
      ${where} GROUP BY sc.id_sesion_caja,sc.id_caja,c.nombre,sc.id_usuario,u.nombre,u.apellido,sc.fecha_hora_apertura,sc.monto_inicial,ee.efectivo_esperado
      ORDER BY sc.fecha_hora_apertura DESC LIMIT 1`, args);
    return row || null;
  }
  async open(userId, data) {
    const c = await this.pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await c.beginTransaction();
      const [boxes] = await c.query("SELECT id_caja AS id,estado AS state FROM caja WHERE estado='ACTIVA' ORDER BY id_caja FOR UPDATE");
      if (!boxes.some(row => row.id === data.cashId)) { const e = new Error('CAJA_INACTIVA'); e.business = true; throw e; }
      const [[actor]] = await c.query("SELECT estado AS state FROM usuario WHERE id_usuario=? FOR SHARE", [userId]);
      if (!actor || actor.state !== 'ACTIVO') { const e = new Error('USUARIO_INACTIVO'); e.business = true; throw e; }
      const [[opened]] = await c.query("SELECT id_sesion_caja AS id FROM sesion_caja WHERE estado='ABIERTA' LIMIT 1 FOR UPDATE");
      if (opened) { const e = new Error('CAJA_YA_ABIERTA'); e.business = true; throw e; }
      const [result] = await c.query('INSERT INTO sesion_caja(id_caja,id_usuario,monto_inicial,observacion) VALUES(?,?,?,?)', [data.cashId,userId,data.initialAmount,data.observation || null]);
      await c.commit(); return result.insertId;
    } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
  }
  async close(sessionId, userId, data) {
    const c = await this.pool.getConnection();
    try {
      await c.query('SET @paris_arqueo_id=NULL');
      await c.query('CALL sp_cerrar_sesion_caja(?,?,NULL,?,?,@paris_arqueo_id)', [sessionId,userId,data.observation || null,JSON.stringify(data.count)]);
      const [[out]] = await c.query('SELECT @paris_arqueo_id AS id');
      const [[row]] = await c.query(`SELECT d.id_sesion_caja AS sessionId,d.caja,d.efectivo_esperado AS expectedCash,d.efectivo_contado AS countedCash,
        d.diferencia AS difference,d.resultado AS result FROM vw_diferencias_caja d WHERE d.id_sesion_caja=?`, [sessionId]);
      return { ...(row || {}), auditId: Number(out.id) };
    } finally { c.release(); }
  }
  async history(input, actor) {
    const args = []; const where = [];
    if (actor.rol !== 'ADMINISTRADOR') { where.push('sc.id_usuario=?'); args.push(actor.idUsuario); }
    if (input.term) { where.push("(CAST(sc.id_sesion_caja AS CHAR)=? OR COALESCE(c.nombre,'Caja histórica') LIKE ? ESCAPE '!' OR CONCAT(u.nombre,' ',u.apellido) LIKE ? ESCAPE '!')"); const term=this.escape(input.term);args.push(input.term,'%'+term+'%','%'+term+'%'); }
    const clause = where.length ? 'WHERE '+where.join(' AND ') : '';
    const columns = { date:'sc.fecha_hora_apertura', cash:'c.nombre', user:'u.nombre', state:'sc.estado' };
    const queryArgs = [...args,input.pageSize,(input.page-1)*input.pageSize];
    const [[count]] = await this.pool.query(`SELECT COUNT(*) AS total FROM sesion_caja sc JOIN usuario u ON u.id_usuario=sc.id_usuario LEFT JOIN caja c ON c.id_caja=sc.id_caja ${clause}`,args);
    const [records] = await this.pool.query(`SELECT sc.id_sesion_caja AS id,COALESCE(c.nombre,'Caja histórica') AS cash,CONCAT(u.nombre,' ',u.apellido) AS user,
      DATE_FORMAT(sc.fecha_hora_apertura,'%d/%m/%Y %H:%i') AS openedAt,DATE_FORMAT(sc.fecha_hora_cierre,'%d/%m/%Y %H:%i') AS closedAt,
      sc.monto_inicial AS initialAmount,sc.estado AS state FROM sesion_caja sc JOIN usuario u ON u.id_usuario=sc.id_usuario LEFT JOIN caja c ON c.id_caja=sc.id_caja
      ${clause} ORDER BY ${columns[input.sort]} ${input.direction==='asc'?'ASC':'DESC'},sc.id_sesion_caja DESC LIMIT ? OFFSET ?`,queryArgs);
    return { records,total:Number(count.total) };
  }
  escape(value){return String(value).replace(/[!%_]/g,'!$&');}
}
module.exports = CashRepository;
