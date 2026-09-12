# Hover compartido y limpieza del código — U020

## Qué se corrigió

El menú asignaba colores con `.app-action-menu-panel .app-button`, mientras las variantes secundaria y peligrosa tenían sus propias reglas de hover. Al pasar el cursor esas reglas competían: algunos botones perdían su color y otros, como Eliminar, se oscurecían.

Ahora `buttons.css` es la única fuente de apariencia de los botones de acción: relleno, texto, borde, tamaño, iconos, foco, bloqueo y hover. Las variantes declaran variables de color y comparten el mismo efecto de Eliminar: relleno más oscuro y borde del color del texto, sin mover ni agrandar el control. Los botones desactivados o procesando no reaccionan al hover. Se conserva la preferencia de movimiento reducido.

Nuevo producto, Acciones, Guardar, Cancelar, botones de tabla, opciones del menú, confirmaciones, paginación y cierre de notificaciones utilizan esta definición. Ingresar también usa `app-button app-button--primary`; auth.css conserva solamente su tamaño y tipografía específicos. Los controles de navegación y mostrar contraseña conservan las clases de sus componentes, cuyo aspecto y función son distintos de una acción del catálogo.

No se agregan reglas al final para ocultar el problema. ActionMenu conserva únicamente la disposición y posición de su panel. Button recibe el tono y genera una clase CSS; Productos declara qué acción necesita, sin asignar colores desde JavaScript.

## Limpieza realizada

| Hallazgo | Corrección |
| --- | --- |
| Hover, colores y foco de botones distribuidos entre varias hojas | Apariencia centralizada en buttons.css. ActionMenu selecciona la variante mediante Button. |
| Campos del buscador y del modal redefinidos en sus contenedores | forms.css define las pieles compartidas `app-fields--toolbar` y `app-fields--modal`; los contenedores solo las aplican. |
| `product-form-wide` repetía `app-field--wide` | Productos utiliza la clase común existente. |
| Selector leía las mismas opciones en dos bloques | SearchSelect utiliza `readOptions()` al crear y actualizar el control. |
| Estado escrito pero nunca leído | Retirados `SearchSelect.busy`, `SearchSelect.emptyOption` y `ProductsPage.element`. El bloqueo real, la opción vacía y el contenedor recibido siguen funcionando. |
| La tabla continua creaba controles paginados desconectados del DOM | DataTable construye y actualiza esos controles solamente en modo pages. El modo scroll conserva carga por bloques, reintentos y anuncios accesibles. |
| Tonos dinámicos resueltos únicamente en menús | DataTable resuelve la configuración de cada acción una vez, tanto para menú como para botones independientes. |
| Altura del menú calculada en JavaScript sin necesitar medidas de elementos | El límite vertical pasa a action-menu.css. |
| `.demo-filter` no tenía referencias | Regla retirada. |
| 14 variables CSS antiguas sin referencias | Retiradas de base/tokens.css. Se conservan los tokens utilizados y los colores de marca. |
| Tres métodos sin llamadas ni contrato documentado | Retirados `ActivationRepository.getActivationPath()`, `LicenseRepository.getLicensePath()` y `MachineFingerprint.getDisplayId()`. La lectura de archivos, las rutas privadas, generate y la verificación del equipo no cambian. |

Los tokens retirados son `--app-primary-strong`, `--app-primary-soft`, `--app-accent`, `--app-radius-md`, `--app-radius-lg`, `--app-shadow-card`, `--app-shadow-focus`, `--app-s1`, `--app-s10`, `--app-black-glass`, `--app-gold-border`, `--app-login-muted`, `--app-login-input` y `--app-login-shadow`.

## Alcance de la revisión

Se revisaron referencias en 66 archivos JavaScript de aplicación/arranque/scripts, 16 CSS y 22 EJS. El ZIP coincide con la versión U019 de GitHub salvo BOM/saltos de línea en dos documentos históricos. No se encontró AGENTS.md; se siguió la guía de mantenimiento del proyecto.

No hay atributos `style` ni bloques `<style>` en las vistas EJS. Las clases JavaScript de página no escriben estilos. Sidebar y SearchSelect conservan medidas y coordenadas calculadas; ActionMenu conserva las coordenadas del panel. Son cálculos del componente compartido para evitar recortes y permitir el teclado, no colores o diseños particulares de un módulo.

La revisión distingue código sin referencias de API pública: `DataTable.setSort()` y `setData()` se conservan porque están documentados y comprobados para reutilizar la tabla. Las variantes de modal, estados y botones se construyen dinámicamente y tampoco son CSS sin uso. Se conservan funciones puras, callbacks y configuraciones que tienen una responsabilidad; no necesitan una clase vacía.

Las hojas de página contienen distribución específica. Los componentes comunes mantienen la apariencia de controles, modales, tablas y mensajes. No se han revisado ni alterado paquetes de terceros o datos del negocio. La búsqueda estática y las pruebas no garantizan ausencia de todos los errores posibles.

## Cómo reutilizar los botones

```javascript
const nuevo = ParisUI.Button.create({
  label: 'Nuevo producto', icon: 'plus', variant: 'primary'
});
const editar = ParisUI.Button.create({
  label: 'Editar', icon: 'edit', tone: 'edit'
});
const eliminar = ParisUI.Button.create({
  label: 'Eliminar', icon: 'trash', variant: 'danger'
});
```

Los tonos compartidos son info, edit, catalog, success, warning y danger. Primary es dorado y secondary es neutro. Notice sirve para cerrar notificaciones sobre un fondo de color. `tone`, cuando se indica, selecciona la variante visual. `iconOnly: true` conserva un nombre accesible. `Button.setBusy(boton, true, 'Guardando…')` bloquea el botón sin perder sus nodos; `false` restaura el estado anterior. FormController ya aplica este comportamiento durante el envío.

ActionMenu continúa recibiendo items y onSelect. DataTable recibe actions y onAction. Las clases de Productos y futuros módulos son responsables de sus operaciones, nunca Button o ActionMenu.

En EJS se pueden aplicar directamente las mismas clases:

```html
<button type="button" class="app-button app-button--primary">Guardar</button>
```

Las variantes pertenecen a buttons.css. No añadir un hover a products.css, action-menu.css o al script de página. Para formularios usar `app-form`, `app-form-grid`, `app-field`, `app-field--wide`, `app-label` y `app-input`. El placeholder continúa ocultándose al enfocar, conservando el valor escrito.

## Archivos y responsabilidades

- `public/css/components/buttons.css` y `public/js/components/ui-core.js`: apariencia y creación de botones.
- `public/css/components/action-menu.css` y `public/js/components/action-menu.js`: panel de opciones y teclado.
- `public/css/components/forms.css`, `module-layout.css`, `modal.css`, `public/js/components/modal.js` y `views/components/module/controls.ejs`: campos reutilizables y sus contenedores.
- `public/css/components/messages.css` y `public/js/components/messages.js`: notificaciones con cierre compartido.
- `public/css/components/filters.css` y `public/js/components/search-select.js`: selectores sin lectura duplicada.
- `public/css/components/data-table.css` y `public/js/components/data-table.js`: tabla paginada o continua sin controles sobrantes.
- `public/css/pages/products.css`, `public/js/pages/product-forms.js` y `products.js`: uso de las clases comunes.
- `public/css/pages/auth.css` y `views/auth/login.ejs`: Ingresar con el botón común.
- `public/css/base/tokens.css`, `public/css/pages/components-demo.css`, dos repositorios y MachineFingerprint: eliminación de definiciones sin referencias.
- `tests/brand-controls-browser.test.js`: regresión del hover, retorno al color original, dimensiones, teclado, iconos y bloqueo.
- `README.md`, la guía de mantenimiento y este documento: uso y resultados de la revisión.

`archivos/` contiene cada archivo modificado completo. `CAMBIOS.diff` permite revisar las diferencias. `manifest.json` enumera los archivos que instala y publica esta revisión. `vista-previa/` contiene imágenes con datos ficticios.

## Comprobaciones

- 35 pruebas Node aprobadas: sesión, licencia, CSRF, permisos, migración simulada, autenticación, caché, diagnóstico y contratos de Productos.
- 45 escenarios Chromium aprobados: U009 (7), U010 (7), U011 (4), U012 (5), U014 (6), U016 (5), U018 (6), U019/U020 (5). Los conteos excluyen las ocho pruebas padre.
- Se comprobó el hover de Nuevo producto, Acciones, cada opción real y variantes independientes. Texto y dimensiones permanecen estables; el fondo recupera su color al retirar el cursor. Los botones bloqueados no muestran el efecto.
- Se probaron login, modales, doble envío, foco, Escape, descarte de cambios, teclado de selectores y menú, filtros, scroll continuo, paginación, errores y reintentos. La lista larga de presentaciones incluye 68 registros ficticios y fallo de la segunda consulta sin duplicados.
- Compilación sintáctica de 86 archivos JavaScript, incluidas pruebas, y 22 plantillas EJS.
- Inspección de capturas de escritorio y campos; respaldo/restauración, incompatibilidad, escritura interrumpida, repetición del instalador y commit limitado a los archivos del parche.

La primera ejecución de ocho archivos de navegador a la vez tuvo dos tiempos de espera bajo carga (primera carga de demostración y captura). Ambos archivos pasaron ejecutados secuencialmente, sin cambiar la aplicación ni ampliar sus tiempos límite. Las comprobaciones nuevas de hover también pasaron.

No se conecta MySQL real ni se ejecuta DPAPI de Windows en este entorno. Las comprobaciones de datos usan repositorios y respuestas ficticias. La instalación Windows y el push del repositorio real se realizan desde el equipo del usuario.

## Instalación y publicación

Base U019: `404883d3b5ba685b59b1f18361e951f2fd914387` en HE-PI-MA/Paris-Licoreria-Sistema, rama main.

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Desde el proyecto, iniciar `node server.js` y recargar con Ctrl+F5.

El instalador valida la versión, respalda y aplica los archivos completos. Ejecuta las 35 pruebas Node y restaura si fallan. Conserva configuración, dependencias, licencia y datos. El publicador comprueba la base remota, crea un commit con los archivos del manifiesto y publica sin force. Si falla la publicación, conserva el commit local para reintentar.

Comprobar sin aplicar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`.
Restaurar archivos con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Esto no revierte commits ya publicados.
