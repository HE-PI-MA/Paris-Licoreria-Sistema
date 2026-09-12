# U009 — Componentes compartidos de Licorería París

## Revisión de la base

Se revisó la rama main de HE-PI-MA/Paris-Licoreria-Sistema, commit 59dd508af334f1383bbc45a8fad1083902075c11 (U008A). La copia de trabajo coincide con los archivos de ese commit, considerando los saltos de línea de Windows. No hay AGENTS.md en el árbol del repositorio. Se siguieron las guías de mantenimiento, organización con clases y espacio completo de U007–U008A, además de las instrucciones del usuario.

| Componente | Situación encontrada | Trabajo realizado |
| --- | --- | --- |
| Colores y tipografía | Variables existentes, Inter e imágenes locales | Se conservan los colores; se reúnen las variables en un bloque y el espacio de módulo sigue en 10 px. |
| Iconos | Catálogo EJS local de Bootstrap Icons con licencia MIT | Se reutiliza para JavaScript mediante plantillas; se añaden editar y eliminar del mismo catálogo. |
| Botones | Reglas en forms.css y reglas específicas repetidas en module-layout.css | Una definición en buttons.css: principal, secundario, peligroso, icono y procesamiento. |
| Formularios | Campo básico y estilos propios del login | Campos, selectores, textarea, ayudas, errores y FormController para los módulos. |
| Mensajes | ModuleLayout y estilos de avisos separados | Message comparte la presentación; se conserva la API ParisModule. |
| Modales y confirmaciones | Sin componente general | Modal y Confirm con cabecera, cuerpo, pie, teclado, foco y descarte de cambios. |
| Notificaciones flotantes | Sin componente | NotificationCenter reutiliza Message, con cierre y duración controlados. |
| Tablas | Sin componente general | DataTable con paginación local o por servidor, estados, formatos y acciones delegadas. |
| Marco de módulo | Cuatro áreas y alto disponible de U008A | Se conserva; DataTable incorpora su pie dentro del cuerpo del listado. |
| Autenticación y menú | Clases AuthForm, Sidebar y permisos del servidor | Se mantiene su comportamiento y cobertura de pruebas. |

Los comentarios se escriben en español, al inicio de cada archivo creado o modificado y en las responsabilidades y decisiones que necesitan explicación. Los archivos JSON no admiten comentarios; su contenido se explica en la documentación.

## Archivos y orden de carga

Las clases se publican en window.ParisUI. workspace.ejs carga, con defer, ui-core.js, messages.js, modal.js, form-controller.js, data-table.js y module-layout.js, antes de la clase propia de la página. Desde U016, el ancho inicial del menú procede de CSS y se elimina sidebar-preference.js. Login y activación siguen utilizando AuthForm y sus scripts originales.

| Archivo | Responsabilidad |
| --- | --- |
| public/js/components/ui-core.js | Elementos con texto seguro, Icon y Button. |
| public/js/components/messages.js | Message y NotificationCenter. |
| public/js/components/modal.js | Modal y Confirm. |
| public/js/components/form-controller.js | FormController: validación, cambios pendientes y envío único. |
| public/js/components/data-table.js | DataTable: presentación, carga y paginación. |
| public/js/components/module-layout.js | Estado y avisos del módulo, con API compatible. |
| public/css/components/buttons.css | Botones, foco y procesamiento. |
| public/css/components/forms.css | Campos y errores; conserva las reglas necesarias de autenticación. |
| public/css/components/messages.css | Colores y presentación única de avisos y notificaciones. |
| public/css/components/modal.css | Tamaños y cuerpo desplazable del modal. |
| public/css/components/data-table.css | Tabla, estados, acciones y paginación. |
| views/components/ui-icons.ejs | Plantillas seguras de iconos para las clases JavaScript. |
| views/demo/components.ejs y public/js/pages/components-demo.js | Demostración con datos ficticios en memoria. |
| tests/support/application-fixture.js | Servidor ficticio compartido por pruebas HTTP y de navegador. |
| tests/ui-browser.test.js | Comprobación opcional de comportamiento y geometría en Chromium real. |

app.css importa los componentes. module-layout.css solo mantiene la distribución de las áreas y los controles; sus colores de avisos y definiciones de botones se trasladaron a los componentes correspondientes. No se añadieron bloques de corrección al final para ocultar reglas anteriores.

## Botones y campos

Usar app-button junto con app-button--primary, app-button--secondary o app-button--danger. Guardar utiliza principal; Cancelar y Editar utilizan secundario; Eliminar y Descartar cambios utilizan peligroso. Activar y Desactivar pueden utilizar secundario y mostrar una confirmación según la operación.

```js
const { Button } = window.ParisUI;
const save = Button.create({ label: 'Guardar', icon: 'success', variant: 'primary', type: 'submit' });
const edit = Button.create({ label: 'Editar producto', icon: 'edit', iconOnly: true });
Button.setBusy(save, true, 'Guardando…');
Button.setBusy(save, false);
```

Un botón con solo icono requiere label. Button conserva los nodos y el estado desactivado original. La protección del envío corresponde a FormController; cambiar el aspecto de un botón no reemplaza la validación del servidor.

Campos: app-field agrupa app-label, app-input y app-field-help. Los select y textarea usan app-input. En formularios en columnas, usar app-form-grid; app-field--wide ocupa toda la fila. Los errores se generan como texto bajo el campo y se relacionan mediante aria-describedby y aria-invalid.

FormController recibe form, onSubmit, onSuccess, validate, alert y modal. validate devuelve un objeto cuyas claves son los nombres de los campos y cuyos valores son mensajes. onSubmit recibe valores y un AbortSignal, y devuelve una promesa. Puede lanzar un error con fieldErrors para presentar errores del servidor. El aviso general permanece visible si hay un fallo de conexión. Un envío en curso bloquea campos y botones asociados; Guardar muestra Guardando… y los valores se conservan cuando hay un error. Al completarse, se registra el formulario como guardado antes de ejecutar onSuccess.

## Modal y confirmación

```js
const { Modal, FormController, Button, Confirm } = window.ParisUI;
// form es un formulario creado por la vista del módulo; debe tener un id único.
let controller;
const modal = new Modal({
  title: 'Datos del producto', size: 'medium', content: form,
  isDirty: () => controller?.isDirty(),
  onClose: () => { controller?.destroy(); modal.destroy(); }
});
const cancel = Button.create({ label: 'Cancelar' });
const save = Button.create({ label: 'Guardar', icon: 'success', variant: 'primary', type: 'submit' });
save.setAttribute('form', form.id);
cancel.addEventListener('click', () => modal.requestClose(), { signal: modal.events.signal });
modal.footer.append(cancel, save);
modal.open(buttonThatOpenedIt);
controller = new FormController({
  form, modal,
  onSubmit: (values, { signal }) => productService.save(values, { signal }),
  onSuccess: () => { modal.close(); table.refresh(); }
});
```

El ejemplo describe la integración futura: form, productService, table y buttonThatOpenedIt los proporciona la clase Productos. U009 no implementa productService ni una API de productos.

Tamaños: small, medium y large. El modal se adapta a la ventana; los formularios largos desplazan su cuerpo manteniendo visibles cabecera y pie. data-modal-initial-focus elige el foco inicial; de lo contrario se enfoca Cerrar. Tab y Shift+Tab permanecen dentro. Escape y Cerrar usan requestClose, que confirma si isDirty devuelve true. Durante el envío se bloquea el cierre. close se usa tras guardar, y destroy elimina eventos y nodos al finalizar.

```js
const accepted = await Confirm.ask({
  title: 'Eliminar producto', message: '¿Quieres eliminar este producto?',
  confirmLabel: 'Eliminar', danger: true
});
if (accepted) await productService.remove(productId);
```

La confirmación usa Modal. Cancelar recibe el foco inicial. No se emplean alert() ni confirm(). No se admite HTML recibido en content: una cadena se trata como texto; un nodo debe proceder de una vista o código controlado.

## Dónde mostrar cada mensaje

| Necesidad | Componente |
| --- | --- |
| Corregir un valor concreto | FormController.setErrors({ nombre: 'Mensaje' }). |
| Problema del formulario | Message creado dentro del formulario. |
| Aviso o carga del módulo | ParisModule.showMessage(tipo, texto). |
| Aviso breve tras completar una acción | NotificationCenter.show(tipo, texto). |
| Tomar una decisión | Confirm.ask(...). |

Tipos compartidos: info, success, warning, error, loading y empty. ParisModule conserva showMessage, clearMessage y resetMessage; la carga actualiza aria-busy en el contenido. Message también puede utilizarse por separado con create, show y clear.

Las notificaciones de éxito e información duran seis segundos por defecto; su duración se pausa al pasar el puntero o mantener el foco dentro, y al ocultar la pestaña. Errores, advertencias y carga permanecen hasta cerrarse de manera explícita. show devuelve { close }; al finalizar una carga, cerrar ese aviso y emitir el resultado. Los avisos se ubican en el diálogo superior cuando corresponde. destroy retira el centro y sus eventos.

## DataTable para Productos y otros módulos

```js
const table = new window.ParisUI.DataTable({
  container: document.querySelector('[data-products-table]'),
  caption: 'Productos', pageSize: 10,
  columns: [
    { key: 'nombre', label: 'Nombre', type: 'text' },
    { key: 'precio', label: 'Precio', type: 'price', currency: 'BOB' },
    { key: 'stock', label: 'Cantidad', type: 'quantity' },
    { key: 'estado', label: 'Estado', type: 'state', states: {
      ACTIVO: { label: 'Activo', tone: 'success' },
      INACTIVO: { label: 'Inactivo', tone: 'neutral' }
    } }
  ],
  getRowId: row => row.id_producto,
  actions: [
    { id: 'edit', label: row => 'Editar ' + row.nombre, icon: 'edit', iconOnly: true },
    { id: 'delete', label: row => 'Eliminar ' + row.nombre, icon: 'trash', iconOnly: true, variant: 'danger' }
  ],
  load: ({ page, pageSize, query, signal }) => productService.list({ page, pageSize, query, signal }),
  onAction: ({ action, record, button }) => productsPage.handleAction(action, record, button)
});
search.addEventListener('input', () => table.setQuery({ term: search.value }));
```

productService.list debe devolver { records, total }: registros de la página solicitada y total filtrado en el servidor. La primera página es 1; query admite los filtros que defina el módulo. El servidor deberá validar y limitar page/pageSize, aplicar los permisos y usar consultas parametrizadas. La tabla no conoce URLs ni realiza esas operaciones por sí misma.

Si se omite load, records representa una lista local completa; el buscador local filtra las columnas por query.term. En ese modo, setData sustituye los registros. En modo servidor usar refresh, no setData. setQuery vuelve a la primera página. Si se elimina la última fila de la última página, se consulta la última página válida. Las solicitudes anteriores se cancelan y sus respuestas tardías se ignoran incluso si la función load no respeta AbortSignal.

Tipos: text, number (decimals opcional), quantity, price y state. format(value, record) permite devolver texto personalizado; su resultado tampoco se interpreta como HTML. Los estados admiten tonos success, warning, error, info y neutral. Una tabla con acciones necesita identificadores únicos mediante id o getRowId. Cada acción tiene id y label; visible y disabled pueden controlar su disponibilidad (disabled admite booleano o función).

onAction puede ser asíncrono. Mientras se resuelve, se bloquean las acciones de esa fila. La clase del módulo debe mantener la promesa hasta completar su operación. Si no se proporciona onAction, se emite datatable:action con detail.action y detail.record; para operaciones asíncronas con bloqueo, utilizar onAction. destroy cancela la consulta y elimina eventos antes de reutilizar el contenedor. Solo se permite una instancia por contenedor.

El pie muestra rango, total, tamaño de página y navegación. El área de tabla contiene el desplazamiento horizontal cuando sea necesario; el cuerpo del documento no recibe un ancho fijo.

## Demostración

Abrir /demostracion/componentes después de iniciar sesión como administrador. La ruta exige licencia, sesión activa y rol ADMINISTRADOR, y no aparece en el menú operativo. No se habilitaron las operaciones de los módulos normales. La demostración crea 37 registros ficticios en memoria y simula una consulta por página, sin endpoints nuevos de negocio ni cambios de MySQL.

Permite probar búsqueda, filtro por estado, paginación, lista vacía, error y reintento, editar, activar/desactivar, eliminar con confirmación, formulario largo, fallo de guardado y cinco clases de notificación. Recargar restablece los datos. La prueba de formulario puede modificar esos ejemplos únicamente en memoria.

## Verificación

Las pruebas HTTP reutilizan el servidor ficticio: autenticación, sesión, licencia, CSRF, navegación, roles y acceso a la demostración. Las pruebas U008 de formularios y menú permanecen. El test de ModuleLayout carga ahora su dependencia Message.

Las pruebas opcionales de navegador cubren paginación, filtros, lista vacía y reintento; teclado y recuperación de foco; descarte de cambios; validación y doble envío; eliminación; texto seguro y respuestas atrasadas; duración de avisos; formulario largo y adaptación a 390, 768 y 1440 px. El servidor de pruebas no consulta una base real.

Ejecutar las pruebas de aplicación:

```powershell
npm test
```

Para repetir las de navegador en un equipo de desarrollo, instalar Playwright como herramienta de prueba y Chromium:

```powershell
npm install --no-save --package-lock=false playwright
npx playwright install chromium
$env:PARIS_UI_BROWSER_TESTS = "1"
node --test tests/ui-browser.test.js
Remove-Item Env:PARIS_UI_BROWSER_TESTS
```

Resultado de la preparación: 26 pruebas de aplicación aprobadas y 7 escenarios de Chromium real aprobados (el ejecutor cuenta además su prueba contenedora). Se revisaron capturas de la demostración, modal, login y Productos. La tabla de demostración ocupa 390 px sin desbordamiento del documento en una pantalla de 390 px; el modal móvil conserva su pie visible. Se ejecutó Chromium 152 en Linux. Falta confirmar la instalación y apariencia final en Windows; no se ejecutaron pruebas contra MySQL real.

Las operaciones futuras que modifiquen datos deben conservar la sesión y el token CSRF existente (meta csrf-token, cabecera X-CSRF-Token), validar los datos y aplicar permisos en el servidor. FormController delega esas solicitudes al servicio del módulo; no implementa una vía alternativa de autenticación.

Las herramientas de prueba no son dependencias de funcionamiento de los componentes. Estos utilizan archivos locales y no requieren CDN ni conexión a Internet. La integración opcional con MySQL real no forma parte de U009; tampoco se ha ejecutado en el equipo Windows del usuario.

## Fuentes de los iconos añadidos

Se conserva public/licenses/bootstrap-icons-LICENSE.txt. Los iconos adicionales proceden de [pencil-fill](https://github.com/twbs/icons/blob/v1.13.1/icons/pencil-fill.svg) y [trash-fill](https://github.com/twbs/icons/blob/v1.13.1/icons/trash-fill.svg), Bootstrap Icons 1.13.1, licencia MIT.
