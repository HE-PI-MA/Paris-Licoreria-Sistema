/** Alta inicial de administrador desde consola; valida contraseña y rol sin imprimir el secreto introducido. */
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const database = require('../src/config/database');
const safeLog = require('../src/utils/safeLog');
async function createAdmin() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk, encoding); done(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  const ask = (text, secret = false) => new Promise(resolve => {
    process.stdout.write(text); hidden = secret;
    rl.question('', answer => { hidden = false; if (secret) process.stdout.write('\n'); resolve(answer); });
  });
  let c;
  try {
    const username = (await ask('Nombre de usuario: ')).trim();
    const nombre = (await ask('Nombre: ')).trim();
    const apellido = (await ask('Apellido: ')).trim();
    const password = await ask('Contrasena (12 caracteres como minimo): ', true);
    const confirmation = await ask('Repite la contrasena: ', true);
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username) || !nombre || nombre.length>80 || !apellido || apellido.length>80 || password !== confirmation || password.length<12 || Buffer.byteLength(password)>72) {
      throw new Error('Datos invalidos. Verifica nombres y contrasena de 12 caracteres a 72 bytes.');
    }
    const hash = await bcrypt.hash(password, 12);
    c = await database.getPool().getConnection();
    const [[lock]] = await c.query("SELECT GET_LOCK(CONCAT(DATABASE(), '_bootstrap'), 0) AS acquired");
    if (Number(lock.acquired)!==1) throw new Error('Otra configuracion de administrador esta en curso.');
    await c.beginTransaction();
    const [active] = await c.query("SELECT u.id_usuario FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE r.nombre='ADMINISTRADOR' AND u.estado='ACTIVO' AND u.contrasena NOT LIKE '%HASH_DE_DEMOSTRACION%' FOR UPDATE");
    if (active.length) throw new Error('Ya existe un administrador. Este comando solo configura el acceso inicial.');
    const [roles] = await c.query("SELECT id_rol FROM rol WHERE nombre='ADMINISTRADOR'");
    if (roles.length!==1) throw new Error('No existe el rol ADMINISTRADOR.');
    const [existing] = await c.execute('SELECT id_usuario, contrasena FROM usuario WHERE nombre_usuario=? FOR UPDATE',[username]);
    if (existing.length && !existing[0].contrasena.includes('HASH_DE_DEMOSTRACION')) throw new Error('El usuario existente no es de demostracion; no se modifica.');
    if (existing.length) await c.execute("UPDATE usuario SET id_rol=?,nombre=?,apellido=?,contrasena=?,estado='ACTIVO' WHERE id_usuario=?",[roles[0].id_rol,nombre,apellido,hash,existing[0].id_usuario]);
    else await c.execute("INSERT INTO usuario(id_rol,nombre,apellido,nombre_usuario,contrasena,estado) VALUES(?,?,?,?,?,'ACTIVO')",[roles[0].id_rol,nombre,apellido,username,hash]);
    await c.commit();
    console.log('Administrador inicial configurado.');
  } catch(error) { if(c) await c.rollback(); throw error; }
  finally { rl.close(); if(c) { await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), '_bootstrap'))"); c.release(); } }
}
createAdmin().catch(error=>{safeLog('ADMIN_BOOTSTRAP_FAILED',error);console.error(error.code?'No se pudo configurar el administrador. Revisa permisos y conexion.':error.message);process.exitCode=1;})
  .finally(()=>database.getPool().end());
