/** Presentación de compras y sus filas mediante componentes globales. */
(() => {
  'use strict';
  const UI = window.ParisUI;

  class PurchaseView {
    static columns() {
      return [
        { key: 'product', label: 'Producto' },
        { key: 'quantity', label: 'Cantidad', type: 'quantity' },
        { key: 'subtotal', label: 'Subtotal (Bs)', type: 'price' },
        { key: 'arrival', label: 'Cómo llegó', priority: 1 },
        { key: 'baseQuantity', label: 'Ingresa al stock', type: 'quantity', priority: 1 },
        { key: 'category', label: 'Categoría', priority: 2 },
        { key: 'cost', label: 'Costo (Bs)', type: 'price', priority: 2 }
      ];
    }

    static dialog(title, content, opener, destroy = () => {}) {
      const modal = new UI.Modal({
        title,
        icon: 'bag',
        size: 'large',
        content,
        onClose: () => { destroy(); modal.destroy(); }
      });
      const close = UI.Button.create({ label: 'Cerrar' });
      close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close);
      modal.open(opener);
      return modal;
    }

    static line(record, opener) {
      const details = new UI.RecordDetails({
        record,
        fields: [
          { key: 'product', label: 'Nombre del producto', wide: true },
          { key: 'category', label: 'Categoría' },
          { key: 'arrival', label: 'Cómo llegó' },
          { key: 'quantity', label: 'Cantidad comprada', type: 'quantity' },
          { key: 'factor', label: 'Cuánto trae cada uno', type: 'quantity' },
          { key: 'baseQuantity', label: 'Cantidad que ingresó al stock', type: 'quantity' },
          { key: 'unit', label: 'Unidad base' },
          { key: 'cost', label: 'Costo por cada uno', type: 'price' },
          { key: 'subtotal', label: 'Subtotal', type: 'price' },
          { key: 'lotCode', label: 'Código de lote', empty: '—' },
          { key: 'expiresOn', label: 'Vencimiento', empty: 'Sin fecha' },
          { key: 'location', label: 'Ubicación de ingreso', wide: true }
        ]
      });

      return this.dialog('Detalle del producto comprado', details.element, opener);
    }

    static purchase(record, opener) {
      const content = UI.element('div', 'app-form');
      const details = new UI.RecordDetails({
        record,
        fields: [
          { key: 'date', label: 'Fecha' },
          { key: 'user', label: 'Registrado por' },
          { key: 'total', label: 'Total', type: 'price' }
        ]
      });

      const host = UI.element('div');
      content.append(details.element, host);

      const table = new UI.DataTable({
        container: host,
        caption: 'Productos comprados',
        records: record.lines,
        columns: this.columns(),
        getRowId: row => row.rowId,
        mode: 'scroll',
        numbered: true,
        fillHeight: false,
        pageSize: 50,
        actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }],
        onAction: ({ record, button }) => this.line(record, button)
      });

      return this.dialog('Compra N.º ' + record.id, content, opener, () => table.destroy());
    }
  }

  window.ParisPurchases.PurchaseView = PurchaseView;
})();
