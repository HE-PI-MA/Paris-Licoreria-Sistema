const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const App = require('../src/app');
const MySqlSessionStore = require('../src/services/MySqlSessionStore');
const LicensePayload = require('../src/core/LicensePayload');
const runtime = require('../src/config/runtime');
const { splitSql } = require('../scripts/sql');
const MachineFingerprint = require('../src/utils/MachineFingerprint');
const RoleMiddleware = require('../src/middleware/RoleMiddleware');
process.env.SESSION_SECRET = 'local-automated-tests-only-' + 'z'.repeat(40);
const keys = crypto.generateKeyPairSync('ed25519');
const password = 'PruebaLocal-U004';
const code = 'ACTIVACION-DE-PRUEBA';
const fingerprint = 'a'.repeat(64);
const user = {id_usuario:1,id_rol:1,nombre:'Prueba',apellido:'Local',nombre_usuario:'audit_user',contrasena:bcrypt.hashSync(password,4),estado:'ACTIVO',rol:'ADMINISTRADOR'};
const license = {version:1,producto:'PARIS_LICORERIA',licenciaId:'U004-TEST',cliente:'Prueba',tipo:'PERMANENTE',fechaEmision:'2026-01-01',fechaExpiracion:null,equipo:fingerprint,activacionHash:crypto.createHash('sha256').update(code).digest('hex')};
function signed(value) { return {...value,firma:crypto.sign(null,Buffer.from(LicensePayload.serialize(value)),keys.privateKey).toString('base64')}; }
function sessionPool() {
  const rows = new Map();
  return { rows, async execute(sql, args) {
    if(sql.startsWith('SELECT data')) {const row=rows.get(args[0]);return [row&&row.expires_at>args[1]?[{data:row.data}]:[]];}
    if(sql.startsWith('INSERT INTO sesion_web'))rows.set(args[0],{expires_at:args[1],data:args[2]});
    else if(sql.startsWith('UPDATE sesion_web')) {if(rows.has(args[1]))rows.get(args[1]).expires_at=args[0];}
    else if(sql.startsWith('DELETE FROM sesion_web WHERE sid'))rows.delete(args[0]);
    else if(sql.startsWith('DELETE FROM sesion_web WHERE expires'))for(const [key,row] of rows)if(row.expires_at<=args[0])rows.delete(key);
    return [{}];
  }};
}
async function server(options={}) {
  process.env.NODE_ENV=options.production?'production':'development';
  process.env.PUBLIC_ORIGIN=options.production?'https://paris.test':'';
  process.env.TRUST_PROXY=options.production?'loopback':'';
  delete process.env.TLS_CERT_PATH;delete process.env.TLS_KEY_PATH;
  const pool=options.pool||sessionPool();
  const app=new App({sessionStore:new MySqlSessionStore(pool)});
  const ac=app.licenseController.activationService,ls=ac.licenseService;
  let installed=signed(license),currentUser={...user};
  let data=JSON.stringify({version:1,producto:'PARIS_LICORERIA',licenciaId:license.licenciaId,equipo:fingerprint,fechaActivacion:'2026-01-01T00:00:00Z'});
  const count={decode:0,write:0,license:0};
  ls.licenseRepository.read=async()=>{count.license++;return installed;};
  ls.licenseVerifier.getPublicKey=async()=>keys.publicKey;
  ls.machineFingerprint.generate=async()=>fingerprint;
  ac.activationRepository.read=async()=>data;
  ac.activationRepository.write=async value=>{count.write++;data=value;};
  ac.windowsProtection.protect=async value=>value;
  ac.windowsProtection.unprotect=async value=>{count.decode++;return value;};
  const repo=app.authController.authService.authRepository;
  repo.findByUsername=async name=>name===currentUser.nombre_usuario?currentUser:null;
  repo.findById=async id=>id===1?currentUser:null;
  app.systemController.systemService.systemRepository.checkDatabaseConnection=async()=>true;
  const http=await new Promise(resolve=>{const h=app.getExpressApp().listen(0,'127.0.0.1',()=>resolve(h));});
  const base='http://127.0.0.1:'+http.address().port;
  const request=async(route,options={})=>{
    const headers={...(options.headers||{})};
    if(app.config.production)headers['X-Forwarded-Proto']='https';
    const response=await fetch(base+route,{...options,headers,redirect:'manual'});
    return {status:response.status,text:await response.text(),headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const form=async(route='/login',cookie)=>{
    const response=await request(route,{headers:cookie?{Cookie:cookie}:{}});
    assert.equal(response.status,200,response.text);
    return {cookie:response.cookie||cookie,token:/name="csrf-token" content="([a-f0-9]{64})"/.exec(response.text)?.[1],response};
  };
  const post=(route,body,form,extra={})=>request(route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':form?.token||'',Cookie:form?.cookie||'',...extra},body:JSON.stringify(body)});
  return {app,pool,request,form,post,count,setLicense:v=>installed=v,setData:v=>data=v,setUser:v=>currentUser=v,
    close:async()=>{await new Promise(resolve=>http.close(resolve));app.close();}};
}
async function scenario(fn,options){const s=await server(options);try{await fn(s);}finally{await s.close();}}
test('U006: shared module structure, authenticated navigation, profile and local assets',()=>scenario(async s=>{
  const form=await s.form();
  const login=await s.post('/api/auth/login',{nombre_usuario:'audit_user',contrasena:password},form);
  const headers={Cookie:login.cookie};
  for(const item of require('../src/config/navigation').modules){
    const response=await s.request(item.href,{headers});
    assert.equal(response.status,200,response.text);
    assert.ok(response.text.includes(`href="${item.href}" aria-label="${item.label}" aria-current="page"`));
    assert.ok(response.text.includes('id="profile-menu"'));
    assert.ok(response.text.includes('name="csrf-token"'));
    let previousRegion = -1;
    for (const region of ['header', 'controls', 'content', 'messages']) {
      const position = response.text.indexOf(`data-module-region="${region}"`);
      assert.ok(position > previousRegion, `${item.id}: falta la sección ${region} o está fuera de orden`);
      previousRegion = position;
    }
    assert.match(response.text, /class="module-primary-action" type="button" disabled/);
    assert.match(response.text, /id="module-search"[^>]+disabled/);
    assert.ok(response.text.includes('data-module-error'));
    if(item.id!=='inicio')assert.ok(response.text.includes('Módulo en preparación'));
  }
  s.setUser({...user,nombre:'<script>alert(1)</script>',apellido:'& Usuario'});
  const profile=await s.request('/perfil',{headers});
  assert.equal(profile.status,200);
  assert.ok(profile.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!profile.text.includes('<script>alert(1)</script>'));
  assert.ok(profile.text.includes('audit_user'));
  assert.ok(!profile.text.includes(user.contrasena));
  assert.ok(!profile.text.includes('data-module-layout='));
  for(const asset of ['/css/components/sidebar.css','/js/components/sidebar.js','/js/components/sidebar-preference.js','/fonts/inter/InterVariable.woff2','/img/brand/paris-isologo.png','/css/components/module-layout.css','/js/components/module-layout.js']) {
    assert.equal((await s.request(asset)).status,200,asset);
  }
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
