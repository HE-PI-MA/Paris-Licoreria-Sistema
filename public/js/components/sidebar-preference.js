(() => {
  'use strict';
  try {
    if (localStorage.getItem('paris.sidebar.collapsed') === 'true') {
      document.documentElement.dataset.sidebarCollapsed = 'true';
    }
  } catch (_) { /* El menú también funciona sin almacenamiento del navegador. */ }
})();
