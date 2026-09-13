/** Preparación U023 con metadatos SQL ficticios: instalación aditiva, compatibilidad y reanudación. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Setup=require('../scripts/setup-suppliers'),ProductsSetup=require('../scripts/setup-products');
const {readSql}=require('../scripts/sql');
function fixture(){
 const base=[['id_proveedor','int unsigned','NO'],['nombre','varchar(120)','NO'],['contacto','varchar(100)','YES'],['telefono','varchar(30)','YES'],['direccion','varchar(200)','YES'],['estado','varchar(20)','NO']].map(([name,type,nullable])=>({name,type,nullable}));
 const state={ready:false,installed:null,alters:0,released:0,bad:false,failRegister:false,lock:1};
 const c={async query(sql,args){
  if(sql==='SELECT DATABASE() AS name')return [[{name:'synthetic_supplier_setup'}]];
  if(sql.startsWith('SELECT GET_LOCK'))return [[{acquired:state.lock}]];
  if(sql.startsWith('SELECT RELEASE_LOCK'))return [[{released:1}]];
  if(sql.startsWith('SELECT checksum'))return [state.installed?[{checksum:state.installed}]:[]];
  if(sql.includes('information_schema.columns'))return [[...base,...(state.ready?[{name:'nit',type:state.bad?'int':'varchar(30)',nullable:'YES'}]:[])]];
  if(sql.includes('ENGINE AS engine'))return [[{name:'proveedor',engine:'InnoDB'},{name:'compra',engine:'InnoDB'}]];
  if(sql.includes("index_name='PRIMARY'"))return [[{name:'id_proveedor'}]];
  if(sql.includes('referential_constraints'))return [[{name:'id_proveedor',target:'id_proveedor',rule:'RESTRICT'}]];
  if(sql.includes("index_name='uq_proveedor_nit'"))return [state.ready?[{name:'nit',nonUnique:0,prefix:null}]:[]];
  if(sql.startsWith('ALTER TABLE proveedor')){state.ready=true;state.alters++;return [{}];}
  if(sql.startsWith('INSERT INTO app_migration')){if(state.failRegister){state.failRegister=false;throw Error('interrupted');}state.installed=args[1];return [{}];}
  if(sql.startsWith('SELECT * FROM'))return [[]];
  throw Error('Unexpected SQL '+sql);
 },release(){state.released++;}};
 return {state,setup:new Setup({getConnection:async()=>c})};
}
test('U023: preparar, comprobar y repetir conserva la tabla; retoma ALTER confirmado sin repetirlo',async()=>{
 const original=ProductsSetup.prototype.run;ProductsSetup.prototype.run=async({check})=>assert.equal(check,true);
 try{const {state,setup}=fixture();await assert.rejects(setup.run({check:true}),/Falta preparar/);assert.equal(state.alters,0);
  state.failRegister=true;await assert.rejects(setup.run(),/interrupted/);assert.equal(state.alters,1);assert.equal(state.installed,null);
  await setup.run();await setup.run();await setup.run({check:true});assert.equal(state.alters,1);assert.equal(state.released,5);
 }finally{ProductsSetup.prototype.run=original;}
});
test('U023: rechaza otra estructura o migración y el SQL no contiene borrados ni cambios de datos',async()=>{
 const original=ProductsSetup.prototype.run;ProductsSetup.prototype.run=async()=>{};
 try{const {state,setup}=fixture();state.ready=true;state.bad=true;await assert.rejects(setup.run(),/otra definición/);assert.equal(state.alters,0);
  state.bad=false;state.installed='different';await assert.rejects(setup.run(),/diferente/);state.installed=null;state.lock=0;await assert.rejects(setup.run(),/en curso/);
 }finally{ProductsSetup.prototype.run=original;}
 const file=path.join(__dirname,'../database/migrations/U023.sql'),statements=readSql(file);assert.equal(statements.length,1);assert.match(statements[0],/^ALTER TABLE proveedor/);assert.match(statements[0],/ADD UNIQUE KEY uq_proveedor_nit/);assert.doesNotMatch(statements[0],/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/i);assert.ok(fs.readFileSync(file,'utf8').startsWith('--'));
});
