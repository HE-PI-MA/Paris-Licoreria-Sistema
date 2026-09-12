# Interfaz uniforme y compacta — U015

Revisión de los componentes compartidos sobre U014. Mantiene Node.js, Express, EJS, las clases JavaScript actuales, Inter y los iconos locales. No añade dependencias ni operaciones del negocio.

## Resultado visible

- El sidebar conserva su ancho de 14rem y la cabecera de 84px. El logo completo usa una caja de 112px para compensar el margen transparente de su imagen; la marca visible aprovecha la cabecera. El símbolo del menú contraído mide 70px. Se conserva la proporción y el botón no ocupa el espacio de la marca.
- En móvil, la hamburguesa forma parte de la cabecera del módulo. Se elimina la segunda barra «París Licorería». Perfil y acceso denegado también tienen una sola cabecera y un solo botón para abrir el menú.
- «Nuevo producto» y «Nueva presentación» ya reutilizaban el icono `plus` del catálogo EJS. Tanto los iconos generados en EJS como los clonados desde JavaScript salen de `icon.ejs`; `data-icon` permite identificarlos al inspeccionar.
- Los disparadores «Acciones» usan la variante primaria azul de `Button`. Sus opciones conservan las variantes de cada operación, incluida la peligrosa. Estado y acciones no parten sus palabras entre líneas.
- Las filas tienen un fondo crema uniforme, sin alternancia. El encabezado sigue en carbón y el espacio libre en arena. El realce al pasar el puntero permite localizar la fila sin convertirla en una franja permanente.
- La tabla no reserva una franja para la barra de desplazamiento y no muestra la barra. Mantiene rueda, tacto, teclado, cabecera fija, carga por bloques y el botón «Cargar más» mientras queden registros. Las columnas secundarias siguen disponibles en «Ver más» cuando falta ancho.
- Se retira visualmente «Mostrando…». El estado permanece como anuncio accesible fuera del pie. En modo continuo el pie desaparece cuando no tiene carga pendiente ni errores; los errores y su reintento permanecen visibles. Las tablas paginadas conservan sus controles.
- El buscador y la categoría comparten bordes cálidos, fondo crema, foco dorado y una sombra discreta. La categoría despliega opciones con el estilo del sistema sin añadir una tarjeta alrededor de los controles.

## Mayúsculas y valores de formulario

La presentación global usa `text-transform: uppercase`, también en campos y botones, mensajes, tablas y modales. El título de la pestaña se presenta en mayúsculas. Esto no reescribe los registros existentes.

`ParisUI.TextCase` normaliza realmente los campos marcados con `data-uppercase` durante la escritura. Se aplica a nombres y descripciones de Productos y nombres de sus presentaciones. Conserva el cursor y espera a que termine la composición del teclado. Ejemplo para futuros formularios:

```js
const name = ParisUI.element('input', 'app-input');
name.type = 'text';
name.name = 'name';
name.dataset.uppercase = '';
```

La instancia compartida de `ui-core.js` usa eventos delegados; los modales nuevos no agregan escuchas adicionales. No transformar contraseñas, usuario de acceso, claves de activación, códigos de barras, identificadores o valores de opciones. Su valor real se conserva exacto; la búsqueda mantiene la cadena recibida para no alterar códigos sensibles a mayúsculas. Los nombres históricos sin editar conservan su valor original y se muestran en mayúsculas por CSS.

## Selector compartido

Se amplía `SearchSelect`; no se crea otro sistema de filtros. `FilterBar` conserva su carga de categorías, validación, cancelación, estado de error y reintento. El `select` original sigue siendo la fuente de opciones y el valor del formulario.

```js
const category = new ParisUI.SearchSelect({
  select: document.querySelector('select[name="categoryId"]'),
  searchable: false,
  popup: true,
  pageSize: 100
});
```

- `searchable: true` y `popup: false` son los valores predeterminados: los selectores de formularios existentes mantienen su búsqueda y carga remota.
- La variante de elección simple conserva la opción vacía («Todas las categorías»), admite Enter/Espacio, flechas, Inicio/Fin, búsqueda por primeras letras, Escape y Tab. Escape cancela la elección sin cambiar el filtro.
- El desplegable se superpone debajo del campo y no desplaza la tabla. El menú usa texto seguro; los nombres no se interpretan como HTML.
- `syncOptions()` actualiza opciones locales si cambian en el `select`. `syncLabel()` refleja cambios programáticos del valor. `destroy()` cancela solicitudes y eventos, desconecta el observador y restaura el control original.
- `FilterBar` configura esta variante automáticamente en el modo `inline`; no es necesario inicializarla otra vez desde Productos.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `docs/16_GUIA_DE_MANTENIMIENTO.md` | Valores vigentes y mapa de componentes compartidos. |
| `public/css/base/reset.css` | Presentación global en mayúsculas, con herencia explícita en controles. |
| `public/css/components/sidebar.css` | Marca ampliada, cabecera compacta y botón móvil compartido. |
| `public/css/components/module-layout.css` | Cabecera con hamburguesa, distribución y estilo del buscador/categoría. |
| `public/css/components/data-table.css` | Filas uniformes, barra oculta y palabras completas en acciones/estado. |
| `public/css/components/filters.css` | Variantes del desplegable de SearchSelect. |
| `public/js/components/ui-core.js` | Icon, Button y la clase TextCase para texto del negocio. |
| `public/js/components/search-select.js` | Selección simple o con búsqueda, teclado, valor y ciclo de vida. |
| `public/js/components/filter-bar.js` | Integra el selector manteniendo consultas y reintentos. |
| `public/js/components/action-menu.js` | Disparador primario con el mismo estilo de los demás botones. |
| `public/js/components/data-table.js` | Anuncio accesible y pie visible solo cuando hay controles útiles. |
| `public/js/pages/product-forms.js` | Marca explícita de nombres/descripciones que se normalizan al editar. |
| `views/components/sidebar-opener.ejs` | Única definición del botón de apertura móvil. |
| `views/components/module/header.ejs`, `views/layouts/workspace.ejs` | Integración del botón en módulos, perfil y páginas auxiliares. |
| `views/components/icon.ejs` | Identificación del icono compartido en el SVG. |
| `views/auth/login.ejs`, `views/auth/activation.ejs` | Título de pestaña en mayúsculas. |
| `tests/interface-polish-browser.test.js` | Cuatro escenarios nuevos de interacción y presentación. |
| Pruebas de navegador existentes | Conservan comprobaciones funcionales y leen el contador como estado accesible. |

Se modifican las definiciones originales por componente. No se añade una hoja de sobreescrituras ni se copia el código de filtros o tablas dentro de Productos. El orden existente de scripts ya carga SearchSelect antes de FilterBar y ui-core antes de los formularios.

## Integración en Windows

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Iniciar `node server.js` desde el proyecto y recargar con Ctrl+F5.

El paquete contiene archivos completos en `archivos/`, `CAMBIOS.diff` y el manifiesto. Comprueba compatibilidad con U014 antes de escribir, guarda respaldo y restaura si falla la escritura o la prueba de aplicación. Acepta diferencias de BOM y saltos de línea; no acepta versiones desconocidas. No modifica `.env`, licencia, activación, dependencias o base de datos ni ejecuta migraciones.

Para revisar sin instalar: `node aplicar-parche.js --proyecto RUTA --comprobar`. Para restaurar, detener el servidor y usar `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. La restauración de archivos no revierte commits ya publicados.

El publicador parte del commit U014 `86568ef74e1805b8b164577ca14cc23ee95c6150`. Verifica el repositorio, la rama y el conjunto exacto de archivos; crea y sube el commit usando la sesión Git del equipo. Conserva archivos ajenos y no fuerza el historial. Permite reintentar un push interrumpido del mismo commit. El paquete no implica que ya esté instalado o publicado en el equipo del usuario.

## Comprobaciones y límites

- Base cotejada con los 179 archivos publicados en el commit U014; las dos diferencias de bytes corresponden a formato de texto, con contenido normalizado idéntico.
- 35 pruebas Node de aplicación, sesiones, activación, roles, formularios, diagnóstico y Productos aprobadas.
- 37 escenarios de Chromium aprobados: los 33 existentes y cuatro nuevos. Incluyen recorrido de 113 registros, errores al continuar, reintento, respuestas atrasadas, ordenación, datos seguros, filtros, formularios, doble envío, confirmación de descarte y retorno de foco.
- Selector directo comprobado con 103 categorías y error simulado, carga completa, teclado, elección vacía y destrucción sin eventos duplicados.
- Nombres editados en mayúsculas, posición del cursor y composición comprobados. Código de barras `aBc-123` conservado exactamente en el envío simulado; precio decimal sin cambio.
- Revisión visual en escritorio y móvil; anchos de 1440, 900, 760, 390 y 320px sin desbordar toda la página. La hamburguesa conserva bloqueo del fondo y retorno del foco. Se revisan también login y modales con texto ampliado/ventanas bajas.
- Instalador y publicador comprobados con copias y Git local: respaldo/restauración, ejecución repetida, rechazo de cambios desconocidos, BOM/CRLF, archivos ausentes, escritura interrumpida, servidor abierto, configuración conservada y commit exacto sin incluir un archivo ajeno.
- Las comprobaciones usan Linux, Chromium y datos ficticios. La instalación y publicación en el Windows del usuario quedan por ejecutar. No se repite la integración MySQL porque no cambia el esquema ni las operaciones del negocio.
