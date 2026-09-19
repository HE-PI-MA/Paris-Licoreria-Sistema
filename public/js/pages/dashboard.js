/** Inicio U039: indicadores reales del día según el rol autenticado. */
(() => {
  'use strict';
  const UI=window.ParisUI,money=value=>UI.ValueFormat.number(value,{type:'price',locale:'es-BO',currency:'BOB'});
  const card=(label,value,note='')=>{const node=UI.element('article','ops-card');node.append(UI.element('p','ops-card-label',label),UI.element('p','ops-card-value',value));if(note)node.append(UI.element('p','ops-card-note',note));return node;};
  class DashboardPage{
    constructor(host){this.host=host;this.api=new UI.CatalogApi('/api/inicio');this.events=new AbortController();this.notifications=UI.NotificationCenter.shared();this.primary=document.querySelector('[data-module-primary]');this.primary.addEventListener('click',()=>this.load(),{signal:this.events.signal});window.addEventListener('pagehide',()=>this.destroy(),{once:true,signal:this.events.signal});this.load();}
    async load(){if(this.loading)return;this.loading=true;UI.Button.setBusy(this.primary,true,'Actualizando…');this.host.setAttribute('aria-busy','true');try{this.render(await this.api.request('/resumen'));}catch(error){this.host.replaceChildren(card('Sin datos','—',error.userMessage||'No se pudo cargar el resumen.'));}finally{this.loading=false;UI.Button.setBusy(this.primary,false);this.host.setAttribute('aria-busy','false');}}
    render(data){const cards=[card('Ventas de hoy',money(data.salesToday.total),`${data.salesToday.count} ventas vigentes`)];if(data.openCash)cards.push(card('Caja abierta',data.openCash.cash,`${data.openCash.user} · desde ${data.openCash.openedAt} · efectivo esperado ${money(data.openCash.expectedCash)}`));else cards.push(card('Caja','Cerrada','No existe un turno abierto en este momento.'));if(data.stock){cards.push(card('Productos agotados',String(data.stock.empty),`${data.stock.low} con stock bajo`),card('Lotes por vencer',String(data.stock.expiring),'Según el horizonte configurado en inventario.'));}this.host.replaceChildren(...cards);}
    destroy(){this.events.abort();this.notifications.destroy();}
  }
  const host=document.getElementById('dashboard-summary');if(host)new DashboardPage(host);
})();
