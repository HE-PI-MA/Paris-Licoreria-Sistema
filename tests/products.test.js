/** Validación y límites HTTP U012; dobles de repositorio aislados, sin cargar .env ni datos reales. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ProductInput: Input } = require('../src/domain/ProductInput');
const ProductService = require('../src/services/ProductService');
const { server, password, user } = require('./support/application-fixture');
const valid = { name:'Botella de prueba', categoryId:'1', unitId:'1', description:'', minimum:'0', state:'ACTIVO' };
test('U012: precisión decimal, límites, estados y rechazo de stock o campos inesperados', () => {
  assert.equal(Input.product(valid).minimum,'0.000');
  assert.equal(Input.presentation({name:'Unidad',factor:'0001.5',price:'0',barcode:'',state:'ACTIVO'}).factor,'1.500');
  assert.equal(Input.presentation({name:'Unidad',factor:'1',price:'0',barcode:'',state:'ACTIVO'}).barcode,null);
  for (const minimum of ['-1','1e3','1.1234','Infinity','1000000000000']) assert.throws(()=>Input.product({...valid,minimum}));
  for (const override of [{stock:'10'}, {name:' '}, {name:'a'.repeat(121)}, {categoryId:'1 OR 1=1'}, {state:'activo'}, {unitId:0}]) assert.throws(()=>Input.product({...valid,...override}));
  assert.throws(()=>Input.page({sort:'name; DROP TABLE producto'}));
  assert.throws(()=>Input.page({pageSize:'101'}));
  assert.throws(()=>Input.presentation({name:'Caja',factor:'0',price:'10',barcode:'',state:'ACTIVO'}));
});
test('U012: historial y versiones bloquean eliminaciones y equivalencias protegidas', async () => {
  const row={id:1,version:'a'.repeat(64),categoryId:1,unitId:1,state:'ACTIVO'}, child={id:2,version:'b'.repeat(64),factor:'1.000',state:'ACTIVO'};
  let deleted=0;
  const repo={write:async(_,op)=>op({}),getProduct:async()=>row,getPresentation:async()=>child,lockPresentations:async()=>[{id:2}],used:async()=>true,deleteProduct:async()=>deleted++,updatePresentation:async()=>assert.fail('No debe editar un factor usado')};
  const service=new ProductService(repo), key=()=>crypto.randomUUID();
  await assert.rejects(service.remove(1,key(),1,{version:row.version}),e=>e.status===409&&/historial/.test(e.message));
  assert.equal(deleted,0);
  await assert.rejects(service.remove(1,key(),1,{version:'c'.repeat(64)}),e=>e.status===409&&/Otra operación/.test(e.message));
  await assert.rejects(service.update(1,key(),1,{...valid,unitId:'2',version:row.version}),e=>Boolean(e.fieldErrors.unitId));
  await assert.rejects(service.savePresentation(1,key(),1,2,{name:'Caja',factor:'12',price:'10',barcode:'',state:'ACTIVO',version:child.version}),e=>Boolean(e.fieldErrors.factor));
});
test('U012: API exige sesión, licencia, rol, CSRF e identificador de operación', async () => {
  let writes=0;
  const app=await server({productRepository:{list:async()=>({records:[],total:0}),write:async()=>{writes++;return{id:7};}}});
  try {
    assert.equal((await app.request('/api/productos')).status,401);
    const f=await app.form(),login=await app.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},f);
    const form=await app.form('/productos',login.cookie);
    assert.equal((await app.request('/api/productos',{headers:{Cookie:login.cookie}})).status,200);
    assert.equal((await app.post('/api/productos',valid,form)).status,400);
    assert.equal((await app.post('/api/productos',valid,{cookie:form.cookie},{'x-operation-id':crypto.randomUUID()})).status,403);
    const saved=await app.post('/api/productos',valid,form,{'x-operation-id':crypto.randomUUID()}); assert.equal(saved.status,201,saved.text); assert.equal(writes,1);
    app.setUser({...user,id_rol:2,rol:'ENCARGADO_VENTA'});
    for(const path of ['/api/productos','/api/productos/1','/api/productos/1/presentaciones','/api/productos/opciones/categories']) assert.equal((await app.request(path,{headers:{Cookie:login.cookie}})).status,403);
    assert.equal((await app.post('/api/productos',valid,form,{'x-operation-id':crypto.randomUUID()})).status,403); assert.equal(writes,1);
    app.setUser({...user});app.setData(null);
    assert.equal((await app.request('/api/productos',{headers:{Cookie:login.cookie}})).status,403);
  } finally {await app.close();}
});
