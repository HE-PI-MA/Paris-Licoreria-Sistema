(() => {
  'use strict';

  /** Estado e interacción del menú lateral. Los permisos siguen en el servidor. */
  class Sidebar {
    constructor(element) {
      this.element = element;
      this.root = document.documentElement;
      this.toggle = element.querySelector('[data-sidebar-toggle]');
      this.opener = document.querySelector('[data-sidebar-open]');
      this.backdrop = document.querySelector('[data-sidebar-backdrop]');
      this.workspace = document.querySelector('#paris-workspace');
      this.trigger = document.querySelector('#profile-trigger');
      this.menu = document.querySelector('#profile-menu');
      this.menuItems = Array.from(this.menu.querySelectorAll('[role="menuitem"]'));
      this.tooltip = document.querySelector('#sidebar-tooltip');
      this.media = window.matchMedia('(max-width: 48rem)');
      this.preference = new window.ParisUI.SidebarPreference(this.root);
      this.tooltipTarget = null;
      this.logoutButton = element.querySelector('[data-logout]');
      this.logoutLabel = this.logoutButton.querySelector('[data-logout-label]');
      this.errorBox = document.querySelector('[data-logout-error]');
    }

    init() {
      this.toggle.addEventListener('click', () => this.onToggle());
      this.opener.addEventListener('click', () => this.setMobileOpen(true));
      this.backdrop.addEventListener('click', () => this.setMobileOpen(false, true));
      this.media.addEventListener('change', () => this.onBreakpointChange());
      this.trigger.addEventListener('click', () => this.menu.hidden ? this.openProfile() : this.closeProfile(true));
      this.trigger.addEventListener('keydown', event => this.onProfileKey(event));
      this.menu.addEventListener('keydown', event => this.onMenuKey(event));
      document.addEventListener('click', event => this.dismissProfileOutside(event));
      document.addEventListener('focusin', event => this.dismissProfileOutside(event));
      document.addEventListener('keydown', event => this.onDocumentKey(event));
      this.element.querySelectorAll('[data-sidebar-label]').forEach(link => {
        link.addEventListener('mouseenter', () => this.showTooltip(link));
        link.addEventListener('focus', () => this.showTooltip(link));
        link.addEventListener('mouseleave', () => this.hideTooltip());
        link.addEventListener('blur', () => this.hideTooltip());
      });
      this.element.querySelector('.sidebar-navigation').addEventListener('scroll', () => this.hideTooltip(), { passive: true });
      window.addEventListener('resize', () => this.hideTooltip(), { passive: true });
      this.logoutButton.addEventListener('click', () => this.logout());
      this.setMobileOpen(false);
      this.syncToggle();
    }

    onToggle() {
      if (this.media.matches) return this.setMobileOpen(false, true);
      this.closeProfile();
      this.hideTooltip();
      const collapsed = this.root.dataset.sidebarCollapsed !== 'true';
      this.root.dataset.sidebarCollapsed = String(collapsed);
      this.preference.save(collapsed);
      this.syncToggle();
    }

    syncToggle() {
      const collapsed = this.root.dataset.sidebarCollapsed === 'true';
      this.toggle.setAttribute('aria-label', this.media.matches ? 'Cerrar menú' : collapsed ? 'Ampliar menú' : 'Contraer menú');
      this.toggle.setAttribute('aria-expanded', String(this.media.matches || !collapsed));
    }

    /** El menú móvil bloquea el fondo y devuelve el foco al cerrarse. */
    setMobileOpen(open, restoreFocus = false) {
      this.closeProfile();
      this.hideTooltip();
      this.root.toggleAttribute('data-sidebar-open', open);
      this.opener.setAttribute('aria-expanded', String(open));
      this.backdrop.hidden = !open;
      this.workspace.inert = open;
      this.element.inert = this.media.matches && !open;
      if (open) {
        this.element.setAttribute('role', 'dialog');
        this.element.setAttribute('aria-modal', 'true');
        this.toggle.focus();
      } else {
        this.element.removeAttribute('role');
        this.element.removeAttribute('aria-modal');
        if (restoreFocus) this.opener.focus();
      }
    }

    onBreakpointChange() {
      const active = document.activeElement;
      this.setMobileOpen(false);
      this.syncToggle();
      if (this.media.matches && this.element.contains(active)) this.opener.focus();
      else if (!this.media.matches && active === this.opener) this.toggle.focus();
    }

    closeProfile(restoreFocus = false) {
      this.menu.hidden = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) this.trigger.focus();
    }

    openProfile(last = false) {
      this.hideTooltip();
      this.menu.hidden = false;
      this.trigger.setAttribute('aria-expanded', 'true');
      this.menuItems[last ? this.menuItems.length - 1 : 0].focus();
    }

    dismissProfileOutside(event) {
      if (!this.menu.hidden && !this.menu.contains(event.target) && !this.trigger.contains(event.target)) this.closeProfile();
    }

    onProfileKey(event) {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        this.openProfile(event.key === 'ArrowUp');
      }
    }

    onMenuKey(event) {
      const index = this.menuItems.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.menuItems.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + this.menuItems.length) % this.menuItems.length;
        this.menuItems[next].focus();
      }
      // Tab continúa desde el botón de perfil hacia el siguiente control visible.
      if (event.key === 'Tab') this.closeProfile(true);
    }

    onDocumentKey(event) {
      if (event.key === 'Escape') {
        if (!this.menu.hidden) { event.preventDefault(); this.closeProfile(true); }
        else if (this.root.hasAttribute('data-sidebar-open')) { event.preventDefault(); this.setMobileOpen(false, true); }
        this.hideTooltip();
      }
      if (event.key === 'Tab' && this.root.hasAttribute('data-sidebar-open')) {
        const candidates = Array.from(this.element.querySelectorAll('a[href], button:not(:disabled)'))
          .filter(element => !element.closest('[hidden]'));
        const first = candidates[0], last = candidates[candidates.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }

    hideTooltip() {
      this.tooltip.hidden = true;
      this.tooltipTarget?.removeAttribute('aria-describedby');
      this.tooltipTarget = null;
    }

    showTooltip(link) {
      if (this.media.matches || this.root.dataset.sidebarCollapsed !== 'true') return;
      this.hideTooltip();
      const rect = link.getBoundingClientRect();
      this.tooltip.textContent = link.dataset.sidebarLabel;
      this.tooltip.hidden = false;
      this.tooltip.style.left = `${this.element.getBoundingClientRect().right + 10}px`;
      this.tooltip.style.top = `${Math.max(8, Math.min(rect.top + rect.height / 2 - this.tooltip.offsetHeight / 2, innerHeight - this.tooltip.offsetHeight - 8))}px`;
      link.setAttribute('aria-describedby', 'sidebar-tooltip');
      this.tooltipTarget = link;
    }

    /** Conserva CSRF, evita envíos simultáneos y permite reintentar ante un fallo. */
    async logout() {
      if (this.logoutButton.disabled) return;
      this.logoutButton.disabled = true;
      this.logoutButton.setAttribute('aria-busy', 'true');
      this.logoutLabel.textContent = 'Cerrando sesión…';
      this.errorBox.hidden = true;
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
          body: JSON.stringify({})
        });
        if (!response.ok && response.status !== 401) throw new Error('LOGOUT_FAILED');
        window.location.assign('/login');
      } catch (_) {
        this.errorBox.textContent = 'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo nuevamente.';
        this.errorBox.hidden = false;
        this.logoutButton.disabled = false;
        this.logoutButton.removeAttribute('aria-busy');
        this.logoutLabel.textContent = 'Cerrar sesión';
      }
    }
  }

  const element = document.querySelector('#paris-sidebar');
  if (element) new Sidebar(element).init();
})();
