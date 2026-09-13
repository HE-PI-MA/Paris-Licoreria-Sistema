/** Vistas de Inventario construidas exclusivamente con tablas, filtros, detalles, etiquetas y modales compartidos. */
(() => {
 'use strict';const UI=window.ParisUI;let sequence=0;
 class InventoryView {
  static stockStates={DISPONIBLE:{label:'Disponible',tone:'success'},BAJO:{label:'Stock bajo',tone:'warning'},AGOTADO:{label:'Agotado',tone:'error'},INACTIVO:{label:'Inactivo',tone:'inactive'}};
  static expiryStates={VENCIDO:{label:'Vencido',tone:'error'},PROXIMO_A_VENCER:{label:'Próximo a vencer',tone:'warning'},VIGENTE:{label:'Vigente',tone:'success'},SIN_FECHA:{label:'Sin fecha',tone:'neutral'},SIN_ALERTA:{label:'Sin aviso',tone:'neutral'}};
  static summary(row){return {...row,stockStatus:row.state==='INACTIVO'?'INACTIVO':Number(row.stock)===0?'AGOTADO':Number(row.stock)<=Number(row.minimum)?'BAJO':'DISPONIBLE',expiryNotice:Number(row.expired)>0?'VENCIDO':Number(row.expiring)>0?'PROXIMO_A_VENCER':'SIN_ALERTA'};}
  static summaryFields(){return [{key:'name',label:'Producto',wide:true},{key:'category',label:'Categoría'},{key:'unit',label:'Se cuenta en'},
   {key:'physicalStock',label:'Cantidad física',type:'quantity'},{key:'stock',label:'Disponible para vender',type:'quantity'},
   {key:'minimum',label:'Cantidad mínima',type:'quantity'},{key:'expired',label:'Cantidad vencida',type:'quantity'},
   {key:'expiring',label:'Vence en los próximos 30 días',type:'quantity'},{key:'state',label:'Estado del producto',type:'state'}];}
  static filterSelect(container,label,options){
   const host=UI.element('div','module-select-field'),select=UI.element('select','app-input'),caption=UI.element('label','app-sr-only',label);
   select.id='inventory-filter-'+(++sequence);caption.htmlFor=select.id;
   for(const item of options){const option=UI.element('option','',item.label);option.value=item.value;select.append(option);}
   host.append(caption,select);container.append(host);return select;
  }
  static search(container,placeholder){
   const host=UI.element('div','module-search-field'),wrap=UI.element('div','module-search-input'),input=UI.element('input','app-input');
   input.type='search';input.autocomplete='off';input.placeholder=placeholder;input.setAttribute('aria-label','Buscar en el detalle');
   const icon=UI.Icon.create('search');if(icon)wrap.append(icon);wrap.append(input);host.append(wrap);container.append(host);return input;
  }
  static dialog(title,content,opener,cleanup=()=>{}){
   const modal=new UI.Modal({title,icon:'box',size:'large',content,onClose:()=>{cleanup();modal.destroy();}}),close=UI.Button.create({label:'Cerrar'});
   close.addEventListener('click',()=>modal.requestClose(),{signal:modal.events.signal});modal.footer.append(close);modal.open(opener);return modal;
  }
  static product(record,api,opener,onAction){
   const content=UI.element('div','app-form'),summary=UI.element('div'),controls=UI.element('div','module-controls-row app-fields--toolbar'),host=UI.element('div');
   const render=row=>summary.replaceChildren(new UI.RecordDetails({record:row,fields:this.summaryFields()}).element);render(record);
   const search=this.search(controls,'Ej.: Heladera o lote L-01'),location=this.filterSelect(controls,'Ubicación',[{value:'',label:'Todas las ubicaciones'}]);content.append(summary,controls,host);
   const table=new UI.DataTable({container:host,caption:'Lotes y ubicaciones',mode:'scroll',numbered:true,pageSize:50,fillHeight:false,sort:{key:'location',direction:'asc'},
    columns:[{key:'location',label:'Ubicación',sortable:true},{key:'physicalStock',label:'Cantidad',type:'quantity'},{key:'unit',label:'Se cuenta en',priority:1},
     {key:'lotCode',label:'Lote',priority:1},{key:'expiresOn',label:'Vencimiento',type:'date',priority:2},{key:'expiryStatus',label:'Aviso',type:'state',states:this.expiryStates,priority:1}],
    load:async p=>{const data=await api.request('/'+record.id+'/lotes'+api.query(p),{signal:p.signal});return {...data,records:data.records.map(r=>({...r,expiryStatus:r.expiresOn?r.expiryStatus:'SIN_FECHA'}))};},
    actions:[{id:'transfer',label:'Trasladar',icon:'refresh',tone:'info'},{id:'count',label:'Corregir por conteo',icon:'edit',tone:'edit'},{id:'remove',label:'Retirar mercadería',icon:'trash',variant:'danger'}],
    actionDisplay:'menu',onAction:action=>{if(!modal.destroyed)return onAction(action,modal);}});
   const filters=new UI.FilterBar({container:controls,searchInput:search,mode:'inline',fields:[{name:'locationId',label:'Ubicación',type:'select',control:location,emptyLabel:'Todas las ubicaciones',load:p=>api.request('/ubicaciones'+api.query(p),{signal:p.signal})}],onChange:q=>table.setQuery(q)});
   const modal=this.dialog('Existencias: '+record.name,content,opener,()=>{filters.destroy();table.destroy();});
   modal.refresh=async()=>{const next=await api.detail(record.id);if(!modal.destroyed){render(next);await Promise.all([table.refresh(),filters.loadInline(filters.fields[0])]);}};return modal;
  }
  static history(api,opener,product){
   const content=UI.element('div','app-form'),controls=UI.element('div','module-controls-row app-fields--toolbar'),host=UI.element('div'),search=this.search(controls,'Ej.: Coca-Cola o lote L-01');
   const options=[{value:'',label:'Todos los movimientos'},...['COMPRA','TRASLADO','CONTEO','RETIRO','VENTA'].map(value=>({value,label:value}))];
   const type=this.filterSelect(controls,'Tipo de movimiento',options);content.append(controls,host);
   const table=new UI.DataTable({container:host,caption:'Movimientos de inventario',mode:'scroll',numbered:true,pageSize:50,fillHeight:false,sort:{key:'date',direction:'desc'},
    columns:[{key:'product',label:'Producto'},{key:'date',label:'Fecha',priority:1,sortable:true},{key:'type',label:'Tipo',priority:1},
     {key:'quantity',label:'Cantidad',type:'quantity'},{key:'unit',label:'Se cuenta en',priority:2},{key:'source',label:'Desde',priority:3},{key:'destination',label:'Hacia',priority:3},{key:'user',label:'Registrado por',priority:3}],
    load:p=>api.request('/movimientos'+api.query({...p,query:{...p.query,...(product?{productId:product.id}:{})}}),{signal:p.signal}),
    actions:[{id:'detail',label:'Ver detalle',icon:'info',tone:'info'}],actionDisplay:'menu',onAction:({record,button})=>this.movement(record,button)});
   const filters=new UI.FilterBar({container:controls,searchInput:search,mode:'inline',fields:[{name:'type',label:'Tipo de movimiento',type:'select',control:type,emptyLabel:options[0].label,options:options.slice(1)}],onChange:q=>table.setQuery(q)});
   const modal=this.dialog(product?'Movimientos: '+product.name:'Movimientos de inventario',content,opener,()=>{filters.destroy();table.destroy();});modal.refresh=()=>modal.destroyed?Promise.resolve():table.refresh();return modal;
  }
  static movement(row,opener){
   const details=new UI.RecordDetails({record:row,fields:[{key:'product',label:'Producto',wide:true},{key:'type',label:'Movimiento'},{key:'date',label:'Fecha'},
    {key:'quantity',label:'Cantidad del movimiento',type:'quantity'},{key:'unit',label:'Se cuenta en'},{key:'source',label:'Desde',empty:'No corresponde o no se registró'},
    {key:'destination',label:'Hacia',empty:'No corresponde o no se registró'},{key:'lotCode',label:'Lote',empty:'Sin código'},{key:'user',label:'Registrado por'},
    {key:'beforeQuantity',label:'Cantidad anterior',type:'quantity'},{key:'afterQuantity',label:'Cantidad posterior',type:'quantity'},
    {key:'destinationBefore',label:'Destino antes',type:'quantity'},{key:'destinationAfter',label:'Destino después',type:'quantity'},{key:'reason',label:'Motivo',wide:true}]});
   return this.dialog('Detalle del movimiento',details.element,opener);
  }
 }
 window.ParisInventory={InventoryView};
})();
