(() => {
  'use strict';
  const root = document.documentElement;
  const sidebar = document.querySelector('#paris-sidebar');
  if (!sidebar) return;
  const toggle = sidebar.querySelector('[data-sidebar-toggle]');
  const opener = document.querySelector('[data-sidebar-open]');
  const backdrop = document.querySelector('[data-sidebar-backdrop]');
  const workspace = document.querySelector('#paris-workspace');
  const trigger = document.querySelector('#profile-trigger');
  const menu = document.querySelector('#profile-menu');
  const menuItems = Array.from(menu.querySelectorAll('[role="menuitem"]'));
  const tooltip = document.querySelector('#sidebar-tooltip');
  const media = window.matchMedia('(max-width: 48rem)');
  let tooltipTarget = null;

  function hideTooltip() {
    tooltip.hidden = true;
    tooltipTarget?.removeAttribute('aria-describedby');
    tooltipTarget = null;
  }
  function closeProfile(restoreFocus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
  function openProfile(last = false) {
    hideTooltip();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    menuItems[last ? menuItems.length - 1 : 0].focus();
  }
  function syncToggle() {
    const collapsed = root.dataset.sidebarCollapsed === 'true';
    toggle.setAttribute('aria-label', media.matches ? 'Cerrar menú' : collapsed ? 'Ampliar menú' : 'Contraer menú');
    toggle.setAttribute('aria-expanded', String(media.matches || !collapsed));
  }
  /** El drawer bloquea el contenido de fondo y devuelve el foco al cerrarse. */
  function setMobileOpen(open, restoreFocus = false) {
    closeProfile();
    hideTooltip();
    root.toggleAttribute('data-sidebar-open', open);
    opener.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    workspace.inert = open;
    sidebar.inert = media.matches && !open;
    if (open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      toggle.focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (restoreFocus) opener.focus();
    }
  }

  // Solo se conserva la preferencia visual; las credenciales nunca van a localStorage.
  toggle.addEventListener('click', () => {
    if (media.matches) return setMobileOpen(false, true);
    closeProfile();
    hideTooltip();
    const collapsed = root.dataset.sidebarCollapsed !== 'true';
    root.dataset.sidebarCollapsed = String(collapsed);
    try { localStorage.setItem('paris.sidebar.collapsed', String(collapsed)); } catch (_) {}
    syncToggle();
  });
  opener.addEventListener('click', () => setMobileOpen(true));
  backdrop.addEventListener('click', () => setMobileOpen(false, true));
  media.addEventListener('change', () => {
    const active = document.activeElement;
    setMobileOpen(false);
    syncToggle();
    if (media.matches && sidebar.contains(active)) opener.focus();
    else if (!media.matches && active === opener) toggle.focus();
  });
  trigger.addEventListener('click', () => menu.hidden ? openProfile() : closeProfile(true));
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openProfile(event.key === 'ArrowUp');
    }
  });
  menu.addEventListener('keydown', event => {
    const index = menuItems.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuItems.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + menuItems.length) % menuItems.length;
      menuItems[next].focus();
    }
    if (event.key === 'Tab') {
      closeProfile(true);
      // Tab continúa desde el botón de perfil hacia el siguiente control visible.
    }
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) closeProfile();
  });
  document.addEventListener('focusin', event => {
    if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) closeProfile();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!menu.hidden) { event.preventDefault(); closeProfile(true); }
      else if (root.hasAttribute('data-sidebar-open')) { event.preventDefault(); setMobileOpen(false, true); }
      hideTooltip();
    }
    if (event.key === 'Tab' && root.hasAttribute('data-sidebar-open')) {
      const candidates = Array.from(sidebar.querySelectorAll('a[href], button:not(:disabled)'))
        .filter(element => !element.closest('[hidden]'));
      const first = candidates[0], last = candidates[candidates.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  sidebar.querySelectorAll('[data-sidebar-label]').forEach(link => {
    const show = () => {
      if (media.matches || root.dataset.sidebarCollapsed !== 'true') return;
      hideTooltip();
      const rect = link.getBoundingClientRect();
      tooltip.textContent = link.dataset.sidebarLabel;
      tooltip.hidden = false;
      tooltip.style.left = `${sidebar.getBoundingClientRect().right + 10}px`;
      tooltip.style.top = `${Math.max(8, Math.min(rect.top + rect.height / 2 - tooltip.offsetHeight / 2, innerHeight - tooltip.offsetHeight - 8))}px`;
      link.setAttribute('aria-describedby', 'sidebar-tooltip');
      tooltipTarget = link;
    };
    link.addEventListener('mouseenter', show);
    link.addEventListener('focus', show);
    link.addEventListener('mouseleave', hideTooltip);
    link.addEventListener('blur', hideTooltip);
  });
  sidebar.querySelector('.sidebar-navigation').addEventListener('scroll', hideTooltip, { passive: true });
  window.addEventListener('resize', hideTooltip, { passive: true });

  const logout = sidebar.querySelector('[data-logout]');
  const logoutLabel = logout.querySelector('[data-logout-label]');
  const errorBox = document.querySelector('[data-logout-error]');
  logout.addEventListener('click', async () => {
    if (logout.disabled) return;
    logout.disabled = true;
    logout.setAttribute('aria-busy', 'true');
    logoutLabel.textContent = 'Cerrando sesión…';
    errorBox.hidden = true;
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
        body: JSON.stringify({})
      });
      if (!response.ok && response.status !== 401) throw new Error('LOGOUT_FAILED');
      window.location.assign('/login');
    } catch (_) {
      errorBox.textContent = 'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo nuevamente.';
      errorBox.hidden = false;
      logout.disabled = false;
      logout.removeAttribute('aria-busy');
      logoutLabel.textContent = 'Cerrar sesión';
    }
  });
  setMobileOpen(false);
  syncToggle();
})();
