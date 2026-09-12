# Productos, detalles y modales — U017

## Interfaz

La tabla principal muestra N.º, Producto, Categoría, Unidad base, Disponible, Estado y Acciones. La numeración es consecutiva y no usa el identificador del registro. Se eliminan del listado las columnas Presentaciones y Stock mínimo; estos datos se conservan en el formulario, el detalle y las operaciones existentes. En tamaños pequeños se mantienen las prioridades y «Ver más» permite consultar las columnas que no caben.

Las cantidades, precios y números usan la misma fuente Inter local y alineación centrada. ValueFormat mantiene los formatos de cantidad y moneda utilizados por DataTable y RecordDetails: por ejemplo, 30.000 unidades se presentan como 30 y 2203.592 como 2.203,592. Esto solo modifica su presentación, no los valores enviados al servidor. La lupa se verificó contra el catálogo SVG local; ya era la misma que utiliza el sistema.

El filtro conserva desplazamiento por rueda, tacto y teclado, con la barra visual oculta. Los selectores de formularios permiten escribir y recibir sugerencias; para cambiar una selección se edita o borra el texto. Se elimina el botón X lateral. El select original conserva el valor que usa FormData y la selección requiere una elección explícita.

El aviso permanente de precios desaparece. ModuleLayout conserva sus regiones de mensajes y vuelve a mostrarlas ante errores, advertencias o carga; resetMessage las oculta cuando el módulo no declara un aviso inicial.

Los modales comparten cabecera negra, icono dorado, superficie cálida, campos y pie de acciones. El cuerpo largo se desplaza conservando cabecera y pie. No hay una X de cierre en la cabecera: se cierra con Cancelar/Cerrar en el pie o Escape. Se conservan confirmación de cambios pendientes, foco, bloqueo durante el guardado y diálogos anidados. Confirm reutiliza Modal con icono de advertencia.

RecordDetails presenta datos de consulta en bloques con etiquetas, cantidades y estados. Las notificaciones utilizan el mismo Message, con icono, título, color de resultado y botón Cerrar. Error, advertencia y carga permanecen visibles; los avisos breves conservan la pausa al leer, enfocar o cambiar de pestaña.

## Componentes y comentarios

| Archivo | Responsabilidad |
| --- | --- |
| `public/js/pages/products.js` | Columnas del catálogo, detalle y coordinación de operaciones existentes. |
| `public/js/pages/product-forms.js` | Campos y elección de icono de Nuevo/Editar en el modal compartido. |
| `public/js/components/ui-core.js` | ValueFormat: formato numérico común; conserva Icon, Button y TextCase. |
| `public/js/components/record-details.js` | Clase nueva RecordDetails: construye un dl seguro según campos y tipos. |
| `public/css/components/record-details.css` | Bloques de información y adaptación del detalle. |
| `public/js/components/data-table.js` | Reutiliza ValueFormat para celdas y detalle de fila. |
| `public/css/components/data-table.css` | Tipografía y centrado numérico. |
| `public/js/components/modal.js`, `public/css/components/modal.css` | Modal con icono, pie de cierre y presentación común. |
| `public/js/components/messages.js`, `public/css/components/messages.css` | Notificaciones con título e icono sobre Message. |
| `public/js/components/search-select.js`, `public/css/components/filters.css` | Sugerencias sin X y listas con barra oculta. |
| `public/css/components/forms.css` | Alineación de campos con ayudas de distintas alturas. |
| `src/config/module-layouts.js`, `views/components/module/messages.ejs` | Mensaje inicial vacío de Productos y renderizado accesible. |
| `public/js/components/module-layout.js`, `public/css/components/module-layout.css` | Mostrar mensajes cuando existen y recuperar ese espacio al limpiarlos. |
| `views/layouts/workspace.ejs`, `public/css/app.css` | Carga de RecordDetails y sus estilos. |
| `public/css/pages/products.css` | Retira los estilos antiguos de detalle sustituidos por el componente. |

Los comentarios explican responsabilidades, formatos, foco y decisiones de presentación. Se editan las definiciones originales y se retira código obsoleto. No se transforma CSS en clases JavaScript; las clases coordinan componentes y las hojas CSS definen su presentación.

## Reutilización

RecordDetails admite texto, number, quantity, price y state. Los campos wide ocupan toda la fila. Todos los valores se insertan con textContent.

```javascript
const details = new ParisUI.RecordDetails({
  record: producto,
  fields: [
    { key: 'name', label: 'Producto', wide: true },
    { key: 'stock', label: 'Disponible', type: 'quantity' },
    { key: 'state', label: 'Estado', type: 'state' }
  ]
});
const modal = new ParisUI.Modal({
  title: 'Detalle del producto', icon: 'box', content: details.element,
  onClose: () => modal.destroy()
});
const close = ParisUI.Button.create({ label: 'Cerrar' });
close.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
modal.footer.append(close);
modal.open(botonQueAbrio);
```

En formularios usar isDirty y FormController como ProductForm. Para errores usar Message o ParisModule.showMessage. Para avisos breves usar NotificationCenter. El getter closeButton de Modal mantiene compatibilidad con componentes existentes y devuelve el primer botón del pie, o el diálogo si aún no hay botones; ya no representa un botón en la cabecera.

## Instalación y Git

El paquete es acumulativo sobre U015 (`ff3fd73e57b7184cc716f8673bef5962d84068ae`) e incluye U016 (sidebar automático). Acepta archivos originales U015, archivos exactos del paquete U016 o U017 ya aplicado. No sobrescribe otras modificaciones sin revisar. El publicador acepta la base U015 o un commit U016 exacto verificado contra su manifiesto, y permite reintentar la publicación del commit U017 correspondiente.

1. Detener el servidor con Ctrl+C.
2. Extraer el ZIP y ejecutar `node aplicar-parche.js --proyecto "RUTA_DEL_PROYECTO"`.
3. Ejecutar `node publicar-github.js --proyecto "RUTA_DEL_PROYECTO"`.
4. Iniciar `node server.js` y recargar con Ctrl+F5.

El instalador respalda los archivos y ejecuta 35 pruebas simuladas. Restaura el respaldo si falla la aplicación o las pruebas. No ejecuta SQL de negocio, migraciones ni actualización de dependencias. El publicador limita el commit al manifiesto y no usa force. Los archivos de configuración, activación y respaldos quedan fuera del paquete.

Solo comprobar: `node aplicar-parche.js --proyecto RUTA --comprobar`.
Restaurar archivos: detener el servidor y ejecutar `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. La restauración no revierte commits publicados.

## Verificación

- 35 pruebas Node: aplicación, autenticación, permisos, frontend, navegación, Productos y migración simulada.
- 34 escenarios en Chromium: U009 (7), U010 (7), U012 (5), U015 (4), U016 (5) y U017 (6).
- Columnas exactas, números centrados, Inter, formatos compartidos, selección por teclado y acceso a las últimas categorías con barra oculta.
- Modal con icono, cierre en el pie, retorno de foco, sugerencias, descarte, guardado único, reintentos, errores persistentes, presentaciones y anidamiento.
- Pantallas de 1440, 1000, 768, 390 y 320px, cabeceras y pie visibles, contenido sin desbordar la página y texto interpretado como texto seguro.
- Instalador: respaldo, restauración, U015/U016, BOM/CRLF, archivos distintos, paquete incompleto, fallo de escritura, servidor abierto y repetición.
- Publicador con Git local ficticio, desde U015 y desde U016: verifica cambios exactos y conserva archivos ajenos. Las pruebas no realizan push.

Los registros y capturas de `vista-previa/` son ficticios. Falta comprobar la instalación en Windows y la publicación con la cuenta del equipo del usuario. Las pruebas de esta revisión no se conectan a su MySQL.
