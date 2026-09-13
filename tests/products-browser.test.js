/** Productos U012/U028 en Chromium: interfaz, reintentos y notificaciones de presentaciones con API ficticia. */
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
 let calls=[],failSave=true,failList=false,saveGate,releaseSave,failPresentation=false;
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
   if(/^\/\d+\/presentaciones\/\d+\/(estado|eliminar|editar)$/.test(path)){
    if(failPresentation){failPresentation=false;return send({error:'No se pudo actualizar la presentación de prueba.'},409);}
    const id=Number(path.split('/')[3]),row=children.find(r=>r.id===id);
    if(path.endsWith('/eliminar')&&row.used)return send({error:'La presentación tiene historial de compras o ventas. Puedes desactivarla.'},409);
    if(path.endsWith('/eliminar'))children=children.filter(r=>r.id!==id);
    else Object.assign(row,body);
    return send({id});
   }
   if(path.endsWith('/eliminar'))return send({error:'El producto tiene historial de compras o ventas. Puedes desactivarlo.'},409);
   if(path.endsWith('/presentaciones')){children.push({...body,id:2,productId:1,version:'c'.repeat(64)});return send({id:2},201);}
   return send({id:1});
  }
  if(path.startsWith('/opciones/'))return send({options:[{value:'1',label:path.endsWith('categories')?'Bebidas alcohólicas':'Unidad'}],total:1});
  if(/^\/\d+\/presentaciones\/\d+$/.test(path))return send(children.find(r=>r.id===Number(path.split('/')[3])));
  if(path.endsWith('/presentaciones'))return send({records:children,total:children.length});
  if(/^\/\d+$/.test(path))return send(rows.find(r=>r.id===Number(path.slice(1))));
  if(failList)return send({error:'Fallo de prueba'},500);
  let selected=rows.filter(r=>r.name.toLowerCase().includes((url.searchParams.get('term')||'').toLowerCase()));
  if(url.searchParams.get('state'))selected=selected.filter(r=>r.state===url.searchParams.get('state'));
  const size=Number(url.searchParams.get('pageSize')||10),start=(Number(url.searchParams.get('page')||1)-1)*size;
  return send({records:selected.slice(start,start+size),total:selected.length});
 });
 const visible=text=>page.getByText(text,{exact:true}).waitFor({state:text.startsWith('Mostrando ')?'attached':'visible'});
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
   assert.equal(await page.getByRole('combobox',{name:'Estado *',exact:true}).inputValue(),'Activo');
   assert.equal(await page.locator('select[name=state]').isHidden(),true);
   await page.keyboard.press('Escape');const confirm=page.getByRole('dialog',{name:'Descartar cambios',exact:true});await confirm.waitFor();
   await confirm.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.locator('[name=name]').inputValue(),'PENDIENTE');
   await page.keyboard.press('Escape');await confirm.getByRole('button',{name:'Descartar cambios',exact:true}).click();
   assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('[data-module-primary]').evaluate(el=>el===document.activeElement),true);
  });
  await t.test('validación, Guardando, doble envío y clave estable tras una respuesta perdida',async()=>{
   await page.locator('[data-module-primary]').click();await page.getByRole('button',{name:'Guardar',exact:true}).click();
   assert.equal(await page.locator('[name=name]').getAttribute('aria-invalid'),'true');
   await page.locator('[name=name]').fill('Producto nuevo');
   for(const name of ['Categoría *','Unidad base *']){await page.getByRole('combobox',{name,exact:true}).fill(name.startsWith('Categoría')?'Beb':'Uni');await page.locator('dialog[open] [role=option]:visible').first().click();}
   saveGate=new Promise(resolve=>{releaseSave=resolve;});
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Guardando…');
   await page.locator('dialog[open] form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
   await page.waitForFunction(()=>document.querySelector('dialog[open]').getAttribute('aria-busy')==='true');
   releaseSave();saveGate=null;await visible('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.');
   assert.equal(calls.length,1);await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Mostrando 1–13 de 13 registros');
   assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.equal(rows.filter(r=>r.name==='PRODUCTO NUEVO').length,1);
  });
  await t.test('edición protege unidad; presentaciones protegen factor usado y guardan decimales',async()=>{
   await menu('Editar');await page.getByRole('dialog',{name:'Editar producto',exact:true}).waitFor();assert.equal(await page.locator('select[name=unitId]').isDisabled(),true);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   await menu('Presentaciones');await visible('Mostrando 1–1 de 1 registros');
   const manager=page.getByRole('dialog',{name:'Presentaciones: Producto 01',exact:true});
   await manager.getByRole('button',{name:'Acciones del registro 1',exact:true}).click();await page.getByRole('menuitem',{name:'Editar',exact:true}).click();
   await page.getByRole('dialog',{name:'Editar presentación',exact:true}).waitFor();assert.equal(await page.locator('[name=factor]').evaluate(n=>n.readOnly),true);
   assert.equal(await page.getByRole('combobox',{name:'Estado *',exact:true}).inputValue(),'Activo');
   assert.equal(await page.locator('select[name=state]').isHidden(),true);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   await manager.getByRole('button',{name:'Nueva presentación',exact:true}).click();await page.locator('[name=name]').fill('Caja de 12');await page.locator('[name=factor]').fill('12');await page.locator('[name=price]').fill('95.50');await page.locator('[name=barcode]').fill('aBc-123');
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await visible('Mostrando 1–2 de 2 registros');
   await manager.locator('.app-toast[data-kind=success]').getByText('Presentación guardada correctamente.',{exact:true}).waitFor();
   assert.equal(await manager.locator('.app-modal-body .app-alert[data-kind=success]:visible').count(),0);
   assert.equal(calls.at(-1).body.price,'95.50');assert.equal(calls.at(-1).body.barcode,'aBc-123');assert.equal(calls.at(-1).body.name,'CAJA DE 12');
   await manager.getByRole('button',{name:'Cerrar',exact:true}).click();
  });
  await t.test('U028: éxitos y errores comparten notificación, duración y protección del historial',async()=>{
   await menu('Presentaciones');
   const manager=page.getByRole('dialog',{name:'Presentaciones: Producto 01',exact:true});
   await manager.locator('tr[data-row-index="1"]').waitFor();
   // Los avisos previos no deben confundirse con el resultado de esta operación.
   await page.mouse.move(0,0);
   await page.waitForFunction(()=>!document.querySelector('.app-toast[data-kind=success]'));
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   const toast=manager.locator('.app-toast[data-kind=success]');
   const invoke=async(id,label)=>{
    await manager.getByRole('button',{name:'Acciones del registro '+id,exact:true}).click();
    await page.getByRole('menuitem',{name:label,exact:true}).click();
   };
   const confirm=async label=>{await page.locator('dialog[open]').last().getByRole('button',{name:label,exact:true}).click();};
   const assertNotice=async text=>{
    await toast.getByText(text,{exact:true}).waitFor();await page.mouse.move(0,0);
    assert.equal(await page.locator('.app-notifications').count(),1);
    assert.equal(await toast.locator('button').count(),0);
    assert.equal(await toast.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(34, 115, 77)');
    assert.equal(await manager.locator('.app-modal-body .app-alert[data-kind=success]:visible').count(),0);
    assert.ok(await toast.locator('[data-message-icon=success] svg').isVisible());
    await page.clock.runFor(1900);assert.equal(await toast.count(),1);
    await page.clock.runFor(201);assert.equal(await toast.count(),0);
   };
   try{
    await invoke(2,'Editar');const editor=page.getByRole('dialog',{name:'Editar presentación',exact:true});
    await editor.locator('[name=price]').fill('99.50');await editor.getByRole('button',{name:'Guardar',exact:true}).click();
    await assertNotice('Presentación guardada correctamente.');assert.equal(children[1].price,'99.50');
    const height=(await manager.locator('.app-modal-body').boundingBox()).height;
    await invoke(2,'Desactivar');await confirm('Desactivar');
    await toast.waitFor();await manager.locator('tr[data-row-index="1"]').getByText('Inactivo',{exact:true}).waitFor();
    assert.equal((await manager.locator('.app-modal-body').boundingBox()).height,height);
    if(process.env.PARIS_UI_SCREENSHOTS){require('node:fs').mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:require('node:path').join(process.env.PARIS_UI_SCREENSHOTS,'u021-notificacion-presentaciones.png'),animations:'disabled'});}
    await assertNotice('Estado de la presentación actualizado.');
    failPresentation=true;await invoke(2,'Activar');await confirm('Activar');
    const error=manager.locator('.app-toast[data-kind=error]');
    await error.getByText('No se pudo actualizar la presentación de prueba.',{exact:true}).waitFor();
    assert.equal(await manager.locator('.app-modal-body .app-alert[data-kind=error]:visible').count(),0);
    assert.equal(await error.locator('button').count(),0);assert.equal(await error.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(170, 51, 67)');
    assert.ok(await error.locator('[data-message-icon=error] svg').isVisible());
    await page.mouse.move(0,0);await page.clock.runFor(1900);assert.equal(await error.count(),1);
    await page.clock.runFor(201);assert.equal(await error.count(),0);assert.equal(await toast.count(),0);
    await invoke(2,'Activar');await confirm('Activar');await assertNotice('Estado de la presentación actualizado.');
    assert.equal(await error.count(),0);assert.equal(children[1].state,'ACTIVO');
    await invoke(2,'Eliminar');await confirm('Eliminar');await assertNotice('Presentación eliminada.');
    assert.equal(await manager.locator('tr[data-row-index]').count(),1);
    const before=(await manager.locator('.app-modal-body').boundingBox()).height;
    await invoke(1,'Eliminar');await confirm('Eliminar');
    await error.getByText('La presentación tiene historial de compras o ventas. Puedes desactivarla.',{exact:true}).waitFor();
    assert.equal(children.length,1);assert.equal(children[0].used,true);
    assert.equal((await manager.locator('.app-modal-body').boundingBox()).height,before);
    if(process.env.PARIS_UI_SCREENSHOTS)await page.screenshot({path:require('node:path').join(process.env.PARIS_UI_SCREENSHOTS,'u028-error-presentaciones.png')});
    await page.mouse.move(0,0);await page.clock.runFor(2100);assert.equal(await error.count(),0);
    if(process.env.PARIS_UI_SCREENSHOTS)await page.screenshot({path:require('node:path').join(process.env.PARIS_UI_SCREENSHOTS,'u028-error-retirado.png')});
    assert.equal(await page.locator('dialog[open]').count(),1);
    await manager.getByRole('button',{name:'Cerrar',exact:true}).click();
    assert.equal(await page.locator('dialog[open]').count(),0);
   }finally{await page.clock.resume();}
  });
  await t.test('error de eliminación usa el aviso global y pantalla adaptable sin desbordar',async()=>{
   await menu('Eliminar');await page.getByRole('button',{name:'Eliminar',exact:true}).click();await visible('El producto tiene historial de compras o ventas. Puedes desactivarlo.');
   for(const width of [1440,900,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ancho '+width);}
   await page.setViewportSize({width:1440,height:1000});
   await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
   if(process.env.PARIS_UI_SCREENSHOTS){require('node:fs').mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:require('node:path').join(process.env.PARIS_UI_SCREENSHOTS,'productos-u012.png'),fullPage:true});}
   assert.deepEqual(errors,[]);
  });
 }finally{releaseSave?.();await browser.close();await app.close();}
});
