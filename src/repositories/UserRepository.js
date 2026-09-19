const OperationStore=require('./OperationStore');
class UserRepository{
 constructor(pool){this.pool=pool;this.operations=new OperationStore(pool,{repeatableRead:true});}
 write(metadata,fn){return this.operations.write(metadata,fn);}
 escape(value){return String(value).replace(/[!%_]/g,'!$&');}
 async list(input){const where=[],args=[];if(input.state){where.push('u.estado=?');args.push(input.state);}if(input.term){const like='%'+this.escape(input.term)+'%';where.push("(u.nombre LIKE ? ESCAPE '!' OR u.apellido LIKE ? ESCAPE '!' OR u.nombre_usuario LIKE ? ESCAPE '!' OR r.nombre LIKE ? ESCAPE '!')");args.push(like,like,like,like);}const clause=where.length?'WHERE '+where.join(' AND '):'';const columns={name:'u.nombre',username:'u.nombre_usuario',role:'r.nombre',state:'u.estado'};
  const [[count]]=await this.pool.query(`SELECT COUNT(*) AS total FROM usuario u JOIN rol r ON r.id_rol=u.id_rol ${clause}`,args);
  const [records]=await this.pool.query(`SELECT u.id_usuario AS id,u.nombre AS name,u.apellido AS surname,u.nombre_usuario AS username,r.nombre AS role,u.estado AS state
   FROM usuario u JOIN rol r ON r.id_rol=u.id_rol ${clause} ORDER BY ${columns[input.sort]} ${input.direction==='asc'?'ASC':'DESC'},u.id_usuario LIMIT ? OFFSET ?`,[...args,input.pageSize,(input.page-1)*input.pageSize]);return {records,total:Number(count.total)};}
 async detail(id,c=this.pool,lock=false){const [[row]]=await c.query(`SELECT u.id_usuario AS id,u.nombre AS name,u.apellido AS surname,u.nombre_usuario AS username,u.estado AS state,r.nombre AS role,u.id_rol AS roleId
  FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE u.id_usuario=? ${lock?'FOR UPDATE':''}`,[id]);return row||null;}
 async roleId(c,role){const [[row]]=await c.query('SELECT id_rol AS id FROM rol WHERE nombre=? FOR SHARE',[role]);return row?.id;}
 async username(c,username,id=0){const [[row]]=await c.query('SELECT id_usuario AS id FROM usuario WHERE nombre_usuario=? AND id_usuario<>? FOR UPDATE',[username,id]);return row||null;}
 async activeAdmins(c){const [rows]=await c.query("SELECT u.id_usuario AS id FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE u.estado='ACTIVO' AND r.nombre='ADMINISTRADOR' FOR UPDATE");return rows;}
 async insert(c,data,hash){const roleId=await this.roleId(c,data.role);const [result]=await c.query('INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena,estado) VALUES(?,?,?,?,?,\'ACTIVO\')',[roleId,data.name,data.surname,data.username,hash]);return result.insertId;}
 async update(c,id,data,hash){const roleId=await this.roleId(c,data.role);const sql=hash?'UPDATE usuario SET id_rol=?,nombre=?,apellido=?,nombre_usuario=?,estado=?,contrasena=? WHERE id_usuario=?':'UPDATE usuario SET id_rol=?,nombre=?,apellido=?,nombre_usuario=?,estado=? WHERE id_usuario=?';const args=hash?[roleId,data.name,data.surname,data.username,data.state,hash,id]:[roleId,data.name,data.surname,data.username,data.state,id];await c.query(sql,args);}
}
module.exports=UserRepository;
