// Solo presentación. Las rutas y los permisos permanecen en navigation.js.
// Cada módulo tiene su propio archivo de contenido dentro del marco compartido.
const definitions = {
  'demo-componentes': { actionLabel: 'Nuevo registro de prueba', actionIcon: 'plus', contentView: 'demo/components', enabled: true },
  inicio: { actionLabel: 'Actualizar resumen', actionIcon: 'refresh', contentView: 'dashboard/content', enabled: true, hideControls: true },
  ventas: { actionLabel: 'Nueva venta', actionIcon: 'plus', contentView: 'ventas/content', enabled: true, filterMode: 'inline-state', contentVariant: 'listing' },
  caja: { actionLabel: 'Abrir caja', actionIcon: 'plus', contentView: 'caja/content', enabled: true, hideControls: true },
  productos: { actionLabel: 'Nuevo producto', actionIcon: 'plus', contentView: 'productos/content', enabled: true, filterMode: 'inline-category', contentVariant: 'listing' },
  inventario: { actionLabel: 'Ver movimientos', actionIcon: 'refresh', contentView: 'inventario/content', enabled: true, filterMode: 'inline-category', contentVariant: 'listing' },
  compras: { actionLabel: 'Nueva compra', actionIcon: 'plus', contentView: 'compras/content', enabled: true, filterMode: 'search-only', contentVariant: 'listing' },
  proveedores: { actionLabel: 'Nuevo proveedor', actionIcon: 'plus', contentView: 'proveedores/content', enabled: true, filterMode: 'inline-state', contentVariant: 'listing' },
  reportes: { actionLabel: 'Actualizar reporte', actionIcon: 'refresh', contentView: 'reportes/content', enabled: true, hideControls: true },
  usuarios: { actionLabel: 'Nuevo usuario', actionIcon: 'plus', contentView: 'usuarios/content', enabled: true, filterMode: 'inline-state', contentVariant: 'listing' }
};

/** Devuelve la configuración visual o null para perfil y acceso restringido.
 * contentView solo admite las plantillas declaradas aquí. No habilita operaciones.
 */
function forPage(page) {
  if (!Object.hasOwn(definitions, page.id)) return null;
  return {
    ...definitions[page.id],
    id: page.id,
    searchPlaceholder: page.id === 'inventario' ? 'Ej.: Coca-Cola o maní…' : page.id === 'compras' ? 'Proveedor o número de compra…' : page.id === 'productos' ? 'Nombre del producto o código de barras…' : page.id === 'proveedores' ? 'Nombre, contacto, teléfono o NIT…' : `Buscar en ${page.label.toLocaleLowerCase('es')}…`,
    controlsHelp: page.id === 'productos' ? 'El stock se consulta aquí; los movimientos se registran en Compras e Inventario.' : 'Filtra los registros ficticios de esta demostración.',
    message: page.id === 'demo-componentes'
      ? 'Demostración: los cambios usan datos ficticios y se pierden al recargar.'
      : ['productos', 'proveedores', 'compras', 'inventario', 'inicio', 'ventas', 'caja', 'reportes', 'usuarios'].includes(page.id) ? '' : 'Los controles se habilitarán cuando este módulo esté disponible.'
  };
}

module.exports = { forPage };
