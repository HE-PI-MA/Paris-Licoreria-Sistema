/** Comprueba autenticación, licencia, permisos y páginas mediante el servidor ficticio compartido. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const App = require('../src/app');
const MySqlSessionStore = require('../src/services/MySqlSessionStore');
const LicensePayload = require('../src/core/LicensePayload');
const runtime = require('../src/config/runtime');
const { splitSql } = require('../scripts/sql');
const MachineFingerprint = require('../src/utils/MachineFingerprint');
const RoleMiddleware = require('../src/middleware/RoleMiddleware');
const { server, scenario, user, password, code, signed, license, sessionPool, keys, fingerprint } = require('./support/application-fixture');
test('U006: shared module structure, authenticated navigation, profile and local assets',()=>scenario(async s=>{
  const form=await s.form();
  assert.ok(form.response.text.indexOf('/js/components/auth-form.js') >= 0);
  assert.ok(form.response.text.indexOf('/js/components/auth-form.js') < form.response.text.indexOf('/js/pages/login.js'));
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);
  const headers={Cookie:login.cookie};
  for(const item of require('../src/config/navigation').modules){
    const response=await s.request(item.href,{headers});
    assert.equal(response.status,200,response.text);
    assert.ok(response.text.includes(`href="${item.href}" aria-label="${item.label}" aria-current="page"`));
    assert.ok(response.text.includes('id="profile-menu"'));
    assert.ok(!response.text.includes('data-sidebar-toggle'));
    assert.ok(!response.text.includes('sidebar-preference.js'));
    assert.match(response.text, /<div class="sidebar-brand" role="img"/);
    assert.ok(response.text.includes('name="csrf-token"'));
    let previousRegion = -1;
    for (const region of ['header', 'controls', 'content', 'messages']) {
      const position = response.text.indexOf(`data-module-region="${region}"`);
      assert.ok(position > previousRegion, `${item.id}: falta la sección ${region} o está fuera de orden`);
      previousRegion = position;
    }
    if (item.id === 'productos') {
      assert.doesNotMatch(response.text, /data-module-primary[^>]*disabled/);
      assert.match(response.text, /id="products-table"/);
      assert.match(response.text, /js\/pages\/products.js/);
    } else {
      assert.match(response.text, /class="module-primary-action app-button app-button--primary"[^>]*\bdisabled/);
      assert.match(response.text, /id="module-search"[^>]+disabled/);
    }
    assert.ok(response.text.includes('data-module-error'));
    if(!['inicio','productos'].includes(item.id))assert.ok(response.text.includes('Módulo en preparación'));
  }
  s.setUser({...user,nombre:'<script>alert(1)</script>',apellido:'& Usuario'});
  const profile=await s.request('/perfil',{headers});
  assert.equal(profile.status,200);
  assert.ok(profile.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!profile.text.includes('<script>alert(1)</script>'));
  assert.ok(profile.text.includes('audit_user'));
  assert.ok(!profile.text.includes(user.contrasena));
  assert.ok(!profile.text.includes('data-module-layout='));
  for(const asset of ['/js/components/auth-form.js','/css/components/sidebar.css','/js/components/sidebar.js','/fonts/inter/InterVariable.woff2','/img/brand/paris-isologo.png','/css/components/module-layout.css','/js/components/module-layout.js']) {
    assert.equal((await s.request(asset)).status,200,asset);
  }
}));
test('U009: demostración protegida y componentes compartidos disponibles separada del catálogo real de Productos',()=>scenario(async s=>{
  assert.equal((await s.request('/demostracion/componentes')).status,302);
  const form=await s.form();
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);
  const headers={Cookie:login.cookie};
  const demo=await s.request('/demostracion/componentes',{headers});
  assert.equal(demo.status,200);
  assert.match(demo.text,/DEMOSTRACIÓN CON DATOS FICTICIOS/);
  assert.match(demo.text,/data-demo-table/);
  assert.ok(!/data-module-primary[^>]*disabled/.test(demo.text));
  const order=['ui-core','messages','modal','form-controller','data-table','module-layout'];
  let previous=-1;
  for(const file of order){
    const url='/js/components/'+file+'.js';
    const index=demo.text.indexOf(url);
    assert.ok(index>previous,url);previous=index;
    assert.equal((await s.request(url)).status,200);
  }
  for(const name of ['buttons','forms','messages','modal','data-table']){
    assert.equal((await s.request('/css/components/'+name+'.css')).status,200);
  }
  const products=await s.request('/productos',{headers});
  assert.doesNotMatch(products.text,/data-module-primary[^>]*disabled/);
  assert.ok(!products.text.includes('/js/pages/components-demo.js'));
  assert.ok(!products.text.includes('href="/demostracion/componentes"'));
  s.setUser({...user,id_rol:2,rol:'ENCARGADO_VENTA'});
  assert.equal((await s.request('/demostracion/componentes',{headers})).status,403);
  s.setUser({...user});s.setData(null);
  assert.equal((await s.request('/demostracion/componentes',{headers})).headers.get('location'),'/activar');
}));

test('U005: seller navigation and direct requests enforce the same role limits',()=>scenario(async s=>{
  s.setUser({...user,id_rol:2,rol:'ENCARGADO_VENTA'});
  const form=await s.form();
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);
  const headers={Cookie:login.cookie};
  const home=await s.request('/inicio',{headers});
  for(const item of require('../src/config/navigation').modules){
    const allowed=item.roles.includes('ENCARGADO_VENTA');
    assert.equal(home.text.includes(`href="${item.href}" aria-label="${item.label}"`),allowed,item.id);
    assert.equal((await s.request(item.href,{headers})).status,allowed?200:403,item.id);
  }
  assert.equal((await s.request('/perfil',{headers})).status,200);
}));
test('U005: module pages and profile require an active session and license',()=>scenario(async s=>{
  for(const route of ['/productos','/ventas','/perfil']){
    const response=await s.request(route);
    assert.equal(response.status,302);
    assert.equal(response.headers.get('location'),'/login?sesion=vencida');
  }
  const form=await s.form();
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);
  s.setUser({...user,estado:'INACTIVO'});
  const inactive=await s.request('/perfil',{headers:{Cookie:login.cookie}});
  assert.equal(inactive.status,302);
  s.setUser({...user});
  s.setData(null);
  const noActivation=await s.request('/ventas');
  assert.equal(noActivation.status,302);
  assert.equal(noActivation.headers.get('location'),'/activar');
  const activation=await s.request('/activar');
  assert.equal(activation.status,200);
  assert.ok(activation.text.indexOf('/js/components/auth-form.js') >= 0);
  assert.ok(activation.text.indexOf('/js/components/auth-form.js') < activation.text.indexOf('/js/pages/activation.js'));
}));
test('valid login, session rotation, me, logout and inactive user',()=>scenario(async s=>{
  const f=await s.form();const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},f);
  assert.equal(login.status,200);assert.ok(login.cookie);assert.notEqual(login.cookie,f.cookie);assert.ok(!login.text.includes(user.contrasena));
  assert.equal((await s.request('/api/auth/me',{headers:{Cookie:login.cookie}})).status,200);
  const home=await s.form('/inicio',login.cookie);
  assert.equal((await s.post('/api/auth/logout',{},home)).status,200);
  assert.equal((await s.request('/api/auth/me',{headers:{Cookie:home.cookie}})).status,401);
  const newForm=await s.form();const again=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},newForm);
  s.setUser({...user,estado:'INACTIVO'});
  assert.equal((await s.request('/api/auth/me',{headers:{Cookie:again.cookie}})).status,401);
}));
test('MySQL store survives creation of a second app instance and rejects expired sessions',async()=>{
  const pool=sessionPool();const a=await server({pool});let cookie;
  try{const f=await a.form();cookie=(await a.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},f)).cookie;}finally{await a.close();}
  await scenario(async b=>{
    assert.equal((await b.request('/api/auth/me',{headers:{Cookie:cookie}})).status,200);
    for(const row of pool.rows.values())row.expires_at=0;
    assert.equal((await b.request('/api/auth/me',{headers:{Cookie:cookie}})).status,401);
  },{pool});
});
test('production behind explicitly trusted HTTPS proxy issues a Secure cookie',()=>scenario(async s=>{
  const f=await s.form();assert.match(f.response.headers.get('set-cookie'),/Secure/);
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},f,{Origin:'https://paris.test'});
  assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/);
  assert.equal((await s.request('/api/auth/me',{headers:{Cookie:login.cookie}})).status,200);
},{production:true}));
test('production rejects incomplete HTTPS configuration and blanket proxy trust',()=>{
  assert.throws(()=>runtime({NODE_ENV:'production',SESSION_SECRET:'x'.repeat(64)}),/Produccion/);
  assert.throws(()=>runtime({SESSION_SECRET:'x'.repeat(64),TRUST_PROXY:'true'}),/TRUST_PROXY/);
  assert.throws(()=>runtime({SESSION_SECRET:'x'.repeat(64),TRUST_PROXY:'0.0.0.0\/0'}),/TRUST_PROXY/);
});
test('CSRF: rejects missing token, cross-site Origin and URL-encoded login',()=>scenario(async s=>{
  const f=await s.form();const body={nombre_usuario:'audit_user',contrasena:password};
  assert.equal((await s.post('/api/auth/login',body,{cookie:f.cookie})).status,403);
  assert.equal((await s.post('/api/auth/login',body,f,{Origin:'https://foreign.invalid'})).status,403);
  assert.equal((await s.request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:f.cookie,'X-CSRF-Token':f.token},body:'nombre_usuario=audit_user&contrasena=test'})).status,415);
}));
test('malformed JSON produces 400, large JSON 413, and does not log secrets',()=>scenario(async s=>{
  const old=console.error,records=[];console.error=(...args)=>records.push(args);
  try{
    assert.equal((await s.request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"contrasena":"SENSITIVE_TEST_ONLY",}'})).status,400);
    assert.equal((await s.request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contrasena:'x'.repeat(20000)})})).status,413);
    assert.ok(!JSON.stringify(records).includes('SENSITIVE_TEST_ONLY'));
  }finally{console.error=old;}
}));
test('license gate, Ed25519 tampering, expiration and changed activation bytes',()=>scenario(async s=>{
  s.setLicense(null);let f=await s.form('/activar');assert.equal((await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},f)).status,403);
  s.setLicense({...signed(license),cliente:'Modified'});
  assert.equal(JSON.parse((await s.request('/api/licencia/estado')).text).licencia.estado,'LICENCIA_FIRMA_INVALIDA');
  s.setLicense(signed({...license,tipo:'TEMPORAL',fechaEmision:'2000-01-01',fechaExpiracion:'2000-01-02'}));
  assert.equal(JSON.parse((await s.request('/api/licencia/estado')).text).licencia.estado,'LICENCIA_EXPIRADA');
  s.setLicense(signed(license));await s.request('/api/licencia/estado');s.setData('{}');
  assert.equal(JSON.parse((await s.request('/api/licencia/estado')).text).accesoSistema,false);
}));
test('activation is idempotent and does not replace timestamp on repetition',()=>scenario(async s=>{
  s.setData(null);const f=await s.form('/activar');
  const a=await s.post('/api/licencia/activar',{codigo:code},f),b=await s.post('/api/licencia/activar',{codigo:code},f);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(s.count.write,1);
  assert.equal(JSON.parse(a.text).fechaActivacion,JSON.parse(b.text).fechaActivacion);
}));
test('rate limit occurs before license work; unchanged activation is decrypted once',()=>scenario(async s=>{
  const f=await s.form();const before=s.count.license,statuses=[];
  for(let i=0;i<7;i++)statuses.push((await s.post('/api/auth/login',{nombre_usuario:'nobody',contrasena:'wrong'},f)).status);
  assert.deepEqual(statuses,[401,401,401,401,401,429,429]);assert.equal(s.count.license-before,5);assert.equal(s.count.decode,1);
}));
test('activation endpoint also limits repeated attempts',()=>scenario(async s=>{
  const f=await s.form();const statuses=[];
  for(let i=0;i<7;i++)statuses.push((await s.post('/api/licencia/activar',{codigo:'wrong'},f)).status);
  assert.deepEqual(statuses,[400,400,400,400,400,429,429]);
}));
test('HTML pages redirect expired sessions instead of rendering JSON',()=>scenario(async s=>{
  const response=await s.request('/inicio',{headers:{Accept:'text/html'}});
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/login?sesion=vencida');
  const login=await s.request('/login?sesion=vencida');assert.match(login.text,/La sesión venció/);
}));
test('fingerprint retrieval is asynchronous and concurrent requests share the result',async()=>{
  const m=new MachineFingerprint();let count=0;
  m.getMachineGuid=async()=>{count++;return 'synthetic-guid';};
  const [a,b]=await Promise.all([m.generate(),m.generate()]);assert.equal(a,b);assert.equal(count,1);
});
test('roles reject unauthorized access',()=>{
  const middleware=new RoleMiddleware().allow('ADMINISTRADOR');
  for(const [rol,expected] of [[undefined,401],['ENCARGADO_VENTA',403],['ADMINISTRADOR',200]]){
    let status;middleware({authUser:rol?{rol}:undefined},{status(v){status=v;return this;},json(){}},()=>status=200);assert.equal(status,expected);
  }
});
test('migration is parseable and contains no destructive table/data rebuild',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../database/migrations/U004.sql'),'utf8');
  const statements=splitSql(sql);assert.ok(statements.length>30);
  assert.equal(statements.filter(s=>s.startsWith('CREATE PROCEDURE')).length,5);
  assert.ok(!statements.some(s=>/^(DROP\s+(DATABASE|TABLE)|TRUNCATE|USE\s|SOURCE\s)/i.test(s)));
  assert.ok(statements.every(s=>/^(CREATE|DROP (PROCEDURE|TRIGGER))/i.test(s)));
});
