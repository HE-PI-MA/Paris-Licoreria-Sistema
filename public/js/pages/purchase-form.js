/** Modal único de Compras. Hereda campos comunes y coordina autocompletado, borrador y envío atómico mediante POO. */
(() => {
  'use strict';
  const UI=window.ParisUI, P=window.ParisPurchases;
  class PurchaseForm extends UI.CatalogForm {
    constructor(options){
      super({...options,title:'Nueva compra',icon:'bag',size:'large'});
      this.productsApi=new window.ParisProducts.ProductsApi();this.suppliersApi=new UI.CatalogApi('/api/proveedores');
      this.draft=new P.PurchaseDraft();this.pending=new Set();this.generation={};this.lookupRecords=new Map();
      this.grid.remove();
      this.section('Proveedor');
      this.supplier=this.lookup('supplier','Nombre o empresa',p=>this.catalogOptions(this.suppliersApi,p));
      this.phone=this.field('phone','Teléfono',{maxLength:30,uppercase:false});
      this.bindLookup(this.supplier,'supplier',id=>this.suppliersApi.detail(id),record=>{
        this.phone.value=record?.phone || '';this.phone.readOnly=Boolean(record);
      });
      this.section('Ingreso');
      this.location=this.field('locationId','Ubicación de ingreso',{type:'select',required:true,options:[{value:'',label:'Seleccionar ubicación'}]});
      this.locationSelect=new UI.SearchSelect({select:this.location,load:p=>this.api.request('/ubicaciones'+this.api.query(p),{signal:p.signal})});this.selectors.push(this.locationSelect);
      this.observation=this.field('observation','Observación',{maxLength:250,uppercase:true});
      this.section('Producto de la compra');
      this.product=this.lookup('product','Producto',p=>this.productOptions(p));
      this.bindLookup(this.product,'product',id=>this.productsApi.detail(id),record=>this.setProduct(record));
      this.category=super.selector('categoryId','Categoría','categories',null,null,this.productsApi);this.category.required=false;
      this.unit=super.selector('unitId','Unidad base','units',null,null,this.productsApi);this.unit.required=false;
      this.presentation=this.lookup('presentation','Presentación',p=>this.presentationOptions(p));
      this.bindLookup(this.presentation,'presentation',id=>this.productsApi.presentation(this.selectedProduct.id,id),record=>this.setPresentation(record));
      this.factor=this.field('factor','Unidades base por presentación',{type:'number',min:'0.001',step:'0.001',value:'1',help:'Ejemplo: un paquete de 6 equivale a 6 unidades base.'});
      this.barcode=this.field('barcode','Código de barras',{maxLength:50,uppercase:false});
      this.price=this.field('price','Precio de venta de la presentación (Bs)',{type:'number',min:'0',step:'0.01'});
      this.quantity=this.field('quantity','Cantidad comprada',{type:'number',min:'0.001',step:'0.001',value:'1'});
      this.cost=this.field('cost','Costo por presentación (Bs)',{type:'number',min:'0',step:'0.01'});
      this.lot=this.field('lotCode','Lote (opcional)',{maxLength:80,uppercase:false});
      this.expiry=this.field('expiresOn','Vencimiento (opcional)',{type:'date'});
      const toolbar=UI.element('div','app-form-toolbar');
      this.add=UI.Button.create({label:'Agregar producto',icon:'plus',variant:'primary'});
      this.reset=UI.Button.create({label:'Limpiar producto'});toolbar.append(this.add,this.reset);this.form.append(toolbar);
      const host=UI.element('div');host.id=this.form.id+'-items';this.form.append(host);
      this.table=new UI.DataTable({container:host,caption:'Productos de la compra',mode:'scroll',numbered:true,fillHeight:false,pageSize:50,
        columns:P.PurchaseView.columns(),actionDisplay:'menu',actions:[
          {id:'detail',label:'Ver detalle',icon:'info'}, {id:'edit',label:'Editar',icon:'edit',tone:'edit'}, {id:'remove',label:'Quitar',icon:'trash',variant:'danger'}
        ],onAction:item=>this.rowAction(item)});
      this.total=UI.element('output','app-form-total','Total: Bs 0,00');this.total.setAttribute('aria-live','polite');this.modal.footer.append(this.total);
      this.draftState=UI.element('input');this.draftState.type='hidden';this.draftState.name='draftState';this.draftState.value='[]';this.form.append(this.draftState);
      const cancel=UI.Button.create({label:'Cancelar'}),save=UI.Button.create({label:'Guardar compra',icon:'success',variant:'primary',type:'submit'});save.setAttribute('form',this.form.id);
      this.modal.footer.append(cancel,save);
      const send=this.api.operation('');
      this.controller=new UI.FormController({form:this.form,modal:this.modal,
        validate:()=>this.validatePurchase(),onSubmit:(_,settings)=>send(this.payload(),settings),onSuccess:async result=>{this.modal.close();await this.onSaved(result);}});
      const settings={signal:this.modal.events.signal};
      cancel.addEventListener('click',()=>this.modal.requestClose(),settings);
      this.add.addEventListener('click',()=>this.addLine(),settings);this.reset.addEventListener('click',()=>this.clearEditor(),settings);
      const close=this.modal.onClose;this.modal.onClose=value=>{this.destroyed=true;this.table.destroy();close(value);};
      this.modal.open(this.opener);this.supplier.control.input.focus();
    }
    /** Hereda los campos de CatalogForm y cambia únicamente el grupo semántico donde se insertan. */
    section(title){
      const section=UI.element('section','app-form-section'),heading=UI.element('h3','app-form-section-title',title);
      this.grid=UI.element('div','app-form-grid');section.append(heading,this.grid);this.form.append(section);
    }
    lookup(name,label,load){
      const select=this.field(name,label,{type:'select',options:[{value:'',label:''}]}),control=new UI.SearchSelect({select,load,allowCustom:true});
      control.input.placeholder='Buscar o escribir nuevo…';
      const status=UI.element('span','app-field-help');status.setAttribute('role','status');select.closest('.app-field').append(status);
      this.selectors.push(control);return {select,control,status};
    }
    async catalogOptions(api,params){
      const result=await api.list({...params,query:{state:'ACTIVO'}});
      return {options:result.records.map(row=>({value:row.id,label:row.name})),total:result.total};
    }
    async productOptions(params){
      // Los productos nuevos del borrador se pueden reutilizar antes de guardar la compra.
      const local=this.draft.rows.filter(row=>!row.line.product.id && row.product.toLocaleLowerCase('es').includes(params.term.toLocaleLowerCase('es')));
      const unique=[...new Map(local.map(row=>[row.line.product.clientKey,row])).values()];
      if(unique.length){
        unique.forEach(row=>this.lookupRecords.set('draft:'+row.line.product.clientKey,{...row.line.product,name:row.product,category:row.category,unit:row.unit}));
        const result=await this.catalogOptions(this.productsApi,params);
        // No mezclar páginas remotas con resultados locales truncados: ofrecer locales solo si no existen coincidencias remotas.
        if(result.total)return result;
        return {options:unique.slice((params.page-1)*params.pageSize,params.page*params.pageSize).map(row=>({value:'draft:'+row.line.product.clientKey,label:row.product+' (NUEVO EN ESTA COMPRA)'})),total:unique.length};
      }
      return this.catalogOptions(this.productsApi,params);
    }
    async presentationOptions(params){
      let remote={options:[],total:0};
      if(this.selectedProduct?.id){
        const result=await this.productsApi.presentations(this.selectedProduct.id,{...params,query:{state:'ACTIVO'}});
        remote={options:result.records.map(row=>({value:row.id,label:row.name})),total:result.total};
      }
      if(remote.total)return remote;
      const identity=this.selectedProduct?.id || this.selectedProduct?.clientKey;
      const rows=this.draft.rows.filter(row=>identity && (row.line.product.id || row.line.product.clientKey)===identity && !row.line.presentation.id && row.presentation.toLocaleLowerCase('es').includes(params.term.toLocaleLowerCase('es')));
      const unique=[...new Map(rows.map(row=>[row.presentation,row])).values()];
      unique.forEach(row=>this.lookupRecords.set('draft-presentation:'+row.id,row.line.presentation));
      return {options:unique.slice((params.page-1)*params.pageSize,params.page*params.pageSize).map(row=>({value:'draft-presentation:'+row.id,label:row.presentation+' (NUEVA EN ESTA COMPRA)'})),total:unique.length};
    }
    bindLookup(lookup,key,load,selected){
      const changed=async()=>{
        const generation=this.generation[key]=(this.generation[key] || 0)+1;
        const id=lookup.select.value;this.pending.delete(key);this[key+'Record']=null;selected(null);
        if(!id){lookup.status.textContent=lookup.control.input.value.trim()?'Nuevo — se creará al guardar la compra':'';return;}
        this.pending.add(key);lookup.status.textContent='Cargando…';
        try{
          const local=this.lookupRecords.get(id);
          const record=local || await load(id);
          if(this.destroyed || generation!==this.generation[key])return;
          if(record.state && record.state!=='ACTIVO')throw new UI.CatalogApiError('El registro ya no está activo. Vuelve a buscarlo.');
          this[key+'Record']=record;selected(record);lookup.status.textContent=local?'Nuevo en esta compra':'Existente';
        }catch(error){if(!this.destroyed && generation===this.generation[key]){lookup.status.textContent='No se pudo cargar. Vuelve a seleccionar.';lookup.select.value='';this.controller?.alert.show('error',error.userMessage || 'No se pudo cargar la selección.');}}
        finally{if(generation===this.generation[key])this.pending.delete(key);}
      };
      const options={signal:this.modal.events.signal};lookup.select.addEventListener('change',changed,options);
      lookup.control.input.addEventListener('input',()=>{if(!lookup.select.value)lookup.status.textContent=lookup.control.input.value.trim()?'Nuevo — se creará al guardar la compra':'';},options);
    }
    setProduct(record){
      this.selectedProduct=record;this.presentationRecord=null;this.generation.presentation=(this.generation.presentation || 0)+1;this.pending.delete('presentation');
      if(this.presentation){this.presentation.control.setValue(null);this.presentation.status.textContent='';this.setPresentation(null);}
      if(!this.category)return;
      for(const [input,key,label] of [[this.category,'categoryId','category'],[this.unit,'unitId','unit']]){
        UI.SearchSelect.controls.get(input).setValue(record?{value:record[key],label:record[label]}:null);input.disabled=Boolean(record);
      }
    }
    setPresentation(record){
      this.selectedPresentation=record;
      for(const [input,key,fallback] of [[this.factor,'factor','1'],[this.price,'price',''],[this.barcode,'barcode','']])if(input){input.value=record?.[key] ?? fallback;input.readOnly=Boolean(record);}
    }
    ref(record){return {id:record.id,version:record.version};}
    payload(){
      if(this.pending.size)throw new UI.CatalogApiError('Espera a que termine la selección.');
      if(this.product.control.input.value.trim() || this.presentation.control.input.value.trim() || this.cost.value || this.lot.value || this.expiry.value || this.price.value || this.quantity.value!=='1' || this.factor.value!=='1' || this.editing)throw new UI.CatalogApiError('Agrega el producto que estás editando o pulsa Limpiar producto antes de guardar la compra.');
      if(!this.draft.rows.length)throw new UI.CatalogApiError('Agrega al menos un producto a la compra.');
      return {supplier:this.supplierRecord?this.ref(this.supplierRecord):{name:this.supplier.control.input.value.trim(),phone:this.phone.value.trim()},
        locationId:this.location.value,observation:this.observation.value,lines:this.draft.payload()};
    }
    validatePurchase(){
      return !this.supplier.control.input.value.trim()?{supplierText:'Escribe o selecciona el proveedor.'}:{};
    }
    addLine(){
      if(this.controller.busy)return;
      this.controller.clearErrors();
      try{
        if(this.pending.size)throw new UI.CatalogApiError('Espera a que termine la selección.');
        const name=this.product.control.input.value.trim(),presentationName=this.presentation.control.input.value.trim();
        if(!name || !presentationName)throw new UI.CatalogApiError('Escribe o selecciona el producto y su presentación.');
        if(!this.category.value || !this.unit.value)throw new UI.CatalogApiError('Selecciona la categoría y la unidad base.');
        const product=this.selectedProduct?.id?this.ref(this.selectedProduct):{
          clientKey:this.selectedProduct?.clientKey || crypto.randomUUID(),name:this.selectedProduct?.name || name,categoryId:this.category.value,unitId:this.unit.value};
        const presentation=this.selectedPresentation?.id?this.ref(this.selectedPresentation):{name:this.selectedPresentation?.name || presentationName,
          factor:P.PurchaseDraft.decimal(this.factor.value,3,'la equivalencia',true),barcode:this.barcode.value.trim(),price:P.PurchaseDraft.decimal(this.price.value,2,'el precio de venta')};
        const quantity=P.PurchaseDraft.decimal(this.quantity.value,3,'la cantidad',true),cost=P.PurchaseDraft.decimal(this.cost.value,2,'el costo');
        const factor=this.selectedPresentation?.factor || presentation.factor;
        const baseQuantity=UI.Decimal.multiply(quantity,factor,3);
        if(UI.Decimal.units(baseQuantity,3)<=0n || UI.Decimal.units(baseQuantity,3)>999999999999999n)throw new UI.CatalogApiError('Revisa la cantidad y su equivalencia en unidades base.');
        const display={product:this.selectedProduct?.name || name,presentation:this.selectedPresentation?.name || presentationName,
          categoryId:this.category.value,unitId:this.unit.value,category:UI.SearchSelect.controls.get(this.category).input.value,unit:UI.SearchSelect.controls.get(this.unit).input.value,
          factor,baseQuantity,price:this.price.value,barcode:this.barcode.value,lotCode:this.lot.value,expiresOn:this.expiry.value};
        this.draft.save({product,presentation,quantity,cost,lotCode:this.lot.value,expiresOn:this.expiry.value},display,this.editing);
        this.updateDraft();this.clearEditor();
      }catch(error){this.controller.alert.show('error',error.userMessage || 'Revisa los datos del producto.');}
    }
    updateDraft(){this.draftState.value=JSON.stringify(this.draft.payload());this.total.textContent='Total: Bs '+UI.Decimal.format(this.draft.total());this.table.setData(this.draft.rows);}
    clearEditor(){
      if(this.controller?.busy)return;
      this.editing=null;this.productRecord=null;this.generation.product=(this.generation.product || 0)+1;this.pending.delete('product');
      this.product.control.setValue(null);this.product.status.textContent='';this.setProduct(null);
      this.quantity.value='1';this.cost.value=this.lot.value=this.expiry.value='';this.add.querySelector('span').textContent='Agregar producto';
    }
    async rowAction({action,record,button}){
      if(this.controller.busy)return;
      if(action==='detail')return P.PurchaseView.line(record,button);
      if(action==='remove'){
        if(await UI.Confirm.ask({title:'Quitar producto',message:'Quitar '+record.product+' de esta compra.',confirmLabel:'Quitar',danger:true}) && !this.destroyed && !this.controller.busy){this.draft.remove(record.id);if(this.editing===record.id)this.clearEditor();this.updateDraft();}return;
      }
      if(this.product.control.input.value.trim() && !await UI.Confirm.ask({title:'Cambiar producto',message:'Se descartará la edición del producto que aún no agregaste.',confirmLabel:'Continuar'}))return;
      if(this.destroyed || this.controller.busy)return;
      this.clearEditor();this.editing=record.id;
      const line=record.line;
      this.selectedProduct={...line.product,name:record.product};
      this.product.control.setValue({value:line.product.id || 'draft:'+line.product.clientKey,label:record.product});this.product.status.textContent=line.product.id?'Existente':'Nuevo en esta compra';
      for(const [input,key,label] of [[this.category,'categoryId','category'],[this.unit,'unitId','unit']]){
        UI.SearchSelect.controls.get(input).setValue({value:record[key],label:record[label]});input.disabled=true;
      }
      this.selectedPresentation=line.presentation.id?{...line.presentation,name:record.presentation,factor:record.factor}:null;
      if(line.presentation.id)this.presentation.control.setValue({value:line.presentation.id,label:record.presentation});else this.presentation.control.input.value=record.presentation;this.presentation.status.textContent=line.presentation.id?'Existente':'Nuevo';
      for(const [input,value] of [[this.factor,record.factor],[this.price,record.price],[this.barcode,record.barcode],[this.quantity,line.quantity],[this.cost,line.cost],[this.lot,line.lotCode],[this.expiry,line.expiresOn]])input.value=value || '';
      this.factor.readOnly=this.price.readOnly=this.barcode.readOnly=Boolean(line.presentation.id);
      this.add.querySelector('span').textContent='Actualizar producto';this.product.control.input.focus();
    }
  }
  P.PurchaseForm=PurchaseForm;
})();
