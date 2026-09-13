/** Contratos y protección HTTP de Inventario. Los efectos reales de stock se comprueban además en MySQL. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Input=require('../src/domain/InventoryInput'),{server,password}=require('./support/application-fixture');
const base={stockId:1,version:'a'.repeat(64),quantity:'1',reason:'conteo físico'};
test('Inventario: cantidades exactas, motivos obligatorios y destinos sin ambigüedad',()=>{
 assert.equal(Input.movement({...base,quantity:'0'},'count').quantity,'0.000');
 assert.equal(Input.movement({...base,destinationName:' heladera  dos '},'transfer').destinationName,'HELADERA DOS');
 for(const quantity of ['-1','1.0001','1e3','Infinity'])assert.throws(()=>Input.movement({...base,quantity},'count'));
 for(const reason of ['', ' ', 'a'.repeat(251),null])assert.throws(()=>Input.movement({...base,reason},'count'));
 assert.throws(()=>Input.movement({...base,quantity:'0',destinationId:2},'transfer'));
 assert.throws(()=>Input.movement({...base,destinationId:2,destinationName:'HELA'},'transfer'));
 assert.throws(()=>Input.movement({...base,type:'INVENTADO'},'remove'));
 assert.throws(()=>Input.movement({...base,productId:7},'count'));
 assert.throws(()=>Input.listing({sort:'DROP TABLE'}));assert.throws(()=>Input.history({type:'BORRAR'}));
});
test('Inventario: sesión, activación, CSRF, administrador y rutas de consulta',async()=>{
 const calls=[],repo={list:async()=>({records:[],total:0}),detail:async id=>({id}),lots:async(id,q)=>({records:[],total:0}),stock:async id=>({id}),places:{list:async()=>({options:[],total:0})},movements:{list:async()=>({records:[],total:0})},write:async(meta)=>{calls.push(meta);return {id:1};}};
 const app=await server({inventoryRepository:repo});
 try{
  assert.equal((await app.request('/api/inventario')).status,401);
  const form=await app.form(),login=await app.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form),auth=await app.form('/inventario',login.cookie);
  for(const route of ['/api/inventario','/api/inventario/1','/api/inventario/1/lotes','/api/inventario/ubicaciones','/api/inventario/movimientos','/api/inventario/existencias/1'])assert.equal((await app.request(route,{headers:{Cookie:auth.cookie}})).status,200,route);
  const headers={'x-operation-id':crypto.randomUUID()};assert.equal((await app.post('/api/inventario/conteos',base,{cookie:auth.cookie,token:''},headers)).status,403);assert.equal(calls.length,0);
  const saved=await app.post('/api/inventario/conteos',base,auth,headers);assert.equal(saved.status,201,saved.text);assert.equal(calls.length,1);
  app.setUser({id_usuario:1,id_rol:2,nombre:'Cajero',nombre_usuario:'audit_user',estado:'ACTIVO',rol:'ENCARGADO_VENTA'});
  assert.equal((await app.request('/api/inventario',{headers:{Cookie:auth.cookie}})).status,403);
  assert.equal((await app.post('/api/inventario/conteos',base,auth,headers)).status,403);assert.equal(calls.length,1);
 }finally{await app.close();}
});
