# U006 — Estructura común de los módulos

## Objetivo

Se prepara el cuerpo de todos los módulos del menú con cuatro áreas compartidas. La información y las operaciones particulares se desarrollan después, módulo por módulo.

1. Cabecera: nombre del módulo y espacio para su acción principal.
2. Controles: buscador y filtros.
3. Contenido: área para las futuras tablas, formularios o resúmenes.
4. Mensajes: información, carga, confirmación, advertencia, error o registros vacíos.

Esta estructura se aplica a Inicio, Ventas, Caja, Productos, Inventario, Compras, Proveedores, Reportes y Usuarios. Mi perfil conserva su consulta de datos actual. La página de acceso restringido conserva su aviso de permisos.

## Estado de esta entrega

La cabecera utiliza el título real del módulo y una etiqueta de acción acorde con su finalidad. Los botones, buscadores y filtros están desactivados, con el aviso Disponible próximamente. No se realizan consultas ni se guardan registros desde estos controles.

El contenido de Inicio conserva el saludo del usuario. Los demás módulos muestran Módulo en preparación. No se presentan datos simulados como registros reales.

Los mensajes de carga y error quedan disponibles para los futuros scripts de cada módulo. No se muestran errores o cargas simuladas al abrir la página.

## Archivos compartidos

| Archivo | Función |
| --- | --- |
| `src/config/module-layouts.js` | Define la presentación de cada módulo y su archivo de contenido. |
| `views/layouts/workspace.ejs` | Integra el sidebar y las cuatro áreas en orden. |
| `views/components/module/header.ejs` | Cabecera y acción principal. |
| `views/components/module/controls.ejs` | Buscador y filtros. |
| `views/components/module/placeholder.ejs` | Estado de contenido pendiente. |
| `views/components/module/messages.ejs` | Área de mensajes y anuncios accesibles. |
| `public/css/components/module-layout.css` | Diseño compartido y adaptación al ancho disponible. |
| `public/js/components/module-layout.js` | Funciones reutilizables para mostrar o limpiar mensajes. |

El contenedor de Contenido está en el layout y carga un archivo independiente para cada módulo. Así se puede desarrollar una sección conservando el marco común.

## Contenido por módulo

| Módulo | Archivo de contenido | Acción preparada |
| --- | --- | --- |
| Inicio | `views/dashboard/content.ejs` | Actualizar resumen |
| Ventas | `views/ventas/content.ejs` | Nueva venta |
| Caja | `views/caja/content.ejs` | Abrir caja |
| Productos | `views/productos/content.ejs` | Nuevo producto |
| Inventario | `views/inventario/content.ejs` | Ver movimientos |
| Compras | `views/compras/content.ejs` | Nueva compra |
| Proveedores | `views/proveedores/content.ejs` | Nuevo proveedor |
| Reportes | `views/reportes/content.ejs` | Generar reporte |
| Usuarios | `views/usuarios/content.ejs` | Nuevo usuario |

Las etiquetas de acción forman parte de la estructura visual; no equivalen a funciones implementadas. Los controles específicos se ajustan al desarrollar cada módulo. La autorización de las operaciones futuras se implementa en sus rutas del servidor.

## Uso de mensajes al desarrollar cada módulo

La página expone `window.ParisModule` únicamente dentro de un módulo. Métodos disponibles:

```javascript
ParisModule.showMessage('loading', 'Cargando productos…');
ParisModule.showMessage('success', 'Producto guardado.');
ParisModule.showMessage('warning', 'Revisa los datos.');
ParisModule.showMessage('error', 'No se pudo guardar. Inténtalo nuevamente.');
ParisModule.showMessage('empty', 'No hay productos para mostrar.');
ParisModule.showMessage('info', 'Selecciona una opción.');
ParisModule.clearMessage();
ParisModule.resetMessage();
```

Estos ejemplos se incluyen para el desarrollo posterior; no se ejecutan como simulaciones. El estado loading activa `aria-busy` en el contenido. Los demás estados lo desactivan. El texto se asigna con `textContent`, sin interpretar HTML. Los errores usan una región de alerta separada y los demás mensajes una región de estado. Se respeta la preferencia de movimiento reducido.

## Conservación de la versión anterior

El sidebar U005 y la imagen independiente U005A permanecen iguales. Se conservan el perfil, el inicio y cierre de sesión, los permisos y la activación. No se modifican la base de datos, la configuración o los archivos de licencia.

## Instalación

El paquete U006 requiere U005 y U005A. El instalador verifica los archivos antes de cambiarlos, guarda una copia fuera del proyecto y ejecuta las pruebas de aplicación con datos simulados. No hace commits ni sube cambios a GitHub.

Con el servidor detenido: `node aplicar-parche.js --proyecto RUTA`.

Para recuperar los archivos anteriores, también con el servidor detenido: `node aplicar-parche.js --restaurar RUTA_DEL_RESPALDO`.

## Comprobaciones

Se comprueba el renderizado de los nueve módulos con las cuatro áreas en el orden solicitado, controles desactivados, recursos locales disponibles y conservación de los permisos, la sesión y el perfil. La revisión visual en Windows se realiza después de instalar.
