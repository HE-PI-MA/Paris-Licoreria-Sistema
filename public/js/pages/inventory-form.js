/** Un formulario POO para traslados, conteos y retiros; comparte campos, selector, validación y envío con los catálogos. */
(() => {
 'use strict';const UI=window.ParisUI,I=window.ParisInventory;
 class InventoryForm extends UI.CatalogForm {
  constructor(options){
   const kind=options.kind,titles={transfer:'Trasladar mercadería',count:'Corregir por conteo',remove:'Retirar mercadería'};
   super({...options,title:titles[kind],icon:kind==='transfer'?'refresh':kind==='count'?'edit':'trash'});this.kind=kind;const row=this.record;
   this.form.prepend(new UI.RecordDetails({record:row,fields:[{key:'product',label:'Producto',wide:true},{key:'location',label:'Ubicación actual'},{key:'lotCode',label:'Lote',empty:'Sin código'},{key:'physicalStock',label:'Cantidad registrada',type:'quantity'},{key:'unit',label:'Se cuenta en'}]}).element);
   if(kind==='transfer'){
    const select=this.field('destination','Ubicación de destino',{type:'select',options:[{value:'',label:''}],required:true,help:'Puedes elegir una ubicación o escribir una nueva.'});
    this.destination=new UI.SearchSelect({select,allowCustom:true,placeholder:'Ej.: Heladera',load:p=>this.api.request('/ubicaciones'+this.api.query(p),{signal:p.signal})});
    this.destination.input.maxLength=80;this.destination.input.required=true;select.required=false;this.selectors.push(this.destination);
   }
   if(kind==='remove'){
    const select=this.field('type','Motivo del retiro',{type:'select',required:true,options:[{value:'DAÑADO',label:'Mercadería dañada'},{value:'PERDIDO',label:'Mercadería perdida'},{value:'VENCIDO',label:'Mercadería vencida'},{value:'OTRO',label:'Otro motivo'}]});
    this.selectors.push(new UI.SearchSelect({select,searchable:false}));this.removeType=select;
   }
   this.quantity=this.field('quantity',kind==='count'?'¿Cuánto contaste?':'Cantidad a '+(kind==='transfer'?'trasladar':'retirar'),{type:'number',min:kind==='count'?'0':'0.001',max:'999999999999.999',step:'0.001',required:true,placeholder:'Ej.: 6',help:'Escribe la cantidad en '+row.unit+'.'});
   this.preview=UI.element('p','app-field-help app-field--wide');this.preview.setAttribute('role','status');this.grid.append(this.preview);
   this.quantity.addEventListener('input',()=>this.updatePreview(),{signal:this.modal.events.signal});
   this.reason=this.field('reason','Explica el motivo',{type:'textarea',required:true,maxLength:250,wide:true,uppercase:true,placeholder:kind==='transfer'?'Ej.: Reponer la heladera':kind==='count'?'Ej.: Diferencia encontrada al contar':'Ej.: Botellas rotas durante la descarga'});
   const route={transfer:'/traslados',count:'/conteos',remove:'/retiros'}[kind];
   this.start(route,()=>({stockId:row.id,version:row.version,quantity:this.quantity.value,reason:this.reason.value,
    ...(kind==='transfer'?(this.destination.select.value?{destinationId:this.destination.select.value}:{destinationName:this.destination.input.value.trim()}):{}),
    ...(kind==='remove'?{type:this.removeType.value}:{})}),this.destination?.input||this.quantity);
  }
  updatePreview(){
   try{const before=UI.Decimal.units(this.record.physicalStock,3),entered=UI.Decimal.units(this.quantity.value,3),difference=entered-before;
    if(this.kind==='count')this.preview.textContent=difference===0n?'No hay diferencia con lo registrado.':(difference>0n?'Se sumarán ':'Se descontarán ')+UI.ValueFormat.number(UI.Decimal.text(difference<0n?-difference:difference,3))+' '+this.record.unit+'.';
    else this.preview.textContent=entered>before?'La cantidad supera lo registrado.':'Quedarán '+UI.ValueFormat.number(UI.Decimal.text(before-entered,3))+' '+this.record.unit+' en '+this.record.location+'.';
   }catch(_){this.preview.textContent='';}
  }
 }
 I.InventoryForm=InventoryForm;
})();
