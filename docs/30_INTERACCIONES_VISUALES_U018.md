# Interacciones visuales compartidas — U018

## Cambios

- DataTable muestra encabezados de texto. Pulsar Producto, Disponible o Estado no ordena, consulta ni modifica registros. El distintivo de estado sigue siendo informativo. Activar/Desactivar permanece en el menú y conserva su confirmación.
- El módulo mantiene su orden inicial y puede llamar setSort si necesita cambiarlo programáticamente; sortable declara los campos permitidos para esa API, no crea botones en el encabezado.
- NotificationCenter presenta avisos con fondo completo, icono y título. Los éxitos e información duran 2000 ms por defecto y no tienen botón Cerrar. La lectura con foco, puntero o pestaña oculta pausa el temporizador. Error, advertencia y carga permanecen visibles y conservan cierre; no se ocultan problemas pendientes a los dos segundos.
- RecordDetails usa un único contenedor con etiquetas y valores, sin tarjetas por campo. La información secundaria de las filas compactas usa un bloque con acento dorado.
- El listado vacío utiliza icono central, título y mensaje, dentro de la tabla. Error y carga reutilizan Message; el error mantiene Reintentar.
- ActionMenu admite tonos semánticos: info (azul), edit (ámbar), catalog (violeta), success (verde), warning (naranja) y danger (rojo). Los textos e iconos siguen identificando cada acción.
- El formulario se presenta directamente en el cuerpo del modal. Se retira el borde y relleno interior duplicado y la ayuda genérica de Unidad base. Las restricciones relevantes de registros con historial permanecen.
- SearchSelect con búsqueda solo consulta al escribir texto no vacío, o al abrir por teclado con texto. Foco/clic en un campo vacío no consulta. El filtro de categoría sin búsqueda sigue abriendo por clic o teclado.
- Las sugerencias flotan sobre el contenido mediante popover y posición fija; no aumentan la altura del formulario. Se reposicionan al desplazar o redimensionar, se abren hacia arriba cuando conviene y conservan rueda, tacto, teclado y carga por páginas con barra oculta. Ya no muestran el contador «6 de 6 opciones».
- Los formularios del negocio solicitan autocomplete="off". SearchSelect proporciona las recomendaciones del sistema; los campos del catálogo también desactivan el historial y la corrección ortográfica. Las contraseñas, activación y datos guardados no se transforman. Algunos navegadores o extensiones pueden ignorar autocomplete: su ventana nativa no admite estilos CSS de la aplicación.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `public/js/components/data-table.js` | Encabezados informativos, estados integrados y tono de acciones por registro. |
| `public/css/components/data-table.css` | Presentación del vacío/error y detalles de filas pequeñas; retira estilos de botones de ordenamiento. |
| `public/js/components/search-select.js` | Búsqueda al escribir, panel flotante, teclado, cancelación y limpieza de eventos. |
| `public/js/components/filter-bar.js`, `views/components/module/controls.ejs` | Categoría flotante y buscador sin historial del navegador. |
| `public/css/components/filters.css` | Panel sobrepuesto y lista desplazable sin barra visible. |
| `public/js/components/messages.js`, `public/css/components/messages.css` | Avisos de color completo, duración, pausa y errores persistentes. |
| `public/js/components/action-menu.js`, `public/css/components/action-menu.css` | Tonos semánticos reutilizables. |
| `public/css/components/record-details.css` | Contenedor único para el detalle. |
| `public/css/components/modal.css` | Retira la tarjeta interior del formulario. |
| `public/js/components/form-controller.js` | Desactiva el historial en formularios de negocio y restaura el atributo al destruirse. |
| `public/js/pages/product-forms.js` | Campos del catálogo sin historial ni ayuda repetida de Unidad base. |
| `public/js/pages/products.js` | Define colores de acciones de Productos y Presentaciones. |
| `tests/refinements-browser.test.js` | Escenarios U018 con datos ficticios. |
| `tests/controls-browser.test.js`, `tests/products-browser.test.js`, `tests/product-visual-browser.test.js`, `tests/ui-browser.test.js` | Adaptan comprobaciones anteriores a las sugerencias al escribir, el orden programático y la pausa del aviso sin botón. |

Se conservan las clases existentes y la carga actual de scripts/estilos. No se agregan bibliotecas, servicios externos ni CSS al final para ocultar reglas anteriores: se editan las definiciones originales. Los comentarios explican propósito, posición, foco y decisiones de interacción.

## Uso para módulos nuevos

```javascript
// Datos, búsqueda y acciones siguen perteneciendo al módulo.
const table = new ParisUI.DataTable({
  container: document.getElementById('listado'),
  columns: [
    { key: 'name', label: 'Producto', sortable: true },
    { key: 'stock', label: 'Disponible', type: 'quantity', priority: 1 }
  ],
  sort: { key: 'name', direction: 'asc' },
  load: params => api.list(params),
  actionDisplay: 'menu',
  actions: [
    { id: 'detail', label: 'Ver detalle', icon: 'info', tone: 'info' },
    { id: 'edit', label: 'Editar', icon: 'edit', tone: 'edit' },
    { id: 'state', label: row => row.active ? 'Desactivar' : 'Activar',
      icon: 'refresh', tone: row => row.active ? 'warning' : 'success' }
  ],
  onAction: item => controller.handleAction(item)
});

const selector = new ParisUI.SearchSelect({
  select: document.getElementById('categoria'),
  load: params => api.options('categories', params)
});
// load recibe term, page, pageSize y signal; devuelve { options: [{ value, label }], total }.
// Sin búsqueda: searchable: false. No hace falta configurar popup.
// El select original conserva el valor usado por FormData y la validación.

const notices = new ParisUI.NotificationCenter();
notices.show('success', 'Producto guardado correctamente.');
// Usar Message o ParisModule.showMessage para problemas que requieren corrección.
```

Destruir table, selector y notices cuando se retire la vista. Conservar FormController para validación, protección de doble envío y cambios pendientes. No escribir valores de usuarios mediante innerHTML.

## Instalación y publicación

Base revisada: U017, commit `d6ab8532160382f668aff62c3216b8a80bafdfc5` de `HE-PI-MA/Paris-Licoreria-Sistema`.

1. Detener el servidor con Ctrl+C.
2. Extraer el paquete y ejecutar `node aplicar-parche.js --proyecto "RUTA_DEL_PROYECTO"`.
3. Ejecutar `node publicar-github.js --proyecto "RUTA_DEL_PROYECTO"`.
4. Iniciar `node server.js` y recargar con Ctrl+F5.

El instalador verifica la revisión actual, respalda, aplica archivos completos y ejecuta las 35 pruebas simuladas de la aplicación. Ante fallo restaura los archivos. Admite BOM/CRLF y repetición; se detiene frente a modificaciones distintas. No ejecuta SQL, migraciones ni actualización de dependencias.

El publicador usa Git del equipo, incluye solo los archivos de esta revisión, verifica el commit y realiza push sin force. Si GitHub contiene otros cambios se detiene; si falla la conexión, el commit local se conserva para reintentar. La preparación de este paquete no publica en GitHub.

Solo comprobar: `node aplicar-parche.js --proyecto RUTA --comprobar`.
Restaurar archivos, con servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Esto no revierte commits publicados.

## Verificación

- 35 pruebas Node: autenticación, activación, permisos, sesiones, frontend, navegación, Productos y migración simulada.
- 46 escenarios en Chromium: U009 (7), U010 (7), U012 (5), U014 (6), U015 (4), U016 (5), U017 (6) y U018 (6). Comprueban encabezados sin acción, estado informativo, colores, detalle único, temporizador de dos segundos, pausa accesible, errores persistentes, vacío, búsqueda por páginas, selección, texto seguro, respuestas antiguas, reintento y guardado único.
- Medición de posiciones: campos y pie permanecen exactamente en el mismo lugar antes y después de abrir sugerencias.
- Se comprueban tablas, sidebar y modales en escritorio, tablet y móvil, incluyendo 320 y 390 px, sin desbordamiento horizontal de la página.
- Instalador con copias temporales: respaldo/restauración, archivos distintos, paquete incompleto, BOM/CRLF, fallo de escritura, servidor abierto y repetición. Publicador con un repositorio local ficticio, sin push.

Las capturas de `vista-previa/` usan datos ficticios. No se conectó la base real. Pendientes: ejecución del instalador en Windows, comprobación con el perfil de Chrome del usuario y publicación usando su sesión Git.
