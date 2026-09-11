/** Pruebas de clases de interfaz con dobles de elementos; conservan la cobertura de U008. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');

// Dobles de elementos para comprobar eventos y estado; no sustituyen una prueba visual.
class Element {
  constructor(doc){
    Object.assign(this,{doc,listeners:new Map(),queries:new Map(),children:[],dataset:{},style:{},attrs:new Map(),
      hidden:false,disabled:false,inert:false,value:'',innerHTML:'',textContent:'',type:'password',offsetHeight:24});
    this.classList={toggle:()=>{}};
  }
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
  async emit(name,values={}){const event={target:this,preventDefault(){this.prevented=true;},...values};for(const fn of this.listeners.get(name)||[])await fn(event);return event;}
  querySelector(s){return this.queries.get(s)||null;}
  querySelectorAll(s){return this.queries.get(s)||[];}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  getAttribute(k){return this.attrs.get(k)??null;}
  removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);}
  toggleAttribute(k,value){value?this.setAttribute(k,''):this.removeAttribute(k);}
  focus(){this.doc.activeElement=this;}
  contains(other){return this===other||this.children.some(child=>child.contains(other));}
  closest(){return this.hidden?this:this.parent?.closest()||null;}
  getBoundingClientRect(){return {top:100,right:88,height:44};}
}
function environment(){
  const document=new Element();document.doc=document;
  const element=()=>new Element(document);document.documentElement=element();
  const token=element();token.content='test-csrf';document.queries.set('meta[name="csrf-token"]',token);
  const requests=[],redirects=[],timers=[],stored=new Map();
  let responder=async()=>({ok:true,status:200,json:async()=>({})});
  const media=element();media.matches=false;
  const window=new Element(document);
  Object.assign(window,{location:{assign:url=>redirects.push(url)},setTimeout:fn=>timers.push(fn),matchMedia:()=>media});
  const storage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
  const context=vm.createContext({document,window,localStorage:storage,innerHeight:768,
    fetch:async(url,options)=>{requests.push({url,options});return responder(url,options);}});
  const load=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js',file),'utf8'),context,{filename:file});
  return {document,element,window,media,requests,redirects,timers,stored,storage,load,respond:fn=>{responder=fn;}};
}
function authPage(type){
  const e=environment(),form=e.element(),submit=e.element(),error=e.element(),success=e.element(),toggle=e.element();
  submit.innerHTML='<span>Enviar</span>';error.hidden=success.hidden=true;
  const fields={nombre_usuario:e.element(),contrasena:e.element(),codigo:e.element()};
  form.elements={namedItem:name=>fields[name]};
  for(const [s,v]of [[`[data-${type}-form]`,form],[`[data-${type}-submit]`,submit],[`[data-${type}-error]`,error],
    [`[data-${type}-success]`,success],['#contrasena',fields.contrasena],['[data-password-toggle]',toggle]])e.document.queries.set(s,v);
  e.load('components/auth-form.js');e.load(`pages/${type}.js`);
  return {...e,form,submit,error,success,fields,toggle};
}
test('U008: login valida, conserva CSRF, evita doble envio y limpia la contraseña',async()=>{
  const e=authPage('login');await e.form.emit('submit');assert.equal(e.requests.length,0);assert.equal(e.error.hidden,false);
  e.fields.nombre_usuario.value=' admin ';e.fields.contrasena.value='clave-ficticia';
  await e.toggle.emit('click');assert.equal(e.fields.contrasena.type,'text');assert.equal(e.toggle.getAttribute('aria-pressed'),'true');
  let resolve;e.respond(()=>new Promise(done=>{resolve=done;}));
  const sending=e.form.emit('submit');await e.form.emit('submit');assert.equal(e.requests.length,1);assert.equal(e.submit.disabled,true);
  const r=e.requests[0];assert.equal(r.url,'/api/auth/login');assert.equal(r.options.credentials,'same-origin');assert.equal(r.options.headers['X-CSRF-Token'],'test-csrf');
  assert.deepEqual(JSON.parse(r.options.body),{nombre_usuario:'admin',contrasena:'clave-ficticia'});
  resolve({ok:true,json:async()=>({})});await sending;
  assert.equal(e.fields.contrasena.value,'');assert.equal(e.success.hidden,false);assert.equal(e.submit.innerHTML,'<span>Enviar</span>');
  assert.equal(e.submit.disabled,true);await e.form.emit('submit');assert.equal(e.requests.length,1);
  e.timers[0]();assert.deepEqual(e.redirects,['/inicio']);
});
test('U008: fallo de login o red permite reintentar sin redireccion',async()=>{
  const e=authPage('login');e.fields.nombre_usuario.value='admin';e.fields.contrasena.value='clave-ficticia';
  e.respond(async()=>({ok:false,json:async()=>({error:'SISTEMA_NO_ACTIVADO'})}));await e.form.emit('submit');
  assert.match(e.error.textContent,/no se encuentra activado/);assert.equal(e.submit.disabled,false);
  e.respond(async()=>{throw Error('offline');});await e.form.emit('submit');assert.match(e.error.textContent,/comunicarse/);
  assert.equal(e.requests.length,2);assert.equal(e.timers.length,0);
});
test('U008: activacion respeta bloqueo, validacion, errores y exito',async()=>{
  const e=authPage('activation');e.submit.disabled=true;e.fields.codigo.value='codigo-ficticio';
  await e.form.emit('submit');assert.equal(e.requests.length,0);e.submit.disabled=false;e.fields.codigo.value='';
  await e.form.emit('submit');assert.equal(e.requests.length,0);e.fields.codigo.value=' codigo-ficticio ';
  e.respond(async()=>({ok:false,json:async()=>({error:'LICENCIA_EXPIRADA'})}));await e.form.emit('submit');assert.match(e.error.textContent,/expirado/);
  e.respond(async()=>({ok:true,json:async()=>({})}));await e.form.emit('submit');
  assert.equal(e.requests[1].url,'/api/licencia/activar');assert.deepEqual(JSON.parse(e.requests[1].options.body),{codigo:'codigo-ficticio'});
  assert.equal(e.requests[1].options.headers['X-CSRF-Token'],'test-csrf');assert.equal(e.fields.codigo.value,'');
  assert.equal(e.submit.disabled,true);await e.form.emit('submit');assert.equal(e.requests.length,2);
  e.timers[0]();assert.deepEqual(e.redirects,['/login']);
});
test('U008: ModuleLayout conserva API, carga, tipos validos y texto sin HTML',()=>{
  const e=environment(),layout=e.element();layout.dataset.moduleLayout='productos';e.document.queries.set('[data-module-layout]',layout);
  const nodes={};for(const key of ['content','status','status-text','error','error-text']){nodes[key]=e.element();layout.queries.set(key==='content'?'[data-module-region="content"]':`[data-module-${key}]`,nodes[key]);}
  const icons=['info','loading','success','warning','empty'].map(kind=>{const icon=e.element();icon.dataset.messageIcon=kind;return icon;});
  layout.queries.set('[data-message-icon]',icons);nodes['status-text'].textContent='Mensaje inicial';e.window.ParisUI={};e.load('components/messages.js');e.load('components/module-layout.js');
  const api=e.window.ParisModule;assert.equal(api.id,'productos');assert.equal(Object.isFrozen(api),true);
  const detached=api.showMessage;detached('loading');assert.equal(nodes.content.getAttribute('aria-busy'),'true');
  detached('error','<img src=x onerror=alert(1)>');assert.equal(nodes.content.getAttribute('aria-busy'),'false');
  assert.equal(nodes['error-text'].textContent,'<img src=x onerror=alert(1)>');assert.equal(nodes['error-text'].innerHTML,'');assert.equal(nodes.status.hidden,true);
  api.clearMessage();assert.equal(nodes.error.hidden,true);api.resetMessage();assert.equal(nodes['status-text'].textContent,'Mensaje inicial');
  assert.throws(()=>api.showMessage('__proto__'),/Tipo de mensaje/);
});
function sidebarPage(){
  const e=environment(),n={};for(const k of ['sidebar','toggle','opener','backdrop','workspace','trigger','menu','tooltip','logout','label','error','profile','navigation','link'])n[k]=e.element();
  n.link.dataset.sidebarLabel='Inicio';n.sidebar.children=[n.link,n.toggle,n.trigger,n.menu];n.menu.children=[n.profile,n.logout];n.profile.parent=n.logout.parent=n.menu;
  for(const [s,key]of [['#paris-sidebar','sidebar'],['[data-sidebar-open]','opener'],['[data-sidebar-backdrop]','backdrop'],['#paris-workspace','workspace'],['#profile-trigger','trigger'],['#profile-menu','menu'],['#sidebar-tooltip','tooltip'],['[data-logout-error]','error']])e.document.queries.set(s,n[key]);
  for(const [s,v]of [['[data-sidebar-toggle]',n.toggle],['[data-sidebar-label]',[n.link]],['.sidebar-navigation',n.navigation],['[data-logout]',n.logout],['a[href], button:not(:disabled)',[n.link,n.toggle,n.trigger,n.profile,n.logout]]])n.sidebar.queries.set(s,v);
  n.menu.queries.set('[role="menuitem"]',[n.profile,n.logout]);n.logout.queries.set('[data-logout-label]',n.label);
  e.stored.set('paris.sidebar.collapsed','true');e.load('components/sidebar-preference.js');e.load('components/sidebar.js');return {...e,...n};
}
test('U008: sidebar conserva preferencia, ayudas y perfil por teclado',async()=>{
  const e=sidebarPage();assert.equal(e.toggle.getAttribute('aria-label'),'Ampliar menú');await e.link.emit('focus');assert.equal(e.tooltip.textContent,'Inicio');
  assert.equal(e.link.getAttribute('aria-describedby'),'sidebar-tooltip');await e.toggle.emit('click');assert.equal(e.stored.get('paris.sidebar.collapsed'),'false');assert.equal(e.tooltip.hidden,true);
  await e.trigger.emit('keydown',{key:'ArrowUp'});assert.equal(e.document.activeElement,e.logout);await e.menu.emit('keydown',{key:'Home'});assert.equal(e.document.activeElement,e.profile);
  await e.document.emit('keydown',{key:'Escape'});assert.equal(e.menu.hidden,true);assert.equal(e.document.activeElement,e.trigger);
  e.storage.setItem=()=>{throw Error('unavailable');};await e.toggle.emit('click');assert.equal(e.document.documentElement.dataset.sidebarCollapsed,'true');
});
test('U008: menu movil bloquea fondo, limita Tab y recupera foco',async()=>{
  const e=sidebarPage();e.media.matches=true;await e.media.emit('change');assert.equal(e.sidebar.inert,true);await e.opener.emit('click');
  assert.equal(e.workspace.inert,true);assert.equal(e.sidebar.inert,false);assert.equal(e.sidebar.getAttribute('aria-modal'),'true');
  e.trigger.focus();await e.document.emit('keydown',{key:'Tab'});assert.equal(e.document.activeElement,e.link);
  await e.document.emit('keydown',{key:'Tab',shiftKey:true});assert.equal(e.document.activeElement,e.trigger);
  await e.document.emit('keydown',{key:'Escape'});assert.equal(e.workspace.inert,false);assert.equal(e.backdrop.hidden,true);assert.equal(e.document.activeElement,e.opener);
});
test('U008: logout conserva CSRF y se recupera de fallo de red',async()=>{
  const e=sidebarPage();e.respond(async()=>{throw Error('offline');});await e.logout.emit('click');assert.equal(e.logout.disabled,false);assert.equal(e.error.hidden,false);
  assert.equal(e.label.textContent,'Cerrar sesión');assert.equal(e.redirects.length,0);e.respond(async()=>({ok:false,status:401}));await e.logout.emit('click');
  assert.equal(e.requests[1].url,'/api/auth/logout');assert.equal(e.requests[1].options.headers['X-CSRF-Token'],'test-csrf');assert.deepEqual(e.redirects,['/login']);
});
