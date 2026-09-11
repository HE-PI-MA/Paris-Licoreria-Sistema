# Tablas adaptables y estilo compartido — U014

Productos utiliza una tabla directa con numeración, cabecera fija y desplazamiento interno. El fondo combina arena y carbón; los botones principales son azules, con icono y texto blanco y un color uniforme. Las cabeceras de escritorio del sidebar y del módulo comparten 84px. Los logos se reducen proporcionalmente, sin recortarlos.

## Funcionamiento del listado

- Se elimina la tarjeta exterior y su título «Contenido» en la variante de listado. El buscador y la categoría de U013 se conservan.
- La tabla ocupa el espacio restante entre los controles y los mensajes. Sus filas se desplazan dentro de la tabla y los encabezados permanecen visibles. En ventanas muy bajas el marco puede crecer para no aplastar los controles.
- Productos usa scroll continuo: primero consulta hasta 50 registros y, al acercarse al final, pide el siguiente bloque. Permite recorrer todos los productos que coinciden con la búsqueda y categoría, sin un límite visual de 10. No descarga toda la base al abrir la pantalla.
- «Cargar más» permite continuar también con teclado. Desaparece al llegar al total y devuelve el foco al área desplazable. El contador indica cuántos registros están cargados. La modalidad paginada sigue disponible para otros listados y presentaciones.
- La columna «N.º» muestra la posición en el resultado: 1, 2, 3… El ID no se usa como número visible. Buscar u ordenar vuelve al inicio; con paginación la numeración continúa en la página siguiente.
- Se quitan las flechas visuales de los encabezados. Se conserva la ordenación con clic/teclado, el nombre accesible y `aria-sort`.
- Si falla un bloque, las filas anteriores permanecen. Aparece un error persistente con reintento y «Actualizar lista». No se hacen reintentos automáticos en bucle. Se rechazan identificadores repetidos, bloques incompletos o cambios de total durante la continuación.
- Las consultas sucesivas no son una instantánea de la base: si otro usuario reorganiza el catálogo mientras se recorre, actualizar la lista vuelve a consultar el resultado vigente.

## Prioridades de columnas

La clase mide el ancho de su propio contenedor, por lo que responde también a la apertura y contracción del sidebar. Todas las columnas aparecen cuando hay espacio. Los datos secundarios permanecen accesibles mediante «Ver más» en la fila, usando los mismos formatos seguros de la tabla.

| Prioridad | Ancho disponible | Productos |
| --- | --- | --- |
| 0 | Siempre | Nombre; numeración y acciones también permanecen. |
| 1 | Desde 520px | Stock disponible y estado. |
| 2 | Desde 780px | Categoría y stock mínimo. |
| 3 | Desde 1100px | Unidad base y cantidad de presentaciones. |

Al reducir el ancho no desaparecen productos. Se reorganizan columnas; «Ver menos» permite cerrar el detalle. Las opciones ocultas usan `hidden`, evitando duplicar información para lectores de pantalla. No se inserta texto del usuario como HTML.

## Reutilizar la clase DataTable

```js
this.table = new ParisUI.DataTable({
  container: document.getElementById('products-table'),
  caption: 'Productos',
  mode: 'scroll',
  numbered: true,
  pageSize: 50,
  columns: [
    { key: 'name', label: 'Producto', sortable: true },
    { key: 'stock', label: 'Stock', type: 'quantity', priority: 1 },
    { key: 'category', label: 'Categoría', priority: 2 }
  ],
  load: params => this.api.list(params),
  actions: [{ id: 'edit', label: 'Editar', icon: 'edit' }],
  onAction: item => this.handleAction(item)
});
```

La API de `load` sigue recibiendo `{ page, pageSize, query, sort, signal }` y devuelve `{ records, total }`. En modo scroll cada registro necesita un identificador único, aunque no se muestren acciones. `getRowId` permite indicar su campo. El tamaño del bloque debe figurar en `pageSizes` y no puede superar 100, de acuerdo con las validaciones existentes.

`mode: 'pages'` y `numbered: false` son los valores predeterminados para conservar los componentes ya integrados. Una columna sin `priority` usa 0. La primera columna debe ser principal porque contiene el acceso al detalle. `setQuery()` y `setSort()` reinician el resultado. `refresh()` vuelve a consultar desde el inicio en modo scroll; `loadMore()` continúa si no hay otra solicitud pendiente; `loadMore({ retry: true })` reintenta un fallo. Para datos locales se utiliza `setData()`.

`destroy()` cancela solicitudes, observación de tamaños, eventos y menús. Las respuestas antiguas se ignoran aunque la función de carga no respete AbortSignal. Las operaciones del negocio siguen en ProductsPage y sus formularios, no en DataTable.

Para que otro módulo use el marco sin tarjeta y con altura acotada, declarar `contentVariant: 'listing'` en `src/config/module-layouts.js`. Los módulos con formularios o demostraciones conservan su distribución. Una tabla independiente con scroll necesita un contenedor con altura disponible o una altura definida por su pantalla.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `public/js/components/data-table.js` | Scroll por bloques, numeración, prioridades, detalle y ordenación sin flechas. |
| `public/css/components/data-table.css` | Superficies arena/carbón, filas alternadas, cabecera fija, detalles y pie del listado. |
| `public/css/components/buttons.css` | Botones compartidos planos, foco, variantes y estado de procesamiento. |
| `public/css/components/sidebar.css` | Cabeceras de 84px y logos proporcionados; ancho compacto conservado. |
| `public/css/components/module-layout.css` | Variante de listado sin tarjeta y cuerpo con altura disponible. |
| `src/config/module-layouts.js` | Productos selecciona la variante de listado. |
| `views/layouts/workspace.ejs` | Aplica la variante y retira el encabezado exterior en esos listados. |
| `public/js/pages/products.js` | Configura prioridades, numeración y scroll; conserva operaciones y presentaciones. |
| `tests/table-scroll-browser.test.js` | Seis escenarios nuevos de scroll, fallos, cancelación, prioridades, numeración e integración en Productos. |
| `tests/products-browser.test.js`, `tests/module-style-browser.test.js` | Actualizan las expectativas de paginación al scroll; conservan pruebas de edición, formularios, filtros y distribución. |

Las reglas originales se modifican en su componente. Los archivos existentes ya se cargan en el orden necesario. No hay hojas de sobreescritura, librerías adicionales, cambios de SQL ni nuevas operaciones sobre datos reales.

## Integración y recuperación

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Iniciar `node server.js` desde el proyecto y recargar con Ctrl+F5.

El paquete incluye los archivos completos en `archivos/`, `CAMBIOS.diff` y un manifiesto de compatibilidad con U013. El instalador comprueba los archivos antes de reemplazar, guarda un respaldo y restaura ante fallos de escritura o de pruebas. No ejecuta migraciones. Para revisar sin instalar: `--comprobar`. Para recuperar archivos, detener el servidor y usar `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`; esto no revierte commits publicados.

El publicador usa la base Git `4dba69ec7816ffed89bedcf3bd5eef5a04424a67`. Verifica los archivos, crea solo el commit de esta revisión y sube usando la sesión Git del equipo. No fuerza la rama ni incluye archivos ajenos. Una publicación interrumpida puede reintentarse con el mismo publicador. No se publicó desde el entorno de desarrollo.

## Comprobaciones realizadas

- 35 pruebas Node de aplicación, acceso, licencia, roles, formularios, diagnóstico y Productos aprobadas.
- 33 escenarios de Chromium aprobados: 27 existentes adaptados al listado continuo y seis nuevos. Se comprueban bloqueos de doble envío, filtros, foco, menús, modales, descarte, errores y lectura segura.
- Los escenarios nuevos recorren un listado de 113 registros hasta el final, verifican que las consultas no se duplican, conservan filas ante fallos, rechazan bloques inconsistentes, cancelan respuestas atrasadas y comprueban numeración independiente del ID. Se prueba también la modalidad paginada.
- Cabeceras alineadas y reducidas; sin desplazamiento horizontal de toda la página en 1440, 900, 390 y 320px. Revisión visual en escritorio y móvil, incluido el detalle de una fila.
- Instalador comprobado en copias temporales: repetición, respaldo/restauración, servidor abierto, cambios desconocidos, BOM/CRLF, archivo de paquete ausente y fallo de escritura. Publicador comprobado con un commit local exacto, conservando un archivo ajeno sin preparar.
- Se usan datos ficticios y un entorno Linux/Chromium. Falta comprobar la instalación en el Windows del usuario. No se volvió a ejecutar integración MySQL porque esta revisión no modifica su esquema ni la lógica del negocio.
