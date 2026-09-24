/** Caja U039: apertura de una sola caja activa, arqueo por denominación e historial. */
(() => {
  'use strict';
  const UI = window.ParisUI;
  const money = value => UI.ValueFormat.number(value, { type: 'price', locale: 'es-BO', currency: 'BOB' });
  const field = (label, input, help = '') => {
    const host = UI.element('div', 'app-field'), caption = UI.element('label', 'app-label', label);
    caption.htmlFor = input.id; host.append(caption, input);
    if (help) host.append(UI.element('p', 'app-field-help', help));
    return host;
  };
  class CashPage {
    constructor(statusHost, historyHost) {
      this.api = new UI.CatalogApi('/api/caja'); this.statusHost = statusHost; this.events = new AbortController();
      this.notifications = UI.NotificationCenter.shared(); this.dialogs = new Set(); this.primary = document.querySelector('[data-module-primary]');
      this.table = new UI.DataTable({ container: historyHost, caption: 'Historial de caja', mode: 'scroll', numbered: true, pageSize: 50,
        load: params => this.api.list(params), sort: { key: 'date', direction: 'desc' }, columns: [
          { key: 'openedAt', label: 'Apertura' }, { key: 'cash', label: 'Caja', sortable: true },
          { key: 'user', label: 'Responsable', sortable: true, priority: 1 }, { key: 'initialAmount', label: 'Inicial', type: 'price', priority: 2 },
          { key: 'state', label: 'Estado', type: 'state', sortable: true, states: { ABIERTA: { label: 'Abierta', tone: 'success' }, CERRADA: { label: 'Cerrada', tone: 'inactive' } } },
          { key: 'closedAt', label: 'Cierre', priority: 2 }
        ], actionDisplay: 'menu', actions: [{ id: 'detail', label: 'Ver detalle', icon: 'info' }],
        onAction: ({ record, button }) => this.detail(record, button) });
      this.primary.addEventListener('click', event => this.primaryAction(event.currentTarget), { signal: this.events.signal });
      window.addEventListener('pagehide', () => this.destroy(), { once: true, signal: this.events.signal });
      this.refreshStatus();
    }
    detail(record, opener) {
      const view = { ...record, stateLabel: record.state === 'ABIERTA' ? 'Abierta' : record.state === 'CERRADA' ? 'Cerrada' : record.state };
      const details = new UI.RecordDetails({ record: view, fields: [
        { key: 'cash', label: 'Caja' }, { key: 'user', label: 'Responsable', wide: true },
        { key: 'openedAt', label: 'Apertura' }, { key: 'initialAmount', label: 'Monto inicial', type: 'price' },
        { key: 'stateLabel', label: 'Estado' }, { key: 'closedAt', label: 'Cierre', empty: 'Turno todavía abierto' }
      ] });
      const modal = new UI.Modal({ title: 'Detalle del turno de caja', icon: 'cash', content: details.element,
        onClose: () => { modal.destroy(); this.dialogs.delete(modal); } });
      const close = UI.Button.create({ label: 'Cerrar' }); close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
      modal.footer.append(close); this.dialogs.add(modal); modal.open(opener);
    }
    async refreshStatus() {
      this.statusHost.setAttribute('aria-busy', 'true');
      try { this.status = await this.api.request('/estado'); this.renderStatus(); }
      catch (error) { this.statusHost.replaceChildren(UI.element('p', '', error.userMessage || 'No se pudo consultar el estado de caja.')); this.primary.disabled = true; }
      finally { this.statusHost.setAttribute('aria-busy', 'false'); }
    }
    renderStatus() {
      const { open, mine } = this.status;
      this.statusHost.replaceChildren();
      const main = UI.element('div', 'ops-status-main');
      if (!open) {
        main.append(UI.element('h3', '', 'No hay caja abierta'), UI.element('p', '', 'Puedes iniciar un turno en Caja 1 o Caja 2. Solo puede existir un turno abierto a la vez.'));
        this.primary.disabled = false; this.setPrimary('Abrir caja', 'plus');
      } else if (mine) {
        main.append(UI.element('h3', '', `${mine.cash} abierta por ti`), UI.element('p', '', `Turno iniciado ${mine.openedAt}.`));
        this.primary.disabled = false; this.setPrimary('Cerrar caja', 'lock');
      } else {
        main.append(UI.element('h3', '', `${open.cash} está ocupada`), UI.element('p', '', `${open.user} tiene el turno abierto desde ${open.openedAt}. Debe cerrarlo antes de abrir otro.`));
        this.primary.disabled = true; this.setPrimary('Abrir caja', 'plus');
      }
      this.statusHost.append(main);
      if (open) {
        const metrics = UI.element('div', 'ops-status-metrics');
        for (const [label, value] of [['Monto inicial', money(open.initialAmount)], ['Efectivo esperado', money(open.expectedCash)], ['Ventas vigentes', open.salesCount ?? '0'], ['Total ventas', money(open.salesTotal)]]) {
          const item = UI.element('div', 'ops-status-metric'); item.append(UI.element('span', '', label), UI.element('strong', '', value)); metrics.append(item);
        }
        this.statusHost.append(metrics);
      }
    }
    setPrimary(label, icon) {
      const span = this.primary.querySelector('span'); if (span) span.textContent = label;
      const old = this.primary.querySelector('svg'); const fresh = UI.Icon.create(icon); if (fresh && old) old.replaceWith(fresh);
    }
    primaryAction(opener) { if (this.status?.mine) this.closeForm(opener); else if (!this.status?.open) this.openForm(opener); }
    track(modal) { this.dialogs.add(modal); const close = modal.onClose; modal.onClose = value => { close(value); this.dialogs.delete(modal); }; }
    openForm(opener) {
      const form = UI.element('form', 'app-form'); form.id = 'cash-open-form'; const grid = UI.element('div', 'app-form-grid'); form.append(grid);
      const cash = UI.element('select', 'app-input'); cash.id = 'cash-id'; cash.name = 'cashId'; cash.required = true;
      cash.append(Object.assign(UI.element('option', '', 'Selecciona una caja'), { value: '' }));
      for (const box of this.status.boxes.filter(item => item.state === 'ACTIVA')) { const option = UI.element('option', '', box.name); option.value = box.id; cash.append(option); }
      const amount = UI.element('input', 'app-input'); amount.id = 'cash-initial'; amount.name = 'initialAmount'; amount.type = 'number'; amount.min = '0'; amount.step = '.01'; amount.value = '0'; amount.required = true;
      const observation = UI.element('textarea', 'app-input'); observation.id = 'cash-open-observation'; observation.name = 'observation'; observation.maxLength = 250; observation.rows = 3;
      grid.append(field('Caja física', cash), field('Monto inicial (Bs)', amount), field('Observación', observation));
      const selector = new UI.SearchSelect({ select: cash, searchable: false }); let controller;
      const modal = new UI.Modal({ title: 'Abrir turno de caja', icon: 'cash', size: 'medium', content: form, isDirty: () => controller?.isDirty(), onClose: () => { controller?.destroy(); selector.destroy(); modal.destroy(); this.dialogs.delete(modal); } });
      const cancel = UI.Button.create({ label: 'Cancelar' }), save = UI.Button.create({ label: 'Abrir caja', icon: 'success', variant: 'primary', type: 'submit' }); save.setAttribute('form', form.id);
      cancel.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal }); modal.footer.append(cancel, save);
      const send = this.api.operation('/abrir'); controller = new UI.FormController({ form, modal, onSubmit: (values, options) => send({ cashId: values.cashId, initialAmount: values.initialAmount, observation: values.observation }, options), onSuccess: async () => { modal.close(); this.notifications.show('success', 'Turno de caja abierto correctamente.'); await Promise.all([this.refreshStatus(), this.table.refresh()]); } });
      this.dialogs.add(modal); modal.open(opener); selector.input.focus();
    }
    async closeForm(opener) {
      let denominations;
      try { denominations = await this.api.request('/denominaciones'); } catch (error) { this.notifications.show('error', error.userMessage || 'No se pudieron cargar las denominaciones.'); return; }
      const form = UI.element('form', 'app-form'); form.id = 'cash-close-form'; const intro = UI.element('p', 'app-field-help', `Cuenta el efectivo físico de ${this.status.mine.cash}. El sistema comparará el conteo con el efectivo esperado.`); form.append(intro);
      const grid = UI.element('div', 'ops-count-grid'); const inputs = [];
      for (const item of denominations) { const input = UI.element('input', 'app-input'); input.type = 'number'; input.min = '0'; input.step = '1'; input.value = '0'; input.inputMode = 'numeric'; input.id = `den-${item.id}`; input.dataset.denominationId = item.id; input.dataset.value = item.value; input.required = true; grid.append(field(`${money(item.value)} · cantidad`, input)); inputs.push(input); }
      form.append(grid); const total = UI.element('p', 'ops-count-total', 'Efectivo contado: ' + money(0)); form.append(total);
      const observation = UI.element('textarea', 'app-input'); observation.id = 'cash-close-observation'; observation.name = 'observation'; observation.maxLength = 250; observation.rows = 3; form.append(field('Observación del cierre', observation));
      const compute = () => { const sum = inputs.reduce((value, input) => value + Number(input.dataset.value) * Number(input.value || 0), 0); total.textContent = 'Efectivo contado: ' + money(sum); };
      inputs.forEach(input => input.addEventListener('input', compute)); let controller;
      const modal = new UI.Modal({ title: 'Cerrar turno de caja', icon: 'cash', size: 'large', content: form, isDirty: () => controller?.isDirty(), onClose: () => { controller?.destroy(); modal.destroy(); this.dialogs.delete(modal); } });
      const cancel = UI.Button.create({ label: 'Cancelar' }), save = UI.Button.create({ label: 'Cerrar caja', icon: 'success', variant: 'primary', type: 'submit' }); save.setAttribute('form', form.id);
      cancel.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal }); modal.footer.append(cancel, save);
      const send = this.api.operation('/cerrar'); controller = new UI.FormController({ form, modal, onSubmit: (values, options) => send({ observation: values.observation, count: inputs.map(input => ({ denominationId: Number(input.dataset.denominationId), quantity: Number(input.value || 0) })) }, options), onSuccess: async result => { modal.close(); const difference = Number(result.difference || 0); this.notifications.show(difference === 0 ? 'success' : 'warning', `Caja cerrada. Contado ${money(result.countedCash)} · esperado ${money(result.expectedCash)} · diferencia ${money(result.difference)}.`); await Promise.all([this.refreshStatus(), this.table.refresh()]); } });
      this.dialogs.add(modal); modal.open(opener); inputs[0]?.focus();
    }
    destroy() { if (this.destroyed) return; this.destroyed = true; this.events.abort(); this.table.destroy(); this.notifications.destroy(); for (const modal of this.dialogs) modal.destroy(); this.dialogs.clear(); }
  }
  const status = document.getElementById('cash-status'), history = document.getElementById('cash-history'); if (status && history) new CashPage(status, history);
})();
