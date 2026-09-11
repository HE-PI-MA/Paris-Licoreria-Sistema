/** Catálogo de navegación y roles permitidos: lo comparten el sidebar y la autorización de las páginas. */
const ALL_ROLES = ['ADMINISTRADOR', 'ENCARGADO_VENTA'];
const ADMIN = ['ADMINISTRADOR'];

// Una definición compartida para los enlaces y los permisos de sus páginas.
const groups = [
  { label: 'Principal', items: [
    { id: 'inicio', label: 'Inicio', href: '/inicio', icon: 'home', roles: ALL_ROLES },
    { id: 'ventas', label: 'Ventas', href: '/ventas', icon: 'cart', roles: ALL_ROLES },
    { id: 'caja', label: 'Caja', href: '/caja', icon: 'cash', roles: ALL_ROLES }
  ] },
  { label: 'Gestión', items: [
    { id: 'productos', label: 'Productos', href: '/productos', icon: 'box', roles: ADMIN },
    { id: 'inventario', label: 'Inventario', href: '/inventario', icon: 'layers', roles: ADMIN },
    { id: 'compras', label: 'Compras', href: '/compras', icon: 'bag', roles: ADMIN },
    { id: 'proveedores', label: 'Proveedores', href: '/proveedores', icon: 'truck', roles: ADMIN }
  ] },
  { label: 'Administración', items: [
    { id: 'reportes', label: 'Reportes', href: '/reportes', icon: 'chart', roles: ADMIN },
    { id: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: 'users', roles: ADMIN }
  ] }
];

const modules = groups.flatMap(group => group.items);
const normalizeRole = role => String(role || '').trim().toUpperCase();
/** La misma regla filtra el menú y autoriza la URL solicitada directamente. */
const allowed = (item, role) => item.roles.includes(normalizeRole(role));
// Crear copias evita modificar el menú de otros usuarios al filtrar por rol.
const forUser = role => groups
  .map(group => ({ ...group, items: group.items.filter(item => allowed(item, role)) }))
  .filter(group => group.items.length);
const roleLabel = role => ({ ADMINISTRADOR: 'Administrador', ENCARGADO_VENTA: 'Encargado de venta' })[normalizeRole(role)] || 'Usuario';

module.exports = { modules, allowed, forUser, roleLabel };
