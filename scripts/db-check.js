const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const database = require('../src/config/database');
const safeLog = require('../src/utils/safeLog');
const checks = {
  'Ventas fuera del horario de caja': `SELECT COUNT(*) AS total FROM venta v JOIN sesion_caja s ON s.id_sesion_caja=v.id_sesion_caja WHERE v.fecha_hora<s.fecha_hora_apertura OR (s.fecha_hora_cierre IS NOT NULL AND v.fecha_hora>s.fecha_hora_cierre)`,
  'Ventas con pagos distintos de su total': `SELECT COUNT(*) AS total FROM (SELECT v.id_venta FROM vw_ventas_totales v LEFT JOIN pago p ON p.id_venta=v.id_venta GROUP BY v.id_venta,v.total_venta HAVING COALESCE(SUM(p.monto),0)<>v.total_venta) t`,
  'Stock negativo': 'SELECT COUNT(*) AS total FROM lote_ubicacion WHERE cantidad_actual<0',
  'Usuarios con contrasenas de demostracion': "SELECT COUNT(*) AS total FROM usuario WHERE contrasena LIKE '%HASH_DE_DEMOSTRACION%'"
};
(async () => {
  for (const [label, sql] of Object.entries(checks)) {
    const [[row]] = await database.getPool().query(sql);
    console.log(label + ': ' + row.total);
    if (Number(row.total)) process.exitCode = 1;
  }
  console.log('Comprobacion de solo lectura. Los datos historicos no se corrigen automaticamente.');
})().catch(error => { safeLog('DB_CHECK_FAILED', error); process.exitCode = 1; })
  .finally(() => database.getPool().end());
