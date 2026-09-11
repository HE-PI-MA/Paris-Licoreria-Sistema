// Solo presentación. Las rutas y los permisos permanecen en navigation.js.
// Cada módulo tiene su propio archivo de contenido dentro del marco compartido.
const definitions = {
  'demo-componentes': { actionLabel: 'Nuevo registro de prueba', actionIcon: 'plus', contentView: 'demo/components', enabled: true },
  inicio: { actionLabel: 'Actualizar resumen', actionIcon: 'refresh', contentView: 'dashboard/content' },
  ventas: { actionLabel: 'Nueva venta', actionIcon: 'plus', contentView: 'ventas/content' },
  caja: { actionLabel: 'Abrir caja', actionIcon: 'plus', contentView: 'caja/content' },
  productos: { actionLabel: 'Nuevo producto', actionIcon: 'plus', contentView: 'productos/content', enabled: true, filterMode: 'inline-category' },
  inventario: { actionLabel: 'Ver movimientos', actionIcon: 'layers', contentView: 'inventario/content' },
  compras: { actionLabel: 'Nueva compra', actionIcon: 'plus', contentView: 'compras/content' },
  proveedores: { actionLabel: 'Nuevo proveedor', actionIcon: 'plus', contentView: 'proveedores/content' },
  reportes: { actionLabel: 'Generar reporte', actionIcon: 'chart', contentView: 'reportes/content' },
  usuarios: { actionLabel: 'Nuevo usuario', actionIcon: 'plus', contentView: 'usuarios/content' }
};

/** Devuelve la configuración visual o null para perfil y acceso restringido.
 * contentView solo admite las plantillas declaradas aquí. No habilita operaciones.
 */
function forPage(page) {
  if (!Object.hasOwn(definitions, page.id)) return null;
  return {
    ...definitions[page.id],
    id: page.id,
    searchPlaceholder: page.id === 'productos' ? 'Nombre del producto o código de barras…' : `Buscar en ${page.label.toLocaleLowerCase('es')}…`,
    controlsHelp: page.id === 'productos' ? 'El stock se consulta aquí; los movimientos se registran en Compras e Inventario.' : 'Filtra los registros ficticios de esta demostración.',
    message: page.id === 'demo-componentes'
      ? 'Demostración: los cambios usan datos ficticios y se pierden al recargar.'
      : page.id === 'productos' ? 'Los precios se definen en las presentaciones de cada producto.' : 'Los controles se habilitarán cuando este módulo esté disponible.'
  };
}

module.exports = { forPage };
