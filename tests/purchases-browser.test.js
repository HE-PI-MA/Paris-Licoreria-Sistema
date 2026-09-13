/** Flujo real de Compras en Chromium con repositorios transaccionales ficticios; no utiliza datos de negocio. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {server,password}=require('./support/application-fixture'),{PurchaseMemoryRepository,body}=require('./support/purchase-fixture');
const Service=require('../src/services/PurchaseService');
test('U026: Compras en navegador',{skip:process.env.PARIS_UI_BROWSER_TESTS!=='1',timeout:120000},async t=>{
 const repo=new PurchaseMemoryRepository(),service=new Service(repo);await service.create(1,crypto.randomUUID(),body());
 const app=await server({purchaseRepository:repo,productRepository:repo.products,supplierRepository:repo.suppliers});
 const {chromium}=require(process.env.PARIS_PLAYWRIGHT_PATH||'playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.PARIS_BROWSER_EXECUTABLE||undefined,args:JSON.parse(process.env.PARIS_BROWSER_ARGS||'[]')});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const modal=()=>page.getByRole('dialog',{name:'Nueva compra',exact:true});
 const choose=async(label,term,option)=>{const field=modal().getByRole('combobox',{name:label,exact:true});await field.fill(term);await modal().getByRole('option',{name:option,exact:true}).click();};
 const shot=async(name)=>{if(process.env.PARIS_UI_SCREENSHOTS){fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PARIS_UI_SCREENSHOTS,name+'.png')});}};
 const menu=async(label)=>{await modal().getByRole('button',{name:'Acciones del registro 1',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();};
 let gate,release,drop=false;const posts=[];
 await page.route('**/api/compras',async route=>{if(route.request().method()!=='POST')return route.continue();posts.push({key:route.request().headers()['x-operation-id'],body:route.request().postDataJSON()});if(gate)await gate;const response=await route.fetch();if(drop){drop=false;return route.abort('failed');}return route.fulfill({response});});
 try{
  await page.goto(app.base+'/login');await page.locator('[name=nombre_usuario]').fill('audit_user');await page.locator('[name=contrasena]').fill(password);await page.locator('[data-login-submit]').click();await page.waitForURL('**/inicio');
  await t.test('listado, búsqueda, error y reintento',async()=>{
   await page.goto(app.base+'/compras');await page.locator('#purchases-table tr[data-row-index]').waitFor();await shot('u026-listado');
   await page.locator('#module-search').fill('ausente');await page.locator('#module-search').press('Enter');await page.getByText('No hay registros para mostrar.',{exact:true}).waitFor();
   repo.failList=true;await page.locator('#module-search').fill('');await page.locator('#module-search').press('Enter');await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();repo.failList=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('#purchases-table tr[data-row-index]').waitFor();
  });
  await t.test('texto libre, Escape y descarte no crean registros',async()=>{
   await page.locator('[data-module-primary]').click();await modal().getByRole('combobox',{name:'Nombre o empresa',exact:true}).fill('Nueva distribuidora');await modal().getByLabel('Teléfono',{exact:true}).click();
   assert.equal(await modal().getByRole('combobox',{name:'Nombre o empresa',exact:true}).inputValue(),'NUEVA DISTRIBUIDORA');
   await modal().getByRole('combobox',{name:'Ubicación de ingreso *',exact:true}).fill('caja dos');await modal().getByLabel('Observación',{exact:true}).click();
   assert.equal(await modal().getByRole('combobox',{name:'Ubicación de ingreso *',exact:true}).inputValue(),'CAJA DOS');
   await shot('u026-ubicacion-nueva');assert.equal(repo.pool.data.locations.length,1);
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Descartar cambios',exact:true}).getByRole('button',{name:'Descartar cambios',exact:true}).click();
   assert.equal(repo.pool.data.suppliers.length,1);assert.equal(repo.pool.data.purchases.length,1);assert.equal(await page.locator('[data-module-primary]').evaluate(n=>n===document.activeElement),true);
  });
  await t.test('autocompleta existentes, agrega/edita/quita sin guardar y conserva la equivalencia',async()=>{
   await page.locator('[data-module-primary]').click();
   const fields=['quantity','cost','price','lotCode','expiresOn'];
   const boxes=await Promise.all(fields.map(name=>modal().locator('[name='+name+']').boundingBox()));
   assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0].y)<1),'Los cinco campos deben compartir fila');
   for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].x>=boxes[i-1].x+boxes[i-1].width);
   await shot('u026-formulario');await choose('Nombre o empresa','DISTRIB','DISTRIBUIDORA FICTICIA');
   await page.waitForFunction(()=>document.querySelector('[name=phone]').value==='70000000');assert.equal(await modal().getByLabel('Teléfono',{exact:true}).evaluate(n=>n.readOnly),true);
   await choose('Ubicación de ingreso *','ALMA','ALMACÉN DE PRUEBA');await choose('Producto','CERVE','CERVEZA FICTICIA');
   await choose('Presentación','PAQ','PAQUETE DE 6');await page.waitForFunction(()=>document.querySelector('[name=factor]').value==='6.000');
   await modal().locator('[name=quantity]').fill('2');await modal().locator('[name=cost]').fill('45.25');await modal().getByRole('button',{name:'Agregar producto',exact:true}).click();
   await modal().locator('tr[data-row-index]').waitFor();assert.equal(repo.pool.data.purchases.length,1);assert.equal(await modal().locator('output').textContent(),'Total: Bs 90,50');
   await menu('Ver detalle');const details=page.getByRole('dialog',{name:'Detalle del producto comprado',exact:true});await details.getByText('Ingreso en unidades base',{exact:true}).waitFor();await details.getByRole('button',{name:'Cerrar',exact:true}).click();
   await menu('Editar');await modal().locator('[name=quantity]').fill('3');await modal().getByRole('button',{name:'Actualizar producto',exact:true}).click();assert.equal(await modal().locator('output').textContent(),'Total: Bs 135,75');
   await menu('Quitar');await page.getByRole('dialog',{name:'Quitar producto',exact:true}).getByRole('button',{name:'Quitar',exact:true}).click();await modal().getByText('No hay registros para mostrar.',{exact:true}).waitFor();
   assert.equal(repo.pool.data.products.length,1);assert.equal(repo.pool.data.presentations.length,1);
  });
  await t.test('alta inline de producto y presentación; doble envío y respuesta perdida no duplican',async()=>{
   await modal().getByRole('combobox',{name:'Nombre o empresa',exact:true}).fill('NUEVA DISTRIBUIDORA');await modal().locator('[name=phone]').fill('70011122');
   await modal().getByRole('combobox',{name:'Ubicación de ingreso *',exact:true}).fill('heladera');await modal().getByLabel('Observación',{exact:true}).click();
   assert.equal(await modal().getByRole('combobox',{name:'Ubicación de ingreso *',exact:true}).inputValue(),'HELADERA');
   await modal().getByRole('combobox',{name:'Producto',exact:true}).fill('GALLETAS NUEVAS');await choose('Categoría *','BEB','BEBIDAS');await choose('Unidad base *','UNI','UNIDAD');
   await modal().getByRole('combobox',{name:'Presentación',exact:true}).fill('CAJA DE 12');await modal().locator('[name=factor]').fill('12');await modal().locator('[name=price]').fill('30');
   await modal().locator('[name=barcode]').fill('aBc-Compra');await modal().locator('[name=quantity]').fill('2');await modal().locator('[name=cost]').fill('20.10');await modal().getByRole('button',{name:'Agregar producto',exact:true}).click();
   await modal().locator('tr[data-row-index]').waitFor();assert.equal(repo.pool.data.products.length,1);
   await choose('Producto','GALL','GALLETAS NUEVAS (NUEVO EN ESTA COMPRA)');await choose('Presentación','CAJA','CAJA DE 12 (NUEVA EN ESTA COMPRA)');
   await page.waitForFunction(()=>document.querySelector('[name=factor]').value==='12.000');await modal().locator('[name=quantity]').fill('1');await modal().locator('[name=cost]').fill('20.10');await modal().getByRole('button',{name:'Agregar producto',exact:true}).click();
   await modal().locator('tr[data-row-index="1"]').waitFor();assert.equal(await modal().locator('output').textContent(),'Total: Bs 60,30');await shot('u026-nueva-compra');
   gate=new Promise(r=>{release=r;});drop=true;await modal().getByRole('button',{name:'Guardar compra',exact:true}).click();await modal().getByText('Guardando…',{exact:true}).waitFor();
   await modal().locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));release();gate=null;
   await modal().getByText('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.',{exact:true}).waitFor();assert.equal(posts.length,1);
   await modal().getByRole('button',{name:'Guardar compra',exact:true}).click();await modal().waitFor({state:'detached'});
   assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);
   assert.equal(posts[0].body.locationName,'HELADERA');assert.equal(Object.hasOwn(posts[0].body,'locationId'),false);
   assert.equal(repo.pool.data.locations.length,2);assert.equal(repo.pool.data.locations[1].name,'HELADERA');
   assert.equal(repo.pool.data.lines.at(-1).locationId,2);assert.equal(repo.pool.data.purchases.length,2);assert.equal(repo.pool.data.suppliers.length,2);assert.equal(repo.pool.data.products.length,2);assert.equal(repo.pool.data.lines.at(-2).baseQuantity,'24.000');assert.equal(repo.pool.data.presentations.at(-1).barcode,'aBc-Compra');
   await page.locator('.app-toast[data-kind=success]').waitFor();
  });
  await t.test('detalle confirmado y diseño móvil sin desbordar la página',async()=>{
   await page.getByRole('button',{name:'Acciones del registro 2',exact:true}).click();await page.getByRole('menuitem',{name:'Ver detalle',exact:true}).click();await page.getByRole('dialog',{name:'Compra N.º 2',exact:true}).waitFor();await shot('u026-detalle');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
   await page.locator('.app-toast[data-kind=success]').waitFor({state:'detached'});
   await page.locator('[data-module-primary]').click();await choose('Ubicación de ingreso *','HELA','HELADERA');
   assert.equal(await modal().locator('[name=locationId]').inputValue(),'2');
   await modal().getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('dialog',{name:'Descartar cambios',exact:true}).getByRole('button',{name:'Descartar cambios',exact:true}).click();
   await page.setViewportSize({width:390,height:844});await page.locator('[data-module-primary]').click();await shot('u026-movil');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await modal().locator('.app-modal-body').evaluate(n=>n.scrollWidth<=n.clientWidth),true);
   const saveBox=await modal().getByRole('button',{name:'Guardar compra',exact:true}).boundingBox();assert.ok(saveBox.y+saveBox.height<=844);
   await modal().locator('[name=expiresOn]').scrollIntoViewIfNeeded();await shot('u026-movil-campos');
   assert.equal(await modal().locator('.app-table-scroll').evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
   await modal().getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual(errors,[]);
  });
 }finally{if(errors.length)console.error(errors);await browser.close();await app.close();}
});
