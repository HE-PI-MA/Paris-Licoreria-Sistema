/** Recorrido de Inventario en Chromium con MySQL desechable. No utiliza .env ni registros de negocio. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {server,password}=require('./support/application-fixture'),{database}=require('./support/inventory-mysql-fixture'),{body}=require('./support/purchase-fixture');
const Repo=require('../src/repositories/InventoryRepository'),Service=require('../src/services/InventoryService'),PurchaseRepo=require('../src/repositories/PurchaseRepository'),PurchaseService=require('../src/services/PurchaseService');
test('Inventario U030 en navegador y MySQL',{skip:process.env.PARIS_UI_BROWSER_TESTS!=='1'||!process.env.TEST_DB_USER,timeout:120000},async t=>{
 const db=await database(),repo=new Repo(db.pool),service=new Service(repo),purchaseRepo=new PurchaseRepo(db.pool),purchases=new PurchaseService(purchaseRepo);
 const key=()=>crypto.randomUUID();await purchases.create(1,key(),body());
 const product=(await service.list({})).records[0];await db.owner.query('UPDATE producto SET stock_minimo=15 WHERE id_producto=?',[product.id]);const stockId=(await service.lots(product.id,{})).records[0].id;
 const app=await server({inventoryRepository:repo,productRepository:repo.products,purchaseRepository:purchaseRepo});
 const {chromium}=require(process.env.PARIS_PLAYWRIGHT_PATH||'playwright'),browser=await chromium.launch({headless:true,executablePath:process.env.PARIS_BROWSER_EXECUTABLE||undefined,args:JSON.parse(process.env.PARIS_BROWSER_ARGS||'[]')});
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-BO'});page.setDefaultTimeout(9000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR: '+e.message);});
 const shot=async name=>{if(process.env.PARIS_UI_SCREENSHOTS){fs.mkdirSync(process.env.PARIS_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PARIS_UI_SCREENSHOTS,name+'.png')});}};
 const check=async(name,fn)=>{let failure;await t.test(name,async()=>{try{await fn();}catch(e){failure=e;console.error(e.message);await shot('u030-fallo');throw e;}});if(failure)throw failure;};
 const detail=()=>page.getByRole('dialog',{name:'Existencias: '+product.name,exact:true});
 const menu=async(container,label)=>{await container.locator('tr[data-row-index]').first().getByRole('button',{name:/Acciones del registro/}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();};
 const form=title=>page.getByRole('dialog',{name:title,exact:true});
 let drop=false;const posts=[];
 await page.route('**/api/inventario/traslados',async route=>{if(route.request().method()!=='POST')return route.continue();posts.push({body:route.request().postDataJSON(),key:route.request().headers()['x-operation-id']});const response=await route.fetch();if(drop){drop=false;return route.abort('failed');}return route.fulfill({response});});
 try{
  await page.goto(app.base+'/login');await page.locator('[name=nombre_usuario]').fill('audit_user');await page.locator('[name=contrasena]').fill(password);await page.locator('[data-login-submit]').click();await page.waitForURL('**/inicio');
  await check('listado real, avisos, filtros y detalle por ubicación',async()=>{
   await page.goto(app.base+'/inventario');await page.locator('#inventory-table tr[data-row-index]').waitFor();await page.locator('#inventory-table .app-badge').filter({hasText:'Stock bajo'}).first().waitFor();await page.getByRole('combobox',{name:'Avisos',exact:true}).click();await page.getByRole('option',{name:'Agotados',exact:true}).click();await page.locator('#inventory-table').getByText('No hay registros para mostrar.',{exact:true}).waitFor();
   await page.getByRole('combobox',{name:'Avisos',exact:true}).click();await page.getByRole('option',{name:'Todos los avisos',exact:true}).click();await page.locator('#inventory-table tr[data-row-index]').waitFor();assert.equal(await page.locator('.app-filter-feedback:visible').count(),0);await shot('u030-inventario');
   await page.locator('#module-search').fill('NO EXISTE');await page.locator('#module-search').press('Enter');await page.getByText('No hay registros para mostrar.',{exact:true}).waitFor();
   await page.locator('#module-search').fill('');await page.locator('#module-search').press('Enter');await page.locator('#inventory-table tr[data-row-index]').waitFor();
   await menu(page.locator('#inventory-table'),'Ver existencias');await detail().locator('tr[data-row-index]').waitFor();await shot('u030-existencias');
   assert.equal(await detail().locator('.app-table-scroll').evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
  });
  await check('cancelar no crea destinos ni movimientos',async()=>{
   await menu(detail(),'Trasladar');const m=form('Trasladar mercadería');await m.getByRole('combobox',{name:'Ubicación de destino *',exact:true}).fill('UBICACION CANCELADA');await m.getByLabel('Cantidad a trasladar *',{exact:true}).fill('2');await shot('u030-traslado');
   await m.getByRole('button',{name:'Cancelar',exact:true}).click();await form('Descartar cambios').getByRole('button',{name:'Descartar cambios',exact:true}).click();
   assert.equal((await service.locations({term:'UBICACION CANCELADA'})).total,0);assert.equal((await service.history({type:'TRASLADO'})).total,0);
  });
  await check('traslado guarda, mantiene una clave tras perder la respuesta y actualiza ubicaciones',async()=>{
   await menu(detail(),'Trasladar');const m=form('Trasladar mercadería');await m.getByRole('combobox',{name:'Ubicación de destino *',exact:true}).fill('HELADERA');await m.locator('[name=quantity]').fill('4');await m.locator('[name=reason]').fill('REPONER LA HELADERA');
   drop=true;await m.getByRole('button',{name:'Guardar',exact:true}).click();await m.getByText('No se pudo confirmar la operación. Revisa la conexión y vuelve a intentarlo desde este formulario.',{exact:true}).waitFor();
   await m.getByRole('button',{name:'Guardar',exact:true}).click();await m.waitFor({state:'detached'});assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);assert.equal((await service.history({type:'TRASLADO'})).total,1);
   await detail().getByRole('cell',{name:'HELADERA',exact:true}).waitFor();assert.equal((await service.detail(product.id)).physicalStock,'12.000');await detail().getByRole('combobox',{name:'Ubicación',exact:true}).click();await detail().getByRole('option',{name:'HELADERA',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dialog[open] tr[data-row-index]').length===1);
   await detail().getByRole('combobox',{name:'Ubicación',exact:true}).click();await detail().getByRole('option',{name:'Todas las ubicaciones',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dialog[open] tr[data-row-index]').length===2);await shot('u030-ubicaciones');
   await page.locator('.app-toast[data-kind=success]').waitFor();await page.locator('.app-toast[data-kind=success]').waitFor({state:'detached'});
  });
  await check('conteo y retiro usan formularios compartidos y cantidades reales',async()=>{
   await menu(detail(),'Corregir por conteo');let m=form('Corregir por conteo');await m.locator('[name=quantity]').fill('10');await m.getByText('Se sumarán 2 Unidad.',{exact:true}).waitFor();await m.locator('[name=reason]').fill('DIFERENCIA AL CONTAR');await shot('u030-conteo');
   await m.getByRole('button',{name:'Guardar',exact:true}).click();await m.waitFor({state:'detached'});assert.equal((await service.detail(product.id)).physicalStock,'14.000');
   await menu(detail(),'Retirar mercadería');m=form('Retirar mercadería');assert.equal(await m.locator('select[name=type]').evaluate(n=>n.hidden),true);await m.getByRole('combobox',{name:'Motivo del retiro *',exact:true}).click();await m.getByRole('option',{name:'Mercadería dañada',exact:true}).click();
   await m.locator('[name=quantity]').fill('1');await m.locator('[name=reason]').fill('BOTELLA ROTA');await m.getByRole('button',{name:'Guardar',exact:true}).click();await m.waitFor({state:'detached'});assert.equal((await service.detail(product.id)).physicalStock,'13.000');
  });
  await check('una existencia modificada mientras el formulario está abierto rechaza el conteo antiguo',async()=>{
   await menu(detail(),'Corregir por conteo');const m=form('Corregir por conteo'),current=await service.stock(stockId);await service.count(1,key(),{stockId,version:current.version,quantity:'10',reason:'CONTEO EN OTRA VENTANA'});
   await m.locator('[name=quantity]').fill('12');await m.locator('[name=reason]').fill('FORMULARIO ANTIGUO');await m.getByRole('button',{name:'Guardar',exact:true}).click();await m.getByText('La cantidad o los datos cambiaron. Cierra este formulario y vuelve a abrir la acción para revisar la existencia actual.',{exact:true}).waitFor();
   assert.equal((await service.stock(stockId)).physicalStock,'10.000');await m.getByRole('button',{name:'Cancelar',exact:true}).click();await form('Descartar cambios').getByRole('button',{name:'Descartar cambios',exact:true}).click();
   await detail().getByRole('button',{name:'Cerrar',exact:true}).click();
  });
  await check('historial con motivo y usuario, y diseño móvil sin desbordamiento',async()=>{
   await page.locator('[data-module-primary]').click();const history=form('Movimientos de inventario');await history.locator('tr[data-row-index]').first().waitFor();await shot('u030-historial');
   await history.getByRole('combobox',{name:'Tipo de movimiento',exact:true}).click();await history.getByRole('option',{name:'CONTEO',exact:true}).click();await history.getByRole('cell',{name:'CONTEO',exact:true}).first().waitFor();await menu(history,'Ver detalle');
   const m=form('Detalle del movimiento');await m.getByText('CONTEO EN OTRA VENTANA',{exact:true}).waitFor();await m.getByRole('button',{name:'Cerrar',exact:true}).click();await history.getByRole('button',{name:'Cerrar',exact:true}).click();
   await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});await shot('u030-movil');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await menu(page.locator('#inventory-table'),'Ver existencias');await detail().locator('tr[data-row-index]').first().waitFor();await shot('u030-movil-existencias');assert.equal(await detail().locator('.app-modal-body').evaluate(n=>n.scrollWidth<=n.clientWidth),true);await detail().locator('tr[data-row-index]').first().scrollIntoViewIfNeeded();await shot('u030-movil-lotes');
   assert.deepEqual(errors,[]);
  });
 }finally{await browser.close();await app.close();await db.close();}
});
