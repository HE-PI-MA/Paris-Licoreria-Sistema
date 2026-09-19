# Arquitectura del sistema

Estado vigente: **U039**. París Licorería es una aplicación web local/servidor construida con Node.js, Express, EJS y MySQL 8. El servidor conserva la activación de equipo y las protecciones existentes; U039 completa el núcleo operativo sin rehacer los módulos estables.

> Los documentos U001–U038 describen la evolución histórica. Para el estado actual del núcleo operativo prevalecen este documento, `README.md` y `52_NUCLEO_OPERATIVO_U039.md`.

## Recorrido de una petición

1. `server.js` carga la configuración, comprueba MySQL y valida que estén instaladas las migraciones obligatorias hasta U039.
2. `src/app.js` configura seguridad HTTP, límites, JSON, sesiones MySQL, CSRF, dependencias y rutas.
3. Las rutas aplican licencia, sesión activa y rol. Las API administrativas vuelven a comprobar el rol en servidor.
4. El controlador traduce HTTP; el servicio aplica reglas de negocio y validaciones; el repositorio realiza consultas o llama procedimientos SQL.
5. MySQL conserva las transacciones, trazabilidad de lotes, caja, pagos y auditoría.
6. EJS genera el marco de la pantalla y el JavaScript del módulo consume su API.

Las escrituras de API usan POST JSON y token CSRF. Ocultar un botón nunca sustituye la autorización del servidor.

## Capas y directorios

| Ubicación | Responsabilidad vigente |
| --- | --- |
| `src/config/` | Conexión, ejecución, navegación, layouts y validación del esquema. |
| `src/routes/` | Rutas web/API y controles de acceso. |
| `src/controllers/` | Adaptación HTTP y respuestas seguras. |
| `src/services/` | Reglas de autenticación, licencia y módulos de negocio. |
| `src/repositories/` | SQL parametrizado, transacciones y procedimientos. |
| `src/domain/` | Validación y contratos de entrada. |
| `src/middleware/` | Sesión, licencia, roles, CSRF y límites. |
| `src/core/` | Licencia, caché EJS y utilidades del núcleo. |
| `views/` | Layout, componentes y cuerpos de módulos. |
| `public/` | CSS, componentes JS y controladores de páginas. |
| `database/bootstrap/` | Esquema V2 oficial para una instalación nueva. |
| `database/migrations/` | Evolución versionada, incluido U039. |
| `scripts/` | Instalación, migraciones, mantenimiento y administrador inicial. |
| `tests/` | Regresiones unitarias/contractuales y pruebas opcionales con MySQL. |

## Módulos conectados

- **Inicio:** resumen real del día y estado de caja; administración añade alertas de inventario.
- **Ventas:** alta transaccional, pagos EFECTIVO/QR, FEFO, historial, detalle e idempotencia; anulación solo administrativa.
- **Caja:** Caja 1/Caja 2, un turno abierto global, monto inicial, conteo por denominación, cierre y diferencia.
- **Productos, Proveedores, Compras e Inventario:** conservan las implementaciones existentes U012/U023/U029/U030/U031–U038.
- **Reportes:** ventas, compras, inventario, productos vendidos y cierres por período.
- **Usuarios:** alta/edición de cuentas, roles, estados y cambio controlado de contraseña.

## Reglas estructurales U039

`caja` representa las dos cajas físicas. `sesion_caja.id_caja` identifica la caja utilizada por los turnos nuevos. Las sesiones históricas cerradas anteriores a U039 pueden conservar `id_caja = NULL` y se muestran como **Caja histórica**; no se inventa información retroactiva.

Ventas consumen inventario por **FEFO**: primero vencimiento más cercano; los lotes sin vencimiento se usan después de los lotes con fecha válida. Si dos lotes empatan, el orden continúa por fecha de compra y sus identificadores para ser determinista.

La anulación restaura exactamente los lotes consumidos, registra quién/cuándo anuló y genera `devolucion_pago`. Un pago QR requiere referencia de devolución. Ventas y devoluciones confirmadas quedan protegidas como historial.

## Seguridad y consistencia

Las contraseñas usan bcrypt; la sesión se regenera al iniciar sesión y se guarda en MySQL. Cada petición protegida revalida el usuario. Las consultas variables de orden usan listas permitidas y las entradas se parametrizan.

Caja, Ventas, Usuarios, Reportes e Inicio tienen autorización propia de API. `ADMINISTRADOR` puede administrar todos los módulos; `ENCARGADO_VENTA` usa Inicio, Ventas y Caja y solo ve las ventas/turnos permitidos por sus reglas.

`Database.assertSchema()` ya no comprueba solamente U004: exige U004, U012, U023, U030, U031 y U039, además de los objetos esenciales que utilizan los módulos activos.

## Instalación y actualización

Para una base existente se usa `npm run db:core` con una cuenta MySQL de instalación. U039 es aditiva y no reconstruye operaciones históricas. Para una base completamente nueva existe `npm run db:install`, que usa `database/bootstrap/` y luego aplica las preparaciones hasta U039.

Ver `docs/52_NUCLEO_OPERATIVO_U039.md` antes de desplegar.
