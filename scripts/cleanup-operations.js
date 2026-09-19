/** Mantenimiento explícito: elimina únicamente claves idempotentes ya confirmadas y antiguas. Nunca corre al iniciar el sistema. */
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const database = require('../src/config/database');

function daysArg(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--dias');
  const raw = at >= 0 ? argv[at + 1] : '30';
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 7 || Number(raw) > 3650) throw new Error('Usa --dias con un valor entre 7 y 3650.');
  return Number(raw);
}
async function cleanup({ days = daysArg(), batch = 1000 } = {}) {
  if (!Number.isSafeInteger(days) || days < 7 || days > 3650 || !Number.isSafeInteger(batch) || batch < 1 || batch > 5000) throw new Error('Parámetros de limpieza no válidos.');
  const pool = database.getPool(); let total = 0;
  for (;;) {
    const c=await pool.getConnection();let deleted=0;
    try{await c.query('SET @paris_limpieza_eliminados=0');await c.query('CALL sp_limpiar_catalogo_operacion(?,?,@paris_limpieza_eliminados)',[days,batch]);const [[row]]=await c.query('SELECT @paris_limpieza_eliminados AS total');deleted=Number(row.total||0);}finally{c.release();}
    total += deleted; if (deleted < batch) break;
  }
  return { days, deleted: total };
}
if (require.main === module) cleanup().then(result => console.log(`Mantenimiento completado: ${result.deleted} operaciones confirmadas con más de ${result.days} días eliminadas.`))
  .catch(error => { console.error(error.code ? 'No se pudo completar el mantenimiento de operaciones.' : error.message); process.exitCode = 1; })
  .finally(() => database.getPool().end());
module.exports = { cleanup, daysArg };
