# U010 — Filtros, selectores y listados compartidos

## Alcance y punto de partida

Se revisó GitHub en el commit `59dd508af334f1383bbc45a8fad1083902075c11` (U008A) y la base compartida U009 entregada anteriormente. U010 reúne ambos cambios: admite los archivos revisados de U008A o U009 y conserva las definiciones actuales del sidebar, logos, espacio de 10 px, alto disponible, Inter e iconos locales.

Esta etapa implementa componentes y una demostración. No incorpora el CRUD real de Productos, consultas a proveedores reales ni migraciones. El uso normal mantiene las páginas y los permisos existentes.

## Componentes reutilizados y nuevos

| Componente | Responsabilidad |
| --- | --- |
| `Button`, estilos de formularios y `Message` | Apariencia compartida, estados, validación y mensajes. |
| `Modal`, `Confirm`, `FormController` | Foco, teclado, cambios pendientes, errores y envío único. |
| `ModuleLayout` y `DataTable` | Marco del módulo, mensajes, listado, paginación, errores y reintento. |
| `FilterBar` — nuevo | Buscador, modal configurable, filtros activos y limpieza. |
| `SearchSelect` — nuevo | Selección simple con búsqueda local o consulta por páginas. |
| `DateRange` — nuevo | Desde/Hasta con controles de fecha nativos. |
| `ActionMenu` — nuevo | Menú reutilizable con acciones, teclado y foco. |
| `DataTable` — ampliado | Orden local o remoto, formato de fecha y acciones agrupadas. |
| `NavigationDiagnostics` — nuevo | Medición opcional de navegación en el equipo de desarrollo. |

Los nuevos estilos están en `filters.css` y `action-menu.css`. El ordenamiento se define en `data-table.css`. Se modificaron las definiciones correspondientes, sin agregar bloques repetidos para sobreescribirlas.

## FilterBar

La clase aprovecha el buscador y el botón de filtros del marco actual:

```js
const UI = window.ParisUI;
const filters = new UI.FilterBar({
  container: document.querySelector('[data-module-region="controls"]'),
  searchInput: document.getElementById('module-search'),
  filterButton: document.querySelector('.module-filter-button'),
  fields: [
    { name: 'estado', label: 'Estado', type: 'select', options: [
      { value: 'ACTIVO', label: 'Activo' },
      { value: 'INACTIVO', label: 'Inactivo' }
    ] },
    { name: 'proveedor', label: 'Proveedor', type: 'search', load: request => servicio.listarOpciones(request) },
    { name: 'fechas', label: 'Fechas', type: 'dates' }
  ],
  onChange: query => tabla.setQuery(query)
});
```

Este ejemplo describe cómo conectar el componente: `servicio` y `tabla` pertenecen a la futura clase del módulo. No se crearon esas operaciones reales. Cada módulo debe declarar solo los filtros que necesite.

La consulta contiene `term` y los nombres definidos. Un rango produce `{ from: '2026-09-01', to: '2026-09-10' }`; una selección vacía produce `''`. `getValue()` entrega una copia. `setValue(query)` actualiza controles y consulta; `setValue(query, false)` solo actualiza los controles. `destroy()` retira eventos, temporizadores y modales.

El buscador espera 250 ms sin nuevas pulsaciones y Enter aplica inmediatamente. Los filtros del modal se aplican juntos. Cancelar o Escape solicita confirmación si se cambió el borrador. Cada filtro activo puede quitarse y Limpiar filtros reinicia todos. La página del listado vuelve a 1; el orden vigente se conserva.

## SearchSelect

Se mejora un `<select>` existente, conservando su nombre y valor para `FormData`:

```js
const selector = new ParisUI.SearchSelect({
  select: formulario.querySelector('select[name="proveedor"]'),
  pageSize: 20,
  load: async ({ term, page, pageSize, signal }) => {
    // El servicio conserva autenticación y valida su respuesta.
    return servicio.listarOpciones({ term, page, pageSize, signal });
  }
});
```

Contrato de respuesta:

```js
{ options: [{ value: '42', label: 'Proveedor de ejemplo' }], total: 125 }
```

`total` cuenta las coincidencias en el servidor; `options` contiene únicamente la página pedida. Los valores deben ser únicos y no vacíos. El selector permite cargar más opciones, reintentar errores y limpiar la selección. Sin `load`, busca en las opciones iniciales del select.

Para editar un registro cuyos datos ya se conocen:

```js
selector.setValue({ value: '42', label: 'Proveedor de ejemplo' });
selector.setValue(null); // Vaciar; pasar true como segundo argumento para emitir change.
```

Las flechas recorren resultados, Enter elige y Escape cierra la lista antes de cerrar el modal. Escribir inicia una búsqueda y elimina la selección anterior: el texto por sí solo no es un identificador válido. Tab cierra la lista. La lista se despliega dentro del formulario y su área de resultados tiene desplazamiento propio.

El select original se oculta visualmente; `FormController` conserva su validación y muestra/enfoca el error en el campo visible. Durante un envío ambos quedan desactivados. Al destruir el componente se restaura el select. No incluye selección múltiple; se puede desarrollar cuando un requisito concreto la necesite.

## DateRange

```js
const rango = new ParisUI.DateRange({
  container: contenedor,
  name: 'periodo', label: 'Periodo',
  value: { from: '', to: '' },
  onChange: value => console.log(value)
});
const valido = rango.validate();
const valor = rango.getValue();
rango.setValue({ from: '2026-09-01', to: '2026-09-30' });
```

Crea `periodoFrom` y `periodoTo`, admite extremos vacíos y rechaza Hasta anterior a Desde. Usa valores ISO de fecha sin convertirlos a UTC, evitando mover un día por la zona horaria. El aspecto del calendario desplegable corresponde al navegador; el campo usa el estilo global. `FilterBar` delega los mensajes al `FormController`, sin mostrar dos errores iguales.

## Orden y menú en DataTable

```js
const tabla = new ParisUI.DataTable({
  container: contenedor,
  columns: [
    { key: 'nombre', label: 'Nombre', sortable: true },
    { key: 'precio', label: 'Precio', type: 'price', sortable: true },
    { key: 'fecha', label: 'Fecha', type: 'date', sortable: true }
  ],
  sort: { key: 'nombre', direction: 'asc' },
  actionDisplay: 'menu',
  actions: [
    { id: 'editar', label: 'Editar', icon: 'edit' },
    { id: 'eliminar', label: 'Eliminar', icon: 'trash', variant: 'danger' }
  ],
  load: request => servicio.listar(request),
  onAction: event => modulo.atenderAccion(event)
});
```

`load` recibe `{ page, pageSize, query, sort, signal }`; `sort` es `null` o `{ key, direction: 'asc' | 'desc' }`. El servicio debe filtrar y ordenar antes de paginar. El componente no ordena solo la página recibida del servidor. La respuesta sigue siendo `{ records, total }`.

En modo local `records` contiene la lista completa y `DataTable` aplica orden y paginación. Cantidades y precios se comparan como números; los valores vacíos quedan al final. Las fechas de tipo `date` se reciben como `YYYY-MM-DD` y se muestran `DD/MM/YYYY`. Solo se pueden ordenar columnas declaradas `sortable: true`.

`setSort(null)` quita el orden; `setSort({ key, direction })` cambia el orden y vuelve a la primera página. El encabezado comunica `aria-sort`. `setActionDisplay('menu')` agrupa acciones y `setActionDisplay('buttons')` muestra botones. La presentación predeterminada sigue siendo `buttons`, conservando U009.

El callback `onAction` mantiene la responsabilidad de la clase de cada módulo. Debe devolver su Promise para bloquear acciones repetidas mientras se trabaja. Se conservan `visible`, `disabled`, confirmaciones y los mensajes existentes.

Para usar el menú fuera de una tabla:

```js
const menu = new ParisUI.ActionMenu({
  container: contenedor, label: 'Acciones del registro',
  items: [{ id: 'editar', label: 'Editar', icon: 'edit' }],
  onSelect: (item, { button }) => modulo.atenderAccion(item.id, button)
});
```

Admite flechas, Inicio/Fin, Escape y Tab. Devuelve el foco al botón y coloca el menú en la capa de popovers para evitar recortes en listados. Los recursos visuales no requieren Internet. Destruir cada componente al abandonar su vista evita eventos duplicados.

## Orden de carga y comentarios

`workspace.ejs` carga los archivos con `defer`: ui-core, messages, modal, form-controller, search-select, date-range, filter-bar, action-menu, data-table, module-layout y la clase de demostración. Las instancias se crean después de cargar estos archivos. El login y la activación conservan sus scripts.

Cada archivo nuevo explica su propósito. Los métodos comentan contratos y decisiones relevantes: datos seguros, cancelación, teclado, validación, consultas por páginas y recuperación del foco. Evitar comentar cada asignación obvia o duplicar las instrucciones en varias clases.

## Demostración y comprobaciones

Entrar como administrador a `/demostracion/componentes`. Los 37 registros, 63 proveedores y fechas son ficticios; se reinician al recargar. El listado normalmente responde sin demora artificial. La casilla Simular conexión lenta agrega 600 ms a consultas de esta demostración. El envío ficticio conserva 900 ms para comprobar Guardando… y bloqueo de doble envío. Ninguna de esas demoras afecta la navegación entre módulos normales.

Probar Filtros, combinar selecciones y fechas, quitar filtros, ordenar encabezados y marcar Mostrar acciones en un menú. El formulario incluye un proveedor con búsqueda. Se mantienen las pruebas de vacío, carga, error, reintento, notificaciones y cambios sin guardar.

Pruebas automatizadas: `node --test tests/*.test.js`. Las pruebas MySQL y navegador se omiten salvo activación explícita. Para Chromium se utilizan las instrucciones de `docs/20_COMPONENTES_COMPARTIDOS_U009.md`; se agregan los escenarios de `tests/controls-browser.test.js`. Playwright es solo una herramienta opcional de pruebas, no una dependencia para ejecutar el sistema.

La preparación se verifica en Linux con Chromium; el informe del ZIP registra resultados y límites. La instalación y revisión en Windows y los tiempos del MySQL real se comprueban en el equipo del usuario.

## Medir la demora al navegar

No se confirmó la causa de los dos segundos en Windows. El código usa navegación completa, con sesión MySQL, licencia/activación, usuario y EJS. La huella del equipo y el descifrado de activación ya tienen caché; no se eliminaron controles de seguridad.

Con el servidor normal detenido, desde la carpeta del proyecto:

```powershell
node .\scripts\diagnosticar-navegacion.js
```

Entrar y cambiar varias veces entre Inicio, Productos e Inventario. La consola mostrará por petición `ruta`, `estado`, `total_ms` y tiempos de `sesion_mysql_ms`, `licencia_activacion_ms`, `usuario_mysql_ms`, `plantilla_ejs_ms`. Son tiempos del servidor, no incluyen la descarga y el dibujo en el navegador; las etapas no se deben sumar como si todas fueran independientes. No se imprimen cookies, contraseñas, datos de sesión, SQL ni datos del negocio.

Si el servidor termina rápido pero el navegador sigue demorando, revisar F12 → Red → solicitud de tipo documento → Tiempo, con Sin limitación de red. Comparar espera del servidor con carga completa. Un resultado de diagnóstico es necesario antes de cambiar consultas, cachés o navegación.

Detener con Ctrl + C y volver a `node .\server.js` desactiva todas las mediciones. No se modifica `.env` y el arranque normal no activa diagnóstico. El script se limita a desarrollo; las verificaciones y el funcionamiento normal de sesiones se mantienen.

## Integración en Productos

1. Definir los campos, columnas, filtros y acciones que correspondan al modelo real.
2. Crear la clase Productos y su servicio; reutilizar las clases de esta guía.
3. Validar permisos y entradas también en Express. En ordenamiento usar una lista permitida de columnas SQL, nunca concatenar directamente `sort.key` recibido.
4. Aplicar consultas parametrizadas, filtros y orden antes de `LIMIT/OFFSET`. Revalidar fechas, tamaños y valores en el servidor.
5. Mantener CSRF en las operaciones de escritura y las confirmaciones para eliminar o descartar.
6. Desarrollar y comprobar las operaciones reales como etapa separada.
