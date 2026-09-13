/** Presentación de compras y sus filas mediante DataTable, RecordDetails y Modal globales; los valores nunca se insertan como HTML. */
(() => {
  'use strict';
  const UI=window.ParisUI;
  class PurchaseView {
    static columns(){return [
      {key:'product',label:'Producto'}, {key:'presentation',label:'Presentación',priority:1},
      {key:'quantity',label:'Cantidad',type:'quantity'}, {key:'cost',label:'Costo (Bs)',type:'price',priority:1},
      {key:'subtotal',label:'Subtotal (Bs)',type:'price'}];}
    static dialog(title,content,opener,destroy=()=>{}){
      const modal=new UI.Modal({title,icon:'bag',size:'large',content,onClose:()=>{destroy();modal.destroy();}});
      const close=UI.Button.create({label:'Cerrar'});close.addEventListener('click',()=>modal.requestClose(),{signal:modal.events.signal});modal.footer.append(close);modal.open(opener);return modal;
    }
    static line(record,opener){
      const details=new UI.RecordDetails({record,fields:[
        {key:'product',label:'Producto',wide:true},{key:'presentation',label:'Presentación'},{key:'unit',label:'Unidad base'},
        {key:'quantity',label:'Cantidad comprada',type:'quantity'},{key:'factor',label:'Unidades base por presentación',type:'quantity'},
        {key:'baseQuantity',label:'Ingreso en unidades base',type:'quantity'},{key:'cost',label:'Costo por presentación',type:'price'},
        {key:'subtotal',label:'Subtotal',type:'price'},{key:'lotCode',label:'Lote',empty:'Sin especificar'},
        {key:'expiresOn',label:'Vencimiento',empty:'Sin especificar'}]});return this.dialog('Detalle del producto comprado',details.element,opener);
    }
    static purchase(record,opener){
      const content=UI.element('div','app-form');
      const details=new UI.RecordDetails({record,fields:[{key:'supplier',label:'Proveedor',wide:true},{key:'date',label:'Fecha'},{key:'user',label:'Registrado por'},
        {key:'total',label:'Total',type:'price'},{key:'observation',label:'Observación',wide:true,empty:'Sin observación'}]});
      const host=UI.element('div');content.append(details.element,host);
      const table=new UI.DataTable({container:host,caption:'Productos comprados',records:record.lines,columns:[...this.columns(),{key:'location',label:'Ubicación',priority:2}],
        getRowId:row=>row.rowId,mode:'scroll',numbered:true,fillHeight:false,pageSize:50,actions:[{id:'detail',label:'Ver detalle',icon:'info'}],onAction:({record,button})=>this.line(record,button)});
      return this.dialog('Compra N.º '+record.id,content,opener,()=>table.destroy());
    }
  }
  window.ParisPurchases.PurchaseView=PurchaseView;
})();
