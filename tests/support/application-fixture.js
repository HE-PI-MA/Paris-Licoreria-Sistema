/** Pruebas HTTP con sesiones, licencia y datos simulados; no consultan la base del negocio. */
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const App = require('../../src/app');
const MySqlSessionStore = require('../../src/services/MySqlSessionStore');
const LicensePayload = require('../../src/core/LicensePayload');
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
  const app=new App({sessionStore:new MySqlSessionStore(pool),supplierRepository:options.supplierRepository || {list:async()=>({records:[],total:0})},productRepository:options.productRepository || {list:async()=>({records:[],total:0}),options:async()=>({options:[],total:0})}});
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
  return {app,base,pool,request,form,post,count,setLicense:v=>installed=v,setData:v=>data=v,setUser:v=>currentUser=v,
    close:async()=>{await new Promise(resolve=>http.close(resolve));app.close();}};
}
async function scenario(fn,options){const s=await server(options);try{await fn(s);}finally{await s.close();}}

module.exports = { server, scenario, user, password, code, signed, license, sessionPool, keys, fingerprint };
