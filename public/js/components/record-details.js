/** Información de consulta en bloques: campos configurables, valores seguros, cantidades y estados. No realiza operaciones del negocio. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  class RecordDetails {
    constructor({ record, fields } = {}) {
      if (!record || !Array.isArray(fields)) throw new TypeError('Se necesitan un registro y sus campos.');
      this.element = UI.element('dl', 'app-record-details');
      for (const field of fields) {
        const group = UI.element('div', 'app-record-detail' + (field.wide ? ' app-record-detail--wide' : ''));
        const term = UI.element('dt', '', field.label), value = UI.element('dd');
        const raw = record[field.key];
        if (['number', 'quantity', 'price'].includes(field.type)) {
          value.textContent = UI.ValueFormat.number(raw, { type: field.type });
          value.classList.add('app-record-detail-number');
        } else if (field.type === 'state') {
          const state = raw === 'ACTIVO' ? ['Activo', 'success'] : raw === 'INACTIVO' ? ['Inactivo', 'neutral'] : [String(raw ?? '—'), 'neutral'];
          value.append(UI.element('span', 'app-badge app-badge--' + state[1], state[0]));
        } else value.textContent = raw === null || raw === undefined || raw === '' ? field.empty || '—' : String(raw);
        group.append(term, value); this.element.append(group);
      }
    }
  }
  UI.RecordDetails = RecordDetails;
})();
