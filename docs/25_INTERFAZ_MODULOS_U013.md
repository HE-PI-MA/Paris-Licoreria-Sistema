# Interfaz compartida de módulos — U013

La cabecera del módulo comparte el fondo negro y la altura del sidebar en escritorio. Productos muestra directamente un buscador y un selector nativo de categoría, sin tarjeta exterior ni modal de filtros. Las consultas del catálogo siguen paginadas en el servidor.

## Archivos y responsabilidades

| Archivo | Uso |
| --- | --- |
| `public/css/components/sidebar.css` | Menú compacto de 14rem; logos de 135/100px y altura de cabecera compartida. Elimina la regla de fuente que anulaba los botones globales. |
| `public/css/components/module-layout.css` | Cabecera oscura, controles sin tarjeta y distribución adaptable; conserva 10px de separación en el cuerpo. |
| `public/css/components/buttons.css` | Botones de 42px, bordes de 6px, primarios oscuros con dorado, secundarios neutros y peligrosos rojos; conserva foco, iconos, desactivado y procesamiento. |
| `public/css/components/filters.css` | Presenta errores reintentables debajo de los controles, solo cuando ocurren. |
| `public/css/components/data-table.css` | Permite separar palabras del cuerpo; evita partir arbitrariamente los encabezados. El desplazamiento horizontal queda dentro de la tabla. |
| `views/components/module/header.ejs` | Título y acción principal sin referencias accesibles a ayudas inexistentes. |
| `views/components/module/controls.ejs` | Buscador con etiqueta accesible; selector de categoría configurable o botón de filtros avanzados. |
| `src/config/module-layouts.js` | Productos usa `filterMode: 'inline-category'`. Los permisos siguen en navegación y middleware. |
| `public/js/components/filter-bar.js` | Clase FilterBar: conserva el modo modal y agrega selectores directos con carga y reintento. |
| `public/js/pages/products.js` | ProductsPage conecta categoría y búsqueda a DataTable; conserva formularios, presentaciones y operaciones. |
| `public/js/components/action-menu.js` | Separa texto visible y nombre accesible; reposiciona el menú durante el desplazamiento. |
| `public/js/components/data-table.js` | Botón visible «Acciones» con nombre accesible «Acciones del registro N». |
| `tests/module-style-browser.test.js` | Comprueba el nuevo comportamiento con API ficticia. |
| `tests/controls-browser.test.js`, `tests/audit-browser.test.js` | Regresiones de menú móvil y retorno del foco por nombre accesible. |

Las definiciones originales se editan en sus componentes. No hay una hoja de parches visuales superpuestos ni dependencias nuevas. Las hojas y clases ya se cargaban en el orden necesario desde `workspace.ejs` y `app.css`.

## Reutilizar FilterBar

El módulo conserva sus operaciones. FilterBar solo comunica la consulta:

```js
this.filters = new ParisUI.FilterBar({
  container: document.querySelector('[data-module-region="controls"]'),
  searchInput: document.getElementById('module-search'),
  mode: 'inline',
  fields: [{
    name: 'categoryId', label: 'Categoría', type: 'select',
    control: document.getElementById('module-category'),
    emptyLabel: 'Todas las categorías',
    load: params => this.api.options('categories', params)
  }],
  onChange: query => this.table.setQuery(query)
});
```

`load` recibe `{ page, pageSize: 100, term: '', signal }` y devuelve `{ options: [{ value, label }], total }`. Total es un entero. La clase carga todas las páginas de categorías, comprueba duplicados y respuestas incompletas y crea opciones con texto seguro. No descarga todos los productos. Para opciones locales se puede usar `options` en lugar de `load`.

El selector aplica la categoría al cambiar y conserva el texto que se está escribiendo. Elegir «Todas las categorías» limpia ese filtro; DataTable reinicia la página. La búsqueda sigue usando su espera de 250ms. No se consultan categorías durante el renderizado de EJS: se cargan desde el navegador.

Un fallo deja un mensaje y un botón de reintento. El buscador continúa habilitado. `ready` permite esperar la carga inicial. `destroy()` cancela solicitudes y escuchas, elimina mensajes propios y restaura los controles antes de una nueva instancia. En modo modal se conservan los filtros avanzados, chips, fechas y SearchSelect de la demostración.

Productos muestra únicamente el filtro de categoría. Los parámetros de estado y stock mínimo siguen admitidos por la API U012 por compatibilidad, sin controles visibles en esta pantalla.

## Integración en Windows

1. Detener el servidor con Ctrl+C.
2. Extraer el ZIP en una carpeta nueva.
3. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"` para guardar y subir desde la sesión Git local.
5. Iniciar `node server.js` en el proyecto y recargar con Ctrl+F5.

El paquete contiene los archivos completos en `archivos/`, el detalle en `CAMBIOS.diff` y el manifiesto de compatibilidad. Acepta la base U012 y las dos variantes conocidas del sidebar compacto. No reemplaza modificaciones desconocidas. Guarda un respaldo de los archivos anteriores y restaura si fallan la escritura o las pruebas.

Puede comprobarse primero con `--comprobar`. Para restaurar, detener el servidor y ejecutar `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. La restauración de archivos no revierte commits que ya se hayan publicado.

El publicador usa como base `e37dd2efd0e65f4c3cd3ce5431659b3a305e8d1c`, verifica los archivos y prepara solamente esta revisión. No fuerza Git ni incluye cambios ajenos. Si el historial cambia, se detiene para conciliarlo. Puede repetirse después de un fallo de conexión.

U013 no ejecuta migraciones ni cambia productos, precios, existencias, licencias, credenciales o configuración. La preparación SQL de U012 debe estar instalada previamente.

## Comprobaciones

- 35 pruebas Node aprobadas: aplicación, autenticación, sesiones, licencia, permisos, formularios, diagnóstico y Productos.
- 27 escenarios de navegador Chromium aprobados entre las suites existentes y cuatro nuevos: categoría inmediata y página uno, búsqueda pendiente sin doble consulta, carga de 103 categorías en dos páginas, texto seguro, fallo y reintento con foco, destrucción/cancelación, cabeceras alineadas y pantallas de 1440, 900, 390 y 320px.
- Se mantienen las comprobaciones de modales, Escape, descarte de cambios, doble envío, presentaciones, mensajes, menús, filtros avanzados de la demo y pantallas de acceso.
- Instalador comprobado con archivos desechables: compatibilidad, repetición, respaldo/restauración, rechazo de cambios desconocidos, fallo de escritura y servidor abierto. Publicador comprobado creando un commit local exacto con un archivo ajeno sin preparar.
- La revisión visual usa datos ficticios. No se ha ejecutado en el Windows del usuario ni se ha publicado desde este entorno; el publicador incluido realiza la subida desde su equipo. No se volvió a ejecutar integración MySQL porque esta revisión no modifica SQL ni lógica de negocio.
