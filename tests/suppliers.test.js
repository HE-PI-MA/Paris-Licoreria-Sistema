/** Proveedores U023: reglas, transacciones compartidas, consultas SQL y permisos HTTP con datos ficticios. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const Input = require('../src/domain/SupplierInput');
const SupplierService = require('../src/services/SupplierService');
const SupplierRepository = require('../src/repositories/SupplierRepository');
const { SupplierMemoryRepository } = require('./support/supplier-fixture');
const { server, password, user } = require('./support/application-fixture');
const key = () => crypto.randomUUID();
const valid = { name: 'Distribuidora de prueba', contact: 'Ana Pérez', phone: '+591 7000-0000', nit: '0012345', address: 'Calle de prueba', state: 'ACTIVO' };
test('U023: valida campos, mayúsculas, NIT opcional, teléfono y consultas acotadas', () => {
  const data = Input.supplier(valid); assert.equal(data.name, 'DISTRIBUIDORA DE PRUEBA'); assert.equal(data.contact, 'ANA PÉREZ'); assert.equal(data.nit, '0012345');
  assert.equal(Input.supplier({ name: 'Solo nombre', state: 'ACTIVO' }).nit, null);
  for (const change of [{ name: ' ' }, { name: 'a'.repeat(121) }, { contact: 'a'.repeat(101) }, { address: 'a'.repeat(201) }, { phone: 'abc' }, { phone: '123' }, { nit: '1e3' }, { nit: 123 }, { nit: '1'.repeat(31) }, { state: 'activo' }, { stock: 5 }, { id: 1 }]) assert.throws(() => Input.supplier({ ...valid, ...change }));
  for (const query of [{ pageSize: '101' }, { sort: 'name; DELETE' }, { term: ['a', 'b'] }, { state: 'INVENTADO' }, { categoryId: '1' }]) assert.throws(() => Input.list(query));
});
test('U023: crear, consultar, editar, filtrar, cambiar estado y eliminar sin compras', async () => {
  const repo = new SupplierMemoryRepository(), service = new SupplierService(repo);
  const created = await service.create(1, key(), valid); let row = await service.detail(created.id);
  assert.equal(row.name, valid.name.toUpperCase()); assert.equal(row.version.length, 64);
  await service.update(1,key(),row.id,{...valid,contact:'Luis',version:row.version}); row=await service.detail(row.id); assert.equal(row.contact,'LUIS');
  await service.state(1,key(),row.id,{state:'INACTIVO',version:row.version});row=await service.detail(row.id);
  assert.equal((await service.list({term:'7000',state:'INACTIVO'})).total,1);
  assert.equal((await service.list({state:'ACTIVO'})).total,0);
  await service.remove(1,key(),row.id,{version:row.version});await assert.rejects(service.detail(row.id),e=>e.status===404);
});
test('U023: respuesta perdida y dos envíos concurrentes escriben una vez; claves no mezclan usuarios ni datos', async () => {
  const repo=new SupplierMemoryRepository(),service=new SupplierService(repo),id=key();
  const [first,second]=await Promise.all([service.create(1,id,valid),service.create(1,id,valid)]);assert.deepEqual(first,second);assert.equal(repo.pool.data.rows.length,1);assert.equal(repo.pool.writes,1);
  assert.deepEqual(await service.create(1,id,valid),first);
  await assert.rejects(service.create(1,id,{...valid,name:'Otra empresa'}),e=>e.status===409);assert.equal(repo.pool.writes,1);
  await service.create(2,id,{...valid,nit:''});assert.equal(repo.pool.data.rows.length,2);
});
test('U023: historial, versión y NIT único protegen las escrituras y revierten la operación fallida', async () => {
  const repo=new SupplierMemoryRepository(),service=new SupplierService(repo);
  await service.create(1,key(),valid);let row=await service.detail(1);repo.pool.data.purchases.add(1);
  const deleteKey=key();await assert.rejects(service.remove(1,deleteKey,1,{version:row.version}),e=>e.status===409&&/compras/.test(e.message));assert.equal(repo.pool.data.rows.length,1);assert.equal(repo.pool.data.operations.has('1:'+deleteKey),false);
  await service.state(1,key(),1,{version:row.version,state:'INACTIVO'});
  await assert.rejects(service.update(1,key(),1,{...valid,version:row.version}),e=>e.status===409&&/Otra operación/.test(e.message));
  await assert.rejects(service.create(1,key(),valid),e=>Boolean(e.fieldErrors?.nit));assert.equal(repo.pool.data.rows.length,1);
  row=await service.detail(1);await service.state(1,key(),1,{version:row.version,state:'ACTIVO'});assert.ok(repo.pool.data.purchases.has(1));
});
test('U023: SQL parametrizado, búsqueda literal, orden permitido y bloqueo para conservar compras', async () => {
  const calls=[];const c={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{calls.push({sql,args});return sql.startsWith('SELECT COUNT')?[[{total:0}]]:[[]];}};
  const repo=new SupplierRepository({getConnection:async()=>c});const term="%' OR 1=1 --_";
  await repo.list(Input.list({term,page:'2',pageSize:'5'}));assert.ok(calls.every(x=>!x.sql.includes(term)));assert.equal(calls[0].args[0],"%!%' OR 1=1 --!_%");assert.deepEqual(calls[1].args.slice(-2),[5,5]);
  await repo.get(7,c,true);assert.match(calls.at(-1).sql,/FOR UPDATE$/);assert.deepEqual(calls.at(-1).args,[7]);
  await repo.used(c,7);assert.match(calls.at(-1).sql,/LIMIT 1 FOR SHARE$/);
  await assert.rejects(repo.list({...Input.list({}),sort:'DROP'}),e=>e.status===400);
});
test('U023: API y página exigen sesión, licencia, administrador, CSRF y clave de operación', async () => {
  const repo=new SupplierMemoryRepository(),s=await server({supplierRepository:repo});
  try{
    assert.equal((await s.request('/api/proveedores')).status,401);assert.equal((await s.request('/proveedores')).status,302);
    const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},await s.form());const form=await s.form('/proveedores',login.cookie),headers={Cookie:form.cookie};
    assert.equal((await s.post('/api/proveedores',valid,form)).status,400);
    assert.equal((await s.post('/api/proveedores',valid,{cookie:form.cookie},{'x-operation-id':key()})).status,403);
    const created=await s.post('/api/proveedores',valid,form,{'x-operation-id':key()});assert.equal(created.status,201,created.text);
    const row=JSON.parse((await s.request('/api/proveedores/1',{headers})).text);
    assert.equal((await s.post('/api/proveedores/1/editar',{...valid,contact:'Otra persona',version:row.version},form,{'x-operation-id':key()})).status,200);
    assert.equal((await s.request('/api/proveedores?state=ACTIVO',{headers})).status,200);
    s.setUser({...user,id_rol:2,rol:'ENCARGADO_VENTA'});
    for(const route of ['/proveedores','/api/proveedores','/api/proveedores/1'])assert.equal((await s.request(route,{headers})).status,403);
    for(const route of ['/api/proveedores','/api/proveedores/1/editar','/api/proveedores/1/estado','/api/proveedores/1/eliminar'])assert.equal((await s.post(route,valid,form,{'x-operation-id':key()})).status,403);
    s.setUser({...user});s.setData(null);assert.equal((await s.request('/api/proveedores',{headers})).status,403);
    assert.equal(repo.pool.writes,2);
  }finally{await s.close();}
});
test('U023: fallos de configuración devuelven 503 sin mensajes SQL internos', async () => {
  const s=await server({supplierRepository:{list:async()=>{throw Object.assign(new Error('private SQL credentials'),{code:'ER_BAD_FIELD_ERROR'});}}});
  try{const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},await s.form());const r=await s.request('/api/proveedores',{headers:{Cookie:login.cookie}});assert.equal(r.status,503);assert.doesNotMatch(r.text,/private|credentials|SELECT/);}finally{await s.close();}
});
