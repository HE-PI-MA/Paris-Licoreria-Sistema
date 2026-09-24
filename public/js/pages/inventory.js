/** Coordina Inventario real, avisos compartidos y actualización de todas las vistas abiertas después de cada movimiento. */
(() => {
 'use strict';const UI=window.ParisUI,I=window.ParisInventory,V=I.InventoryView;
 class InventoryPage {
  constructor(host){
   this.api=new UI.CatalogApi('/api/inventario');this.products=new window.ParisProducts.ProductsApi();this.events=new AbortController();this.dialogs=new Set();this.notifications=UI.NotificationCenter.shared();
   this.table=new UI.DataTable({container:host,caption:'Inventario',mode:'scroll',numbered:true,pageSize:50,sort:{key:'name',direction:'asc'},
    columns:[{key:'name',label:'Producto',sortable:true},{key:'category',label:'Categoría',priority:2},{key:'physicalStock',label:'Cantidad física',type:'quantity',priority:1,sortable:true},
     {key:'stock',label:'Disponible',type:'quantity',sortable:true},{key:'unit',label:'Se cuenta en',priority:1},{key:'stockStatus',label:'Existencias',type:'state',states:V.stockStates,priority:1},{key:'expiryNotice',label:'Vencimiento',type:'state',states:V.expiryStates,priority:2}],
    load:async p=>{const data=await this.api.list(p);return {...data,records:data.records.map(r=>V.summary(r))};},actionDisplay:'menu',
    actions:[{id:'detail',label:'Ver existencias',icon:'box',tone:'info'},{id:'history',label:'Ver movimientos',icon:'refresh',tone:'catalog'}],onAction:action=>this.handle(action)});
   const container=document.querySelector('[data-module-region="controls"]'),row=container.querySelector('.module-controls-row');
   const options=[{value:'',label:'Todos los avisos'},{value:'BAJO',label:'Stock bajo'},{value:'AGOTADO',label:'Agotados'},{value:'PROXIMO',label:'Vencen en 30 días'},{value:'VENCIDO',label:'Con mercadería vencida'}];
   const alert=V.filterSelect(row,'Avisos',options);
   this.filters=new UI.FilterBar({container,searchInput:document.getElementById('module-search'),mode:'inline',fields:[
    {name:'categoryId',label:'Categoría',type:'select',control:document.getElementById('module-category'),emptyLabel:'Todas las categorías',load:p=>this.products.options('categories',p)},
    {name:'alert',label:'Avisos',type:'select',control:alert,emptyLabel:options[0].label,options:options.slice(1)}],onChange:q=>this.table.setQuery(q)});
   document.querySelector('[data-module-primary]').addEventListener('click',event=>this.track(V.history(this.api,event.currentTarget)),{signal:this.events.signal});
   window.addEventListener('pagehide',()=>this.destroy(),{once:true,signal:this.events.signal});
  }
  track(modal){this.dialogs.add(modal);const close=modal.onClose;modal.onClose=value=>{close(value);this.dialogs.delete(modal);};return modal;}
  async handle({action,record,button},parent){
   UI.Button.setBusy(button,true,'Cargando…');
   try{
    if(action==='detailLot'){this.track(V.lot(record,button));return;}
    if(action==='history'){this.track(V.history(this.api,button,record));return;}
    const row=await (action==='detail'?this.api.detail(record.id):this.api.request('/existencias/'+record.id));if(this.destroyed||parent?.destroyed)return;
    if(action==='detail')this.track(V.product(row,this.api,button,(item,modal)=>this.handle(item,modal)));
    else this.track(new I.InventoryForm({api:this.api,record:row,kind:action,opener:button,onSaved:result=>this.saved(result)}).modal);
   }catch(error){if(!this.destroyed&&error.name!=='AbortError')this.notifications.show('error',error.userMessage||'No se pudo consultar el inventario.');}
   finally{UI.Button.setBusy(button,false);}
  }
  async saved(result){
   if(this.destroyed)return;this.notifications.show('success',({transfer:'Traslado',count:'Conteo',remove:'Retiro'})[result.kind]+' registrado correctamente.');
   const work=[this.table.refresh(),...[...this.dialogs].filter(m=>!m.destroyed&&m.refresh).map(m=>m.refresh())];
   const results=await Promise.allSettled(work);if(results.some(r=>r.status==='rejected')&&!this.destroyed)this.notifications.show('warning','El movimiento se guardó. Actualiza la vista para consultar las cantidades actuales.');
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.events.abort();this.filters.destroy();this.table.destroy();this.notifications.destroy();for(const modal of [...this.dialogs].reverse())modal.close();this.dialogs.clear();}
 }
 I.InventoryPage=InventoryPage;const host=document.getElementById('inventory-table');if(host)new InventoryPage(host);
})();
