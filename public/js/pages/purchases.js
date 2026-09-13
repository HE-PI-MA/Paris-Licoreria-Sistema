/** Coordina el listado y el formulario de Compras. La tabla y los filtros solo emiten acciones; las operaciones pertenecen a esta clase. */
(() => {
  'use strict';
  const UI=window.ParisUI,P=window.ParisPurchases;
  class PurchasesPage {
    constructor(element){
      this.api=new UI.CatalogApi('/api/compras');this.events=new AbortController();this.dialogs=new Set();this.notifications=new UI.NotificationCenter();
      this.table=new UI.DataTable({container:element,caption:'Compras',mode:'scroll',numbered:true,pageSize:50,
        columns:[{key:'date',label:'Fecha',sortable:true},{key:'supplier',label:'Proveedor',sortable:true},{key:'total',label:'Total (Bs)',type:'price',sortable:true},{key:'user',label:'Registrado por',priority:1}],
        sort:{key:'date',direction:'desc'},load:p=>this.api.list(p),actionDisplay:'menu',actions:[{id:'detail',label:'Ver detalle',icon:'info'}],
        onAction:({record,button})=>this.detail(record.id,button)});
      this.filters=new UI.FilterBar({container:document.querySelector('[data-module-region="controls"]'),searchInput:document.getElementById('module-search'),mode:'inline',onChange:q=>this.table.setQuery(q)});
      document.querySelector('[data-module-primary]').addEventListener('click',event=>{
        const form=new P.PurchaseForm({api:this.api,opener:event.currentTarget,onSaved:result=>this.saved(result)});this.track(form.modal);
      },{signal:this.events.signal});
      window.addEventListener('pagehide',()=>this.destroy(),{once:true,signal:this.events.signal});
    }
    track(modal){this.dialogs.add(modal);const close=modal.onClose;modal.onClose=value=>{close(value);this.dialogs.delete(modal);};}
    async saved(result){if(this.destroyed)return;window.ParisModule.resetMessage();this.notifications.show('success','Compra N.º '+result.id+' guardada correctamente.');await this.table.refresh();}
    async detail(id,opener){
      try{const record=await this.api.detail(id);if(!this.destroyed)this.track(P.PurchaseView.purchase(record,opener));}
      catch(error){if(!this.destroyed)window.ParisModule.showMessage('error',error.userMessage || 'No se pudo consultar la compra.');}
    }
    destroy(){if(this.destroyed)return;this.destroyed=true;this.events.abort();this.filters.destroy();this.table.destroy();this.notifications.destroy();for(const modal of this.dialogs){modal.close();}this.dialogs.clear();}
  }
  P.PurchasesPage=PurchasesPage;const host=document.getElementById('purchases-table');if(host)new PurchasesPage(host);
})();
