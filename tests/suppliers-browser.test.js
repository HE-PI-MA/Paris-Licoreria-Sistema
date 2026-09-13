/** Proveedores U023 en Chromium: usa API, servicio y transacciones compartidas reales con un repositorio de datos ficticios. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {server,password}=require('./support/application-fixture');
const {SupplierMemoryRepository}=require('./support/supplier-fixture');
const Service=require('../src/services/SupplierService');
test('U023: Proveedores completo con datos ficticios en navegador',{skip:process.env.PARIS_UI_BROWSER_TESTS!=='1',timeout:120000},async t=>{
 const repo=new SupplierMemoryRepository(),service=new Service(repo);
 for(let i=1;i<=55;i++)await service.create(1,crypto.randomUUID(),{name:'Distribuidora '+String(i).padStart(2,'0'),contact:'Contacto de prueba',phone:'70000000',nit:String(10000+i),address:'Dirección de prueba',state:i===2?'INACTIVO':'ACTIVO'});
 repo.pool.data.purchases.add(1);
 const app=await server({supplierRepository:repo});const {chromium}=require(process.env.PARIS_PLAYWRIGHT_PATH||'playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PARIS_BROWSER_EXECUTABLE||undefined,args:JSON.parse(process.env.PARIS_BROWSER_ARGS||'[]')});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));let dropCreate=true,gate,releaseGate;const posts=[];
 await page.route('**/api/proveedores**',async route=>{
  const req=route.request();if(req.method()!=='POST')return route.continue();
  posts.push({path:new URL(req.url()).pathname,key:req.headers()['x-operation-id']});if(gate)await gate;
  const response=await route.fetch();
  if(dropCreate&&new URL(req.url()).pathname==='/api/proveedores'){dropCreate=false;return route.abort('failed');}
  return route.fulfill({response});
 });
 const count=async n=>page.waitForFunction(n=>document.querySelectorAll('#suppliers-table tr[data-row-index]').length===n,n);
 const search=async term=>{await page.locator('#module-search').fill(term);await page.locator('#module-search').press('Enter');};
 const menu=async(id,label)=>{await page.getByRole('button',{name:'Acciones del registro '+id,exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();};
 const confirm=async label=>page.locator('dialog[open]').last().getByRole('button',{name:label,exact:true}).click();
 const shot=async name=>{if(process.env.PARIS_UI_SCREENSHOTS){fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PARIS_UI_SCREENSHOTS,name+'.png')});}};
 try{
  await page.goto(app.base+'/login');await page.locator('[name=nombre_usuario]').fill('audit_user');await page.locator('[name=contrasena]').fill(password);await page.locator('[data-login-submit]').click();await page.waitForURL('**/inicio');
  await t.test('listado remoto completo, búsqueda, estado, vacío y reintento',async()=>{
   await page.goto(app.base+'/proveedores');await count(50);
   await page.locator('#suppliers-table .app-table-scroll').evaluate(n=>{n.scrollTop=n.scrollHeight;});await count(55);
   assert.equal(await page.locator('#suppliers-table td.app-table-sequence').last().textContent(),'55');
   await search('Distribuidora 02');await count(1);
   assert.equal(await page.locator('#suppliers-table tr[data-row-index] .app-badge--inactive').count(),1);
   await page.locator('#module-state').click();await page.getByRole('option',{name:'Activos',exact:true}).click();await page.getByText('No hay registros para mostrar.',{exact:true}).waitFor();
   await page.locator('#module-state').click();await page.getByRole('option',{name:'Todos los estados',exact:true}).click();await count(1);
   repo.failList=true;await search('7000');await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();repo.failList=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click();await count(50);
  });
  await t.test('teclado, cambios pendientes y regreso al botón que abrió el modal',async()=>{
   await page.locator('[data-module-primary]').click();await page.locator('[name=name]').fill('Pendiente');
   await page.keyboard.press('Escape');await confirm('Cancelar');assert.equal(await page.locator('[name=name]').inputValue(),'PENDIENTE');
   await page.keyboard.press('Escape');await confirm('Descartar cambios');assert.equal(await page.locator('dialog[open]').count(),0);
   assert.equal(await page.locator('[data-module-primary]').evaluate(n=>n===document.activeElement),true);
  });
  await t.test('validación, Guardando y reintento tras respuesta perdida no duplica el proveedor',async()=>{
   await page.locator('[data-module-primary]').click();await page.getByRole('button',{name:'Guardar',exact:true}).click();assert.equal(await page.locator('[name=name]').getAttribute('aria-invalid'),'true');
   await page.locator('[name=name]').fill('Proveedor nuevo');await page.locator('[name=contact]').fill('<b>Contacto</b>');await page.locator('[name=nit]').fill('001234567');await page.locator('[name=phone]').fill('70012345');
   gate=new Promise(r=>{releaseGate=r;});await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Guardando…',{exact:true}).waitFor();
   await page.locator('dialog[open] form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
   releaseGate();gate=null;await page.getByText('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.',{exact:true}).waitFor();
   assert.equal(posts.length,1);await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.locator('dialog[open]').waitFor({state:'detached'});
   assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);assert.equal(repo.pool.data.rows.filter(r=>r.name==='PROVEEDOR NUEVO').length,1);
   await page.locator('.app-toast[data-kind=success]').getByText('Proveedor guardado correctamente.',{exact:true}).waitFor();
   await search('001234567');await count(1);
  });
  await t.test('detalle seguro, edición y aviso de versión desactualizada',async()=>{
   await menu(56,'Ver detalle');await page.getByRole('dialog',{name:'Detalle del proveedor',exact:true}).waitFor();
   assert.equal(await page.locator('.app-record-details').getByText('<B>CONTACTO</B>',{exact:true}).count(),1);assert.equal(await page.locator('.app-record-details b').count(),0);assert.equal(await page.locator('dialog[open] [data-icon=truck]').count(),1);await shot('u023-detalle');
   await page.getByRole('button',{name:'Cerrar',exact:true}).click();await menu(56,'Editar');await page.locator('[name=contact]').fill('Contacto actualizado');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.locator('dialog[open]').waitFor({state:'detached'});
   await menu(56,'Editar');await page.locator('[name=contact]').fill('Cambio local');const latest=await service.detail(56);const {id,version,...data}=latest;await service.update(1,crypto.randomUUID(),id,{...data,contact:'Cambio externo',version});
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Otra operación modificó este proveedor. Cierra y vuelve a abrir el registro para revisar los datos actuales.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();await confirm('Descartar cambios');await search('001234567');await count(1);
  });
  await t.test('NIT repetido señala el campo y conserva los datos escritos',async()=>{
   await page.locator('[data-module-primary]').click();await page.locator('[name=name]').fill('Otra distribuidora');await page.locator('[name=nit]').fill('001234567');await page.getByRole('button',{name:'Guardar',exact:true}).click();
   await page.getByText('Este NIT ya está registrado. Busca el proveedor existente.',{exact:true}).waitFor();assert.equal(await page.locator('[name=name]').inputValue(),'OTRA DISTRIBUIDORA');assert.equal(repo.pool.data.rows.length,56);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();await confirm('Descartar cambios');
  });
  await t.test('estado informativo, activar/desactivar y eliminar protegen el historial',async()=>{
   const before=posts.length;await page.locator('#suppliers-table tr[data-row-index] .app-badge').click();assert.equal(posts.length,before);
   await menu(56,'Desactivar');await confirm('Desactivar');await page.locator('#suppliers-table tr[data-row-index] .app-badge--inactive').waitFor();
   await menu(56,'Activar');await confirm('Activar');await page.locator('#suppliers-table tr[data-row-index] .app-badge--success').waitFor();
   await menu(56,'Eliminar');await confirm('Eliminar');await page.getByText('No hay registros para mostrar.',{exact:true}).waitFor();assert.equal(repo.pool.data.rows.length,55);
   await search('Distribuidora 01');await count(1);await menu(1,'Eliminar');await confirm('Eliminar');await page.getByText('El proveedor tiene compras registradas. Se conserva su historial; puedes desactivarlo.',{exact:true}).waitFor();assert.equal(repo.pool.data.rows.length,55);
  });
  await t.test('diseño compartido en escritorio y móvil, formulario sin desbordamiento',async()=>{
   await page.goto(app.base+'/proveedores');await count(50);await page.evaluate(()=>document.fonts.ready);await shot('u023-proveedores');
   await page.locator('[data-module-primary]').click();await shot('u023-formulario');
   for(const width of [900,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ancho '+width);const box=await page.locator('dialog[open]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);}
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();await shot('u023-movil');assert.deepEqual(errors,[]);
  });
 }finally{releaseGate?.();await browser.close();await app.close();}
});
