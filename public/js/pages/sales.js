/** Ventas U039: alta con pago, historial, detalle y anulación administrativa auditada. */
(() => {
  'use strict';
  const UI=window.ParisUI,D=UI.Decimal,admin=document.body.dataset.userRole==='ADMINISTRADOR';
  const field=(label,input)=>{const host=UI.element('div','app-field'),text=UI.element('label','app-label',label);text.htmlFor=input.id;host.append(text,input);return host;};
  const money=value=>UI.ValueFormat.number(value,{type:'price',locale:'es-BO',currency:'BOB'});
  class SaleForm {
    constructor({ api, opener, onSaved }) {
      this.api = api; this.onSaved = onSaved; this.lines = []; this.events = new AbortController(); this.scanner = null; this.lineDialogs = new Set();
      this.form = UI.element('form', 'app-form ops-sale-builder'); this.form.id = 'sale-form-' + Date.now();
      const add = UI.element('section', 'ops-sale-add'), select = UI.element('select', 'app-input'), qty = UI.element('input', 'app-input');
      const button = UI.Button.create({ label: 'Agregar', icon: 'plus', variant: 'secondary' });
      const scan = UI.Button.create({ label: 'Escanear', icon: 'barcode', variant: 'primary' });
      select.id = 'sale-product'; select.name = 'product'; qty.id = 'sale-quantity'; qty.type = 'number'; qty.min = '.001'; qty.step = '.001'; qty.value = '1'; qty.inputMode = 'decimal'; button.type = scan.type = 'button';
      const actions = UI.element('div', 'ops-sale-actions'); actions.append(scan, button);
      add.append(field('Producto o presentación', select), field('Cantidad', qty), actions); this.form.append(add); this.select = select; this.qty = qty; this.scanButton = scan;
      this.linesHost = UI.element('div', 'ops-section'); this.form.append(this.linesHost);
      this.linesTable = new UI.DataTable({ container: this.linesHost, caption: 'Productos de la venta', mode: 'scroll', numbered: true, fillHeight: false, pageSize: 50,
        records: [], getRowId: row => row.presentationId,
        columns: [{ key: 'product', label: 'Producto', format: (_, row) => row.product + ' — ' + row.presentation }, { key: 'quantity', label: 'Cantidad', type: 'quantity' },
          { key: 'price', label: 'Precio', type: 'price', priority: 1 }, { key: 'subtotal', label: 'Subtotal', type: 'price' }],
        actionDisplay: 'menu', actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }, { id: 'remove', label: 'Quitar', icon: 'trash', variant: 'danger' }],
        onAction: ({ action, record, button }) => this.lineAction(action, record, button)
      });
      this.total = UI.element('div', 'ops-total'); this.form.append(this.total);
      const payments = UI.element('div', 'app-form-grid'); this.cash = UI.element('input', 'app-input'); this.cash.type = 'number'; this.cash.min = '0'; this.cash.step = '.01'; this.cash.value = '0'; this.cash.id = 'sale-cash'; this.cash.name = 'cash';
      this.qr = UI.element('input', 'app-input'); this.qr.type = 'number'; this.qr.min = '0'; this.qr.step = '.01'; this.qr.value = '0'; this.qr.id = 'sale-qr'; this.qr.name = 'qr';
      this.receipt = UI.element('input', 'app-input'); this.receipt.type = 'text'; this.receipt.maxLength = 255; this.receipt.id = 'sale-receipt'; this.receipt.name = 'receipt'; this.receipt.placeholder = 'Referencia o comprobante';
      payments.append(field('Pago en efectivo (Bs)', this.cash), field('Pago por QR (Bs)', this.qr), field('Comprobante QR', this.receipt)); this.form.append(payments);
      let controller; this.modal = new UI.Modal({ title: 'Nueva venta', icon: 'cart', size: 'large', content: this.form,
        isDirty: () => Boolean(this.lines.length) || controller?.isDirty(),
        onClose: () => { controller?.destroy(); this.enhanced?.destroy(); this.scanner?.modal?.destroy(); this.events.abort(); this.linesTable?.destroy(); for (const item of this.lineDialogs) item.destroy(); this.lineDialogs.clear(); this.modal.destroy(); }
      });
      const cancel = UI.Button.create({ label: 'Cancelar' }), save = UI.Button.create({ label: 'Registrar venta', variant: 'primary', type: 'submit' }); save.setAttribute('form', this.form.id);
      cancel.addEventListener('click', () => this.modal.requestClose(), { signal: this.modal.events.signal }); this.modal.footer.append(cancel, save);
      button.addEventListener('click', () => this.addLine(), { signal: this.events.signal }); scan.addEventListener('click', () => this.openScanner(scan), { signal: this.events.signal });
      this.operation = api.operation(''); controller = new UI.FormController({ form: this.form, modal: this.modal, validate: () => this.validate(),
        onSubmit: (_, opts) => this.operation(this.payload(), opts), onSuccess: async result => { this.lines = []; this.modal.close(); await onSaved(result); }
      }); this.controller = controller;
      this.loadProducts().then(() => { if (!this.modal.destroyed) this.render(); }); this.modal.open(opener);
    }
    productOption(row) {
      const option = UI.element('option', '', `${row.product} — ${row.presentation} — ${money(row.price)} — disp. ${row.available}`);
      option.value = String(row.id); option.dataset.product = row.product; option.dataset.presentation = row.presentation; option.dataset.price = row.price;
      option.dataset.available = row.available; option.dataset.barcode = row.barcode || ''; return option;
    }
    async loadProducts() {
      try {
        const rows = await this.api.request('/productos?term=');
        if (!Array.from(this.select.options).some(option => option.value === '')) { const empty = UI.element('option', '', 'Selecciona un producto'); empty.value = ''; this.select.append(empty); }
        for (const row of rows) if (!Array.from(this.select.options).some(option => option.value === String(row.id))) this.select.append(this.productOption(row));
        if (!this.enhanced) this.enhanced = new UI.SearchSelect({ select: this.select, placeholder: 'Escribe para buscar producto…' });
      } catch (error) { window.ParisModule.showMessage('error', error.userMessage || 'No se pudieron cargar productos vendibles.'); }
    }
    openScanner(opener) {
      this.scanner?.modal?.destroy();
      this.scanner = new UI.BarcodeScanner({ opener, onRead: code => this.applyBarcode(code) });
    }
    sameBarcode(left, right) {
      const a = String(left || '').trim(), b = String(right || '').trim();
      return Boolean(a && b && (a === b || (a.length === 13 && a.startsWith('0') && a.slice(1) === b) || (b.length === 13 && b.startsWith('0') && b.slice(1) === a)));
    }
    async applyBarcode(code) {
      try {
        const rows = await this.api.request('/productos?term=' + encodeURIComponent(code));
        const row = rows.find(item => this.sameBarcode(item.barcode, code));
        if (!row) {
          UI.NotificationCenter.shared().show('warning', 'No hay una presentación vendible con ese código o no tiene stock disponible.');
          this.enhanced?.input?.focus(); return;
        }
        let option = Array.from(this.select.options).find(item => item.value === String(row.id));
        if (!option) { option = this.productOption(row); this.select.append(option); }
        if (this.enhanced) this.enhanced.setValue({ value: String(row.id), label: option.textContent }); else this.select.value = String(row.id);
        this.qty.value = '1'; this.addLine();
        UI.NotificationCenter.shared().show('success', 'Código reconocido: ' + row.product + ' — ' + row.presentation + '.');
      } catch (error) { UI.NotificationCenter.shared().show('error', error.userMessage || 'No se pudo consultar el código.'); }
    }
    addLine() {
      const option = this.select.selectedOptions[0], quantity = this.qty.value;
      if (!option?.value) { this.enhanced?.input.focus(); return; }
      let q, a; try { q = D.units(quantity, 3); a = D.units(option.dataset.available, 3); } catch (_) { q = 0n; a = 0n; }
      if (q <= 0n || q > a) { this.qty.setAttribute('aria-invalid', 'true'); this.qty.focus(); return; }
      this.qty.removeAttribute('aria-invalid'); const id = Number(option.value), existing = this.lines.find(row => row.presentationId === id);
      if (existing) { const total = D.units(existing.quantity, 3) + q; if (total > a) { this.qty.setAttribute('aria-invalid', 'true'); this.qty.focus(); return; } existing.quantity = D.text(total, 3); }
      else this.lines.push({ presentationId: id, product: option.dataset.product, presentation: option.dataset.presentation, price: option.dataset.price, available: option.dataset.available, quantity: D.text(q, 3) });
      if (this.enhanced) this.enhanced.setValue(null); else this.select.value = ''; this.qty.value = '1'; this.render();
    }
    totalValue() { let total = 0n; for (const row of this.lines) total += D.units(D.multiply(row.quantity, row.price, 2), 2); return D.text(total, 2); }
    render() {
      const rows = this.lines.map(row => ({ ...row, subtotal: D.multiply(row.quantity, row.price, 2) }));
      this.linesTable.setData(rows);
      this.total.replaceChildren(UI.element('span', '', 'Total'), UI.element('strong', '', money(this.totalValue())));
    }
    lineAction(action, record, opener) {
      if (action === 'remove') { this.lines = this.lines.filter(row => row.presentationId !== record.presentationId); this.render(); return; }
      const details = new UI.RecordDetails({ record, fields: [
        { key: 'product', label: 'Producto', wide: true }, { key: 'presentation', label: 'Presentación' },
        { key: 'quantity', label: 'Cantidad', type: 'quantity' }, { key: 'price', label: 'Precio', type: 'price' },
        { key: 'available', label: 'Disponible', type: 'quantity' }, { key: 'subtotal', label: 'Subtotal', type: 'price' }
      ] });
      const modal = new UI.Modal({ title: 'Detalle del producto de la venta', icon: 'cart', content: details.element,
        onClose: () => { modal.destroy(); this.lineDialogs.delete(modal); } });
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.lineDialogs.add(modal); modal.open(opener);
    }
    validate() {
      const errors = {}; if (!this.lines.length) errors.cash = 'Agrega al menos un producto antes de registrar.';
      let cash = 0n, qr = 0n, total = 0n; try { cash = D.units(this.cash.value || '0', 2); qr = D.units(this.qr.value || '0', 2); total = D.units(this.totalValue(), 2); } catch (_) { errors.cash = 'Revisa los importes del pago.'; }
      if (cash < 0n || qr < 0n || cash + qr !== total) errors.cash = 'Efectivo + QR debe ser exactamente igual al total de la venta.';
      if (qr > 0n && !this.receipt.value.trim()) errors.receipt = 'Escribe el comprobante o referencia del QR.'; return errors;
    }
    payload() {
      const payments = []; if (D.units(this.cash.value || '0', 2) > 0n) payments.push({ method: 'EFECTIVO', amount: D.text(D.units(this.cash.value, 2), 2), receipt: '' });
      if (D.units(this.qr.value || '0', 2) > 0n) payments.push({ method: 'QR', amount: D.text(D.units(this.qr.value, 2), 2), receipt: this.receipt.value.trim() });
      return { details: this.lines.map(row => ({ presentationId: row.presentationId, quantity: row.quantity })), payments };
    }
  }
  class SalesPage{
    constructor(host){this.api=new UI.CatalogApi('/api/ventas');this.events=new AbortController();this.notifications=UI.NotificationCenter.shared();this.dialogs=new Set();
      this.table=new UI.DataTable({container:host,caption:'Ventas',mode:'scroll',numbered:true,pageSize:50,load:p=>this.api.list(p),sort:{key:'date',direction:'desc'},actionDisplay:'menu',columns:[{key:'date',label:'Fecha',sortable:true},{key:'cash',label:'Caja',priority:1},{key:'user',label:'Registrado por',sortable:true,priority:2},{key:'total',label:'Total',type:'price',sortable:true},{key:'state',label:'Estado',type:'state',sortable:true,states:{VIGENTE:{label:'Vigente',tone:'success'},ANULADA:{label:'Anulada',tone:'inactive'}}}],actions:[{id:'detail',label:'Ver detalle',icon:'info'},{id:'cancel',label:'Anular venta',icon:'warning',tone:'warning',visible:r=>admin&&r.state==='VIGENTE'}],onAction:item=>this.action(item)});
      this.filters=new UI.FilterBar({container:document.querySelector('[data-module-region="controls"]'),searchInput:document.getElementById('module-search'),mode:'inline',fields:[{name:'state',label:'Estado',type:'select',control:document.getElementById('module-state'),emptyLabel:'Todos los estados',options:[{value:'VIGENTE',label:'Vigentes'},{value:'ANULADA',label:'Anuladas'}]}],onChange:q=>this.table.setQuery(q)});
      document.querySelector('[data-module-primary]').addEventListener('click',e=>this.openForm(e.currentTarget),{signal:this.events.signal});window.addEventListener('pagehide',()=>this.destroy(),{once:true,signal:this.events.signal});}
    track(modal){this.dialogs.add(modal);const close=modal.onClose;modal.onClose=v=>{close(v);this.dialogs.delete(modal);};}
    openForm(opener){const form=new SaleForm({api:this.api,opener,onSaved:async result=>{this.notifications.show('success','Venta N.º '+result.id+' registrada correctamente.');await this.table.refresh();}});this.track(form.modal);}
    async action({action,record,button}){try{const row=await this.api.detail(record.id);if(action==='detail')this.detail(row,button);else this.cancel(row,button);}catch(error){this.notifications.show('error',error.userMessage||'No se pudo completar la operación.');}}
    detail(record,opener){
      const content=UI.element('div','ops-stack'),details=new UI.RecordDetails({record,fields:[{key:'date',label:'Fecha'},{key:'cash',label:'Caja'},{key:'user',label:'Registrado por'},{key:'state',label:'Estado',type:'state'},{key:'total',label:'Total',type:'price'},{key:'cancelledAt',label:'Anulada el',empty:'—'},{key:'cancelledBy',label:'Anulada por',empty:'—'},{key:'cancellationReason',label:'Motivo de anulación',wide:true,empty:'—'}]});
      content.append(details.element);const section=UI.element('section','ops-section'),host=UI.element('div');section.append(host);content.append(section);
      const rows=record.lines.map((line,index)=>({...line,rowId:index+1}));
      const lineTable=new UI.DataTable({container:host,caption:'Productos de la venta',records:rows,getRowId:row=>row.rowId,mode:'scroll',numbered:true,fillHeight:false,pageSize:50,columns:[{key:'product',label:'Producto',format:(_,row)=>row.product+' — '+row.presentation},{key:'quantity',label:'Cantidad',type:'quantity'},{key:'price',label:'Precio',type:'price',priority:1},{key:'subtotal',label:'Subtotal',type:'price'}],actionDisplay:'menu',actions:[{id:'detail',label:'Ver detalle',icon:'info'}],onAction:({record:line,button})=>this.saleLineDetail(line,button)});
      const pay=UI.element('section','ops-section');for(const p of record.payments)pay.append(UI.element('p','',p.method+': '+money(p.amount)+(p.refundReference?' · devolución '+p.refundReference:'')));content.append(pay);
      const modal=new UI.Modal({title:'Venta N.º '+record.id,icon:'cart',size:'large',content,onClose:()=>{lineTable.destroy();modal.destroy();this.dialogs.delete(modal);}}),close=UI.Button.create({label:'Cerrar'});close.addEventListener('click',()=>modal.requestClose(),{signal:modal.events.signal});modal.footer.append(close);this.dialogs.add(modal);modal.open(opener);
    }
    saleLineDetail(record,opener){const details=new UI.RecordDetails({record,fields:[{key:'product',label:'Producto',wide:true},{key:'presentation',label:'Presentación'},{key:'quantity',label:'Cantidad',type:'quantity'},{key:'price',label:'Precio',type:'price'},{key:'subtotal',label:'Subtotal',type:'price'}]});const modal=new UI.Modal({title:'Detalle del producto vendido',icon:'cart',content:details.element,onClose:()=>{modal.destroy();this.dialogs.delete(modal);}}),close=UI.Button.create({label:'Cerrar'});close.addEventListener('click',()=>modal.requestClose(),{signal:modal.events.signal});modal.footer.append(close);this.dialogs.add(modal);modal.open(opener);}
    cancel(record,opener){const form=UI.element('form','app-form');form.id='cancel-sale-'+record.id;const reason=UI.element('textarea','app-input'),reference=UI.element('input','app-input');reason.id='cancel-reason';reason.name='reason';reason.required=true;reason.maxLength=250;reference.id='cancel-ref';reference.name='qrRefundReference';reference.maxLength=255;const hasQr=record.payments.some(p=>p.method==='QR');if(hasQr)reference.required=true;form.append(field('Motivo de la anulación',reason));if(hasQr)form.append(field('Referencia/comprobante de devolución QR',reference));let controller;const modal=new UI.Modal({title:'Anular venta N.º '+record.id,icon:'warning',size:'medium',content:form,isDirty:()=>controller?.isDirty(),onClose:()=>{controller?.destroy();modal.destroy();this.dialogs.delete(modal);}}),back=UI.Button.create({label:'Cancelar'}),confirm=UI.Button.create({label:'Anular venta',variant:'danger',type:'submit'});confirm.setAttribute('form',form.id);back.addEventListener('click',()=>modal.requestClose(),{signal:modal.events.signal});modal.footer.append(back,confirm);controller=new UI.FormController({form,modal,onSubmit:values=>this.api.request('/'+record.id+'/anular',{body:{reason:values.reason,qrRefundReference:values.qrRefundReference||''},key:UI.CatalogApi.newKey()}),onSuccess:async()=>{modal.close();this.notifications.show('success','Venta anulada y devolución registrada.');await this.table.refresh();}});this.dialogs.add(modal);modal.open(opener);}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.events.abort();this.filters.destroy();this.table.destroy();this.notifications.destroy();for(const m of this.dialogs)m.destroy();this.dialogs.clear();}
  }
  const host=document.getElementById('sales-table');if(host)new SalesPage(host);
})();
