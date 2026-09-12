# U005 — Sidebar de París Licorería

> Documento histórico. U016 sustituye el control manual y SidebarPreference por adaptación automática. Consultar [Sidebar automático U016](28_SIDEBAR_AUTOMATICO_U016.md) para la implementación vigente.

## Alcance

Se integra el menú lateral aprobado en negro y dorado. La cabecera contiene el logo original y el botón para contraer o ampliar. El cuerpo contiene los módulos. El pie permanece fijo y muestra el usuario autenticado, su rol y las opciones Mi perfil y Cerrar sesión.

La preferencia de menú abierto o contraído se conserva en este navegador. Solo se guarda esa preferencia, sin datos de la sesión. En pantallas de hasta 768 px se utiliza un menú superpuesto con fondo oscurecido. Se cierra con el botón, con Escape o al pulsar fuera del menú.

## Componentes separados

- `views/components/sidebar.ejs`: cabecera, navegación y pie del sidebar.
- `views/components/icon.ejs`: iconos vectoriales locales compartidos.
- `views/layouts/workspace.ejs`: estructura común y contenido a la derecha.
- `public/css/components/sidebar.css`: colores, tamaños, tipografía y adaptación a pantalla.
- `public/js/components/sidebar-preference.js`: recuperación temprana de la preferencia de ancho.
- `public/js/components/sidebar.js`: contraer, ampliar, menú del perfil, ayudas y cierre de sesión.
- `src/config/navigation.js`: definición de módulos y roles autorizados para sus páginas.
- `public/fonts/inter/`: fuente Inter variable y licencia SIL Open Font License.

Los archivos y dependencias del login conservan su implementación anterior. La nueva página de inicio utiliza el layout común. La vista antigua de acceso se retiró en U007; `/inicio` utiliza el layout del espacio de trabajo.

## Navegación

| Rol | Páginas disponibles |
| --- | --- |
| Administrador | Inicio, Ventas, Caja, Productos, Inventario, Compras, Proveedores, Reportes, Usuarios y Mi perfil |
| Encargado de venta | Inicio, Ventas, Caja y Mi perfil |

Estos permisos corresponden a las páginas de navegación de esta entrega. Las operaciones de negocio y sus futuros permisos específicos se implementan al desarrollar cada módulo. Se comprueba el rol en el servidor, además de filtrar los enlaces. Solicitar directamente una página administrativa sin permiso devuelve HTTP 403. Las páginas mantienen la validación de licencia y sesión activa de U004.

## Perfil y módulos

Mi perfil consulta el nombre, apellido, nombre de usuario y rol de la sesión validada. No permite editar datos o cambiar la contraseña en esta entrega. No muestra contraseñas ni sus hashes.

Ventas, Caja, Productos, Inventario, Compras, Proveedores, Reportes y Usuarios abren su espacio con el aviso Módulo en preparación. No se muestran ventas, productos ni cifras de demostración como si fueran registros reales. Los formularios y operaciones de esos módulos todavía están pendientes.

## Logo y tipografía

El menú abierto utiliza `public/img/login/paris-login-logo.webp`. Desde el ajuste U005A, el menú contraído utiliza la imagen independiente `public/img/brand/paris-isologo.png`, proporcionada por el usuario. Se conserva el PNG original completo, con su transparencia y proporciones, y se ajusta con `object-fit: contain`. El botón del menú alterna la imagen visible junto con el ancho del sidebar.

Inter se distribuye localmente, por lo que no requiere Google Fonts ni una conexión externa. Fuente y licencia: https://github.com/rsms/inter. Tamaños principales: 28 px para el título, 16 px para el cuerpo y 15 px para los enlaces del menú. Los nombres largos se ajustan o se truncan en el pie.

## Accesibilidad

- Botones con nombres accesibles y estado expandido.
- Indicador visible de teclado, enlace para saltar al contenido y `aria-current` en el módulo activo.
- Ayudas con los nombres de los módulos en modo contraído.
- Mi perfil y Cerrar sesión se recorren con las flechas del teclado; Escape cierra las opciones.
- El menú móvil limita el foco a sus controles mientras está abierto y devuelve el foco al botón de apertura al cerrarse.
- Se respeta la preferencia de movimiento reducido.

## Instalación y recuperación

El instalador incluido en el ZIP compara los archivos con la versión base del commit `17a1a8e0cb5ea11939bdf15afd988e19683fb811`, admite los saltos de línea de Windows y guarda un respaldo de los archivos afectados fuera del proyecto. Comprueba que el servidor esté detenido y ejecuta las pruebas de aplicación después de instalar. Si estas fallan, intenta restaurar los archivos previos.

No ejecuta SQL ni migraciones. No modifica `.env`, contraseñas, licencia, activación o datos del negocio. No hace commits ni sube cambios a GitHub.

Comprobación: `node aplicar-parche.js --proyecto RUTA --comprobar`

Instalación: `node aplicar-parche.js --proyecto RUTA`

Recuperación: `node aplicar-parche.js --restaurar RUTA_DEL_RESPALDO`

## Validación realizada

Pruebas automáticas de la aplicación: renderizado de las páginas, perfil real y texto escapado, recursos locales, permisos de ambos roles, rutas sin sesión, usuario inactivo, licencia, cierre de sesión y controles de U004. Las pruebas usan dobles de base de datos; no se ejecuta la prueba que exige un MySQL real.

La revisión visual final y la interacción en el navegador de Windows se comprueban después de instalar. El parche no contiene un modo de acceso que evite la licencia o el inicio de sesión.
