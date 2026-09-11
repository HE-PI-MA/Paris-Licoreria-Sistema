# Base de datos y roles

## Esquema

MySQL 8; la conexión se realiza con `mysql2/promise` a la base indicada por `DB_NAME`. La instalación de pruebas del usuario utiliza `paris_licoreria`.

V2 define 21 tablas de negocio. U004 agrega `sesion_web` y `app_migration`: 23 tablas del esquema esperado. Este inventario procede del SQL versionado; no sustituye una consulta de la base instalada.

| Área | Tablas principales |
| --- | --- |
| Identidad | `rol`, `usuario` |
| Catálogo | `categoria`, `unidad_medida`, `producto`, `presentacion_producto` |
| Abastecimiento | `proveedor`, `compra`, `detalle_compra` |
| Existencias | `lote_producto`, `ubicacion`, `lote_ubicacion`, `ajuste_inventario` |
| Operación de caja | `sesion_caja`, `venta`, `detalle_venta`, `detalle_venta_lote`, `pago` |
| Arqueo | `denominacion`, `arqueo_caja`, `detalle_arqueo` |
| Infraestructura | `sesion_web`, `app_migration` |

## Permisos actuales de páginas

| Rol | Acceso |
| --- | --- |
| `ADMINISTRADOR` | Los nueve módulos y Mi perfil. |
| `ENCARGADO_VENTA` | Inicio, Ventas, Caja y Mi perfil. |

La fuente de estos permisos es `src/config/navigation.js`. Las rutas de módulos comprueban licencia y usuario activo; las administrativas devuelven 403 al encargado de venta. Las operaciones futuras necesitarán sus propios controles de servidor: por ejemplo, qué caja puede cerrar un usuario y quién puede anular una venta.

Los usuarios reales dependen de cada instalación; la documentación no mantiene una lista de cuentas supuestamente vigente. `usuario.nombre_usuario` es único y el estado permitido es ACTIVO o INACTIVO.

## Contraseñas y sesiones

bcrypt verifica la contraseña. Tras el login se regenera la sesión y se guarda en MySQL. En cada solicitud protegida se vuelve a consultar el usuario y su rol. La respuesta no incluye el hash de contraseña.

Los marcadores de demostración no permiten iniciar sesión. `scripts/create-admin.js` sirve para configurar el administrador inicial y no sustituye cuentas reales existentes. No se modifican automáticamente contraseñas ni se documentan valores privados.

## Operaciones SQL disponibles para conectar después

| Procedimiento | Finalidad |
| --- | --- |
| `sp_registrar_compra` | Compra, detalle y entrada de lotes. |
| `sp_registrar_venta` | Venta, pagos y consumo de existencias. |
| `sp_anular_venta` | Anulación según las restricciones de caja e historial. |
| `sp_registrar_ajuste_inventario` | Salida por daño, pérdida, vencimiento u otro motivo. |
| `sp_cerrar_sesion_caja` | Cierre y arqueo con denominaciones. |

La migración contiene vistas de stock físico/disponible/vencido, stock bajo, vencimientos, compras, ventas, productos vendidos y diferencias de caja. Estas definiciones existen en SQL; la interfaz aún no las consulta.

Las rutinas controlan sus transacciones. Consultar `09_PARCHE_U004.md` antes de modificar SQL o conceder permisos. U007 conserva el archivo de migración y no ejecuta SQL. Los fixtures de `tests/` son para laboratorio y no son una restauración de producción.
