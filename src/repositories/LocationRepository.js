/** Catálogo de ubicaciones compartido por Compras e Inventario; las altas usan la transacción del llamador. */
class LocationRepository {
 constructor(pool){this.pool=pool;}
 async list(input){
  const args=['%'+input.term.replace(/[!%_]/g,char=>'!'+char)+'%'];
  const [[{total}]]=await this.pool.query("SELECT COUNT(*) AS total FROM ubicacion WHERE estado='ACTIVO' AND nombre LIKE ? ESCAPE '!'",args);
  const [options]=await this.pool.query("SELECT id_ubicacion AS value,nombre AS label FROM ubicacion WHERE estado='ACTIVO' AND nombre LIKE ? ESCAPE '!' ORDER BY nombre,id_ubicacion LIMIT ? OFFSET ?",[...args,input.pageSize,(input.page-1)*input.pageSize]);
  return {options,total:Number(total)};
 }
 async get(c,id){const [[row]]=await c.query('SELECT id_ubicacion AS id,nombre AS name,estado AS state FROM ubicacion WHERE id_ubicacion=? FOR SHARE',[id]);return row;}
 async named(c,name){const [[row]]=await c.query('SELECT id_ubicacion AS id,estado AS state FROM ubicacion WHERE nombre=? FOR SHARE',[name]);return row;}
 async insert(c,name){const [row]=await c.query("INSERT INTO ubicacion(nombre,estado) VALUES(?,'ACTIVO')",[name]);return row.insertId;}
}
module.exports=LocationRepository;
