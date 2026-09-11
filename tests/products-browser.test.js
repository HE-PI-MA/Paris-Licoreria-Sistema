/** Productos en Chromium con API ficticia interceptada: verifica interfaz y reintentos sin usar la base del negocio. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {server,password}=require('./support/application-fixture');
test('U012: Productos, formularios y presentaciones en navegador', {skip:process.env.PARIS_UI_BROWSER_TESTS!=='1',timeout:120000}, async t=>{
 const {chromium}=require(process.env.PARIS_PLAYWRIGHT_PATH||'playwright');
 const app=await server();
 const browser=await chromium.launch({headless:true,executablePath:process.env.PARIS_BROWSER_EXECUTABLE||undefined,args:JSON.parse(process.env.PARIS_BROWSER_ARGS||'[]')});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const rows=Array.from({length:12},(_,i)=>({id:i+1,name:'Producto '+String(i+1).padStart(2,'0'),categoryId:1,category:'Bebidas alcohólicas',unitId:1,unit:'Unidad',minimum:'3.000',stock:'0.000',physicalStock:'0.000',presentations:i===0?1:0,state:'ACTIVO',description:'',version:'a'.repeat(64)}));
 let children=[{id:1,productId:1,name:'Botella',factor:'1.000',barcode:'123',price:'10.00',state:'ACTIVO',version:'b'.repeat(64),used:true}];
 let calls=[],failSave=true,failList=false,saveGate,releaseSave;
 const seen=new Map();
 await page.route('**/api/productos**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/productos','');
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='POST'){
   const body=req.postDataJSON(),key=req.headers()['x-operation-id'];calls.push({path,body,key});
   if(saveGate)await saveGate;
   if(path===''){
    if(!seen.has(key)){rows.push({...rows[0],...body,id:rows.length+1,presentations:0});seen.set(key,{id:rows.length});}
    if(failSave){failSave=false;return route.abort('failed');}return send(seen.get(key),201);
   }
   if(path.endsWith('/eliminar'))return send({error:'El producto tiene historial de compras o ventas. Puedes desactivarlo.'},409);
   if(path.endsWith('/presentaciones')){children.push({...body,id:2,productId:1,version:'c'.repeat(64)});return send({id:2},201);}
   return send({id:1});
  }
  if(path.startsWith('/opciones/'))return send({options:[{value:'1',label:path.endsWith('categories')?'Bebidas alcohólicas':'Unidad'}],total:1});
  if(/^\/\d+\/presentaciones\/\d+$/.test(path))return send(children[0]);
  if(path.endsWith('/presentaciones'))return send({records:children,total:children.length});
  if(/^\/\d+$/.test(path))return send(rows.find(r=>r.id===Number(path.slice(1))));
  if(failList)return send({error:'Fallo de prueba'},500);
  let selected=rows.filter(r=>r.name.toLowerCase().includes((url.searchParams.get('term')||'').toLowerCase()));
  if(url.searchParams.get('state'))selected=selected.filter(r=>r.state===url.searchParams.get('state'));
  const size=Number(url.searchParams.get('pageSize')||10),start=(Number(url.searchParams.get('page')||1)-1)*size;
  return send({records:selected.slice(start,start+size),total:selected.length});
 });
 const visible=text=>page.getByText(text,{exact:true}).waitFor();
 const menu=async(name)=>{await page.getByRole('button',{name:'Acciones del registro 1',exact:true}).first().click();await page.getByRole('menuitem',{name,exact:true}).click();};
 try{
  await page.goto(app.base+'/login');await page.locator('[name=nombre_usuario]').fill('audit_user');await page.locator('[name=contrasena]').fill(password);await page.locator('[data-login-submit]').click();await page.waitForURL('**/inicio');
  await t.test('consulta remota completa, vacío, error y reintento',async()=>{
   await page.goto(app.base+'/productos');await visible('Mostrando 1–12 de 12 registros');
   assert.equal(await page.locator('#products-table .app-table-pagination').count(),0);
   await page.locator('#module-search').fill('ausente');await visible('No hay registros para mostrar.');
   failList=true;await page.locator('#module-search').fill('Producto');await visible('No se pudo cargar el listado. Inténtalo nuevamente.');
   failList=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click();await visible('Mostrando 1–12 de 12 registros');
  });
  await t.test('teclado, descarte de cambios y retorno de foco',async()=>{
   await page.locator('[data-module-primary]').click();await page.getByRole('textbox',{name:'Nombre del producto *',exact:true}).fill('Pendiente');
   await page.keyboard.press('Escape');const confirm=page.getByRole('dialog',{name:'Descartar cambios',exact:true});await confirm.waitFor();
   await confirm.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.locator('[name=name]').inputValue(),'Pendiente');
   await page.keyboard.press('Escape');await confirm.getByRole('button',{name:'Descartar cambios',exact:true}).click();
   assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('[data-module-primary]').evaluate(el=>el===document.activeElement),true);
  });
  await t.test('validación, Guardando, doble envío y clave estable tras una respuesta perdida',async()=>{
   await page.locator('[data-module-primary]').click();await page.getByRole('button',{name:'Guardar',exact:true}).click();
   assert.equal(await page.locator('[name=name]').getAttribute('aria-invalid'),'true');
   await page.locator('[name=name]').fill('Producto nuevo');
   for(const name of ['Categoría *','Unidad base *']){await page.getByRole('combobox',{name,exact:true}).click();await page.locator('dialog[open] [role=option]:visible').first().click();}
   saveGate=new Promise(resolve=>{releaseSave=resolve;});
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Guardando…');
   await page.locator('dialog[open] form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
   await page.waitForFunction(()=>document.querySelector('dialog[open]').getAttribute('aria-busy')==='true');
   releaseSave();saveGate=null;await visible('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.');
   assert.equal(calls.length,1);await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Mostrando 1–13 de 13 registros');
   assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.equal(rows.filter(r=>r.name==='Producto nuevo').length,1);
  });
  await t.test('edición protege unidad; presentaciones protegen factor usado y guardan decimales',async()=>{
   await menu('Editar');await page.getByRole('dialog',{name:'Editar producto',exact:true}).waitFor();assert.equal(await page.locator('select[name=unitId]').isDisabled(),true);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   await menu('Presentaciones');await visible('Mostrando 1–1 de 1 registros');
   const manager=page.getByRole('dialog',{name:'Presentaciones: Producto 01',exact:true});
   await manager.getByRole('button',{name:'Acciones del registro 1',exact:true}).click();await page.getByRole('menuitem',{name:'Editar',exact:true}).click();
   await page.getByRole('dialog',{name:'Editar presentación',exact:true}).waitFor();assert.equal(await page.locator('[name=factor]').evaluate(n=>n.readOnly),true);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   await manager.getByRole('button',{name:'Nueva presentación',exact:true}).click();await page.locator('[name=name]').fill('Caja de 12');await page.locator('[name=factor]').fill('12');await page.locator('[name=price]').fill('95.50');
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Mostrando 1–2 de 2 registros');assert.equal(calls.at(-1).body.price,'95.50');
   await manager.getByRole('button',{name:'Cerrar',exact:true}).click();
  });
  await t.test('error de eliminación permanece visible y pantalla adaptable sin desbordar',async()=>{
   await menu('Eliminar');await page.getByRole('button',{name:'Eliminar',exact:true}).click();await visible('El producto tiene historial de compras o ventas. Puedes desactivarlo.');
   for(const width of [1440,900,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ancho '+width);}
   await page.setViewportSize({width:1440,height:1000});
   await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
   if(process.env.PARIS_UI_SCREENSHOTS){require('node:fs').mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:require('node:path').join(process.env.PARIS_UI_SCREENSHOTS,'productos-u012.png'),fullPage:true});}
   assert.deepEqual(errors,[]);
  });
 }finally{releaseSave?.();await browser.close();await app.close();}
});
