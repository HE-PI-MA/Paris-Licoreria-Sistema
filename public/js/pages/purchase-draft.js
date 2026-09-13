/** Borrador de compra: filas y totales exactos en memoria. Agregar, editar y quitar no envían escrituras al servidor. */
(() => {
  'use strict';
  const UI=window.ParisUI;
  class PurchaseDraft {
    constructor(){this.rows=[];this.sequence=0;}
    static decimal(value,scale,name,positive=false){
      if(!new RegExp('^\\d{1,'+(15-scale)+'}(?:\\.\\d{1,'+scale+'})?$').test(String(value)) || (positive && UI.Decimal.units(value,scale)===0n))
        throw new UI.CatalogApiError('Revisa '+name+'. Se admiten hasta '+scale+' decimales.');
      return UI.Decimal.text(UI.Decimal.units(value,scale),scale);
    }
    save(line,display,id){
      if(!id && this.rows.length>=50)throw new UI.CatalogApiError('Una compra admite hasta 50 filas.');
      const row={...display,id:id || ++this.sequence,line:structuredClone(line),quantity:line.quantity,cost:line.cost,subtotal:UI.Decimal.multiply(line.quantity,line.cost,2)};
      const index=this.rows.findIndex(item=>item.id===id);
      if(id && index<0)throw new UI.CatalogApiError('La fila ya no está en el borrador.');
      if(index<0)this.rows.push(row);else this.rows[index]=row;
      return row;
    }
    remove(id){this.rows=this.rows.filter(row=>row.id!==id);}
    payload(){return this.rows.map(row=>structuredClone(row.line));}
    total(){return UI.Decimal.total(this.payload());}
  }
  window.ParisPurchases={PurchaseDraft};
})();
