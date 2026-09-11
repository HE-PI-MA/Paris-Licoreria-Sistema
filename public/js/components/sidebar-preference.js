(() => {
  'use strict';

  /** Solo guarda la preferencia visual, nunca información de la sesión. */
  class SidebarPreference {
    constructor(root) { this.root = root; }

    restore() {
      try {
        if (localStorage.getItem('paris.sidebar.collapsed') === 'true') {
          this.root.dataset.sidebarCollapsed = 'true';
        }
      } catch (_) { /* El menú funciona aunque el navegador bloquee almacenamiento. */ }
    }

    save(collapsed) {
      try { localStorage.setItem('paris.sidebar.collapsed', String(collapsed)); }
      catch (_) { /* La interacción actual no depende de guardar la preferencia. */ }
    }
  }

  window.ParisUI = window.ParisUI || {};
  window.ParisUI.SidebarPreference = SidebarPreference;
  new SidebarPreference(document.documentElement).restore();
})();
