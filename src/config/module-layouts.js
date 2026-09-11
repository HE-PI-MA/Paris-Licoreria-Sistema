// Solo presentación. Las rutas y los permisos permanecen en navigation.js.
// Cada módulo tiene su propio archivo de contenido dentro del marco compartido.
const definitions = {
  'demo-componentes': { actionLabel: 'Nuevo registro de prueba', actionIcon: 'plus', contentView: 'demo/components', enabled: true },
  inicio: { actionLabel: 'Actualizar resumen', actionIcon: 'refresh', contentView: 'dashboard/content' },
  ventas: { actionLabel: 'Nueva venta', actionIcon: 'plus', contentView: 'ventas/content' },
  caja: { actionLabel: 'Abrir caja', actionIcon: 'plus', contentView: 'caja/content' },
  productos: { actionLabel: 'Nuevo producto', actionIcon: 'plus', contentView: 'productos/content' },
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
    searchPlaceholder: `Buscar en ${page.label.toLocaleLowerCase('es')}…`,
    message: page.id === 'demo-componentes'
      ? 'Demostración: los cambios usan datos ficticios y se pierden al recargar.'
      : 'Los controles se habilitarán cuando este módulo esté disponible.'
  };
}

module.exports = { forPage };
