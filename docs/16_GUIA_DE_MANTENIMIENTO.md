# Guía de mantenimiento del código

## Dónde hacer cada cambio

| Cambio | Archivo principal |
| --- | --- |
| Nombre, orden, icono y permiso de un módulo | `src/config/navigation.js` |
| Acción principal y plantilla del módulo | `src/config/module-layouts.js` |
| Proteger una página y devolver 403 | `src/routes/web.routes.js` |
| Preparar usuario, perfil y datos para EJS | `src/controllers/WebController.js` |
| Marco común y contenido por módulo | `views/layouts/workspace.ejs` y `views/<modulo>/content.ejs` |
| Cabecera, buscador y mensajes compartidos | `views/components/module/` |
| Cabecera, navegación y perfil del sidebar | `views/components/sidebar.ejs` |
| Iconos locales | `views/components/icon.ejs`; `sidebar-icon.ejs` adapta su uso en el menú |
| Tamaños, colores, espaciado y adaptación del sidebar | `public/css/components/sidebar.css` |
| Diseño de las cuatro áreas | `public/css/components/module-layout.css` |
| Colapsar, menú móvil, perfil y logout | `public/js/components/sidebar.js` |
| Restaurar preferencia antes del primer renderizado | `public/js/components/sidebar-preference.js` |
| Búsquedas, filtros, selectores y fechas | `public/js/components/filter-bar.js`, `search-select.js`, `date-range.js` |
| Ordenamiento y menú de acciones | `public/js/components/data-table.js`, `action-menu.js` |
| Medir navegación local | `scripts/diagnosticar-navegacion.js` |
| Mensajes compartidos | `public/js/components/module-layout.js` |
| Estilos y comportamiento de login/activación | `public/css/pages/auth.css` y `public/js/pages/` |
| Configuración general de Express y orden del middleware | `src/app.js` |

## Valores visuales vigentes

Modificar las variables de `:root` en `sidebar.css`; `--module-space` está centralizada en `base/tokens.css`. Evitar bloques repetidos al final del archivo:

| Variable | Valor actual | Uso |
| --- | --- | --- |
| `--module-space` | `10px` | Espaciado compartido del cuerpo de módulos. |
| `--sidebar-full-logo-height` | `135px` | Imagen con letras, menú expandido y móvil. |
| `--sidebar-symbol-logo-height` | `100px` | Símbolo del menú contraído. |
| `--sidebar-width` | `17.5rem` | Ancho expandido. |
| `--sidebar-rail` | `5.5rem` | Ancho contraído. |
| `--sidebar-brand-height` | Símbolo + 20 px | Bloque de marca: 120 px. |
| `--sidebar-header-height` | Bloque de marca | Cabecera expandida/móvil: 120 px. En escritorio contraído se agregan 2.5rem + .625rem para el botón inferior. |

Con raíz de 16 px, el ancho expandido es 280 px, el contraído 88 px y la cabecera contraída 170 px. Los 50 px del botón inferior solo se reservan en modo contraído. Las alturas de imagen incluyen sus márgenes transparentes internos.

Las imágenes originales están en `public/img/login/paris-login-logo.webp` y `public/img/brand/paris-isologo.png`. CSS conserva sus proporciones con `object-fit: contain`; no corta el logo para producir el símbolo.

La fuente del espacio de trabajo es Inter local. Los iconos comunes son SVG locales de Bootstrap Icons; conservar `public/licenses/bootstrap-icons-LICENSE.txt`. Los estilos base de autenticación tienen su propia escala de espaciado: no convertir indiscriminadamente todos los controles a un único padding.

## Cómo documentar

Explicar responsabilidades, entradas, salidas, reglas y motivos de las decisiones. Los comentarios del código cubren puntos como la rotación de sesión, revalidación de usuario, autorización de URL, caché de activación, foco del menú móvil y selección de plantillas.

No comentar cada asignación obvia ni mantener listas de números de línea: cambian al editar y duplican el código. Para localizar una función, buscar su nombre y su archivo. Mantener el comentario junto al bloque que explica.

## Al desarrollar el contenido

Conservar el marco común y editar la vista del módulo correspondiente. Agregar rutas, controlador, servicio y repositorio cuando la operación lo necesite. Declarar y comprobar permisos, validar entradas y usar parámetros SQL. Habilitar controles solo cuando su acción funcione.

Los include de EJS proceden de la configuración del servidor. Los datos de usuario se imprimen con `<%= ... %>` para escaparlos. `<%- include(...) %>` se reserva para componentes controlados; no renderizar texto recibido como HTML.

`ParisModule.showMessage('loading', 'Cargando…')` activa `aria-busy`; los otros tipos son info, success, warning, error y empty. `clearMessage()` oculta avisos y termina la carga. Los mensajes usan `textContent`.

## Verificación y Git

Usar las pruebas existentes para comprobar sesión, licencia, permisos y páginas compartidas. Añadir pruebas cuando aparezcan operaciones de negocio o se corrija un fallo concreto. La prueba MySQL requiere una base desechable independiente; no activar esa prueba contra datos reales.

Preparar únicamente los archivos revisados. Revisar el diff y conservar `.env`, claves, activación y respaldos fuera del commit. U007 incluye un publicador que verifica los archivos y limita el commit al manifiesto. Un push fallido deja el commit local disponible para reintentar, sin usar force.

## Organización JavaScript desde U008

Modificar el flujo común de login/activación en AuthForm, y sus reglas específicas en LoginPage o ActivationPage. Sidebar y ModuleLayout agrupan estado y métodos de sus componentes. Mantener `auth-form.js` antes del script de página y `sidebar-preference.js` antes de `sidebar.js`.

Las clases no reemplazan los componentes EJS ni las hojas CSS. La guía `18_ORGANIZACION_POO_U008.md` describe esa separación. Usar `node --test tests/frontend.test.js` para comprobar los eventos y el estado de las clases con dobles de elementos; las comprobaciones visuales se realizan en el navegador de la instalación.

## Componentes compartidos desde U009

Consultar `20_COMPONENTES_COMPARTIDOS_U009.md` antes de desarrollar Productos. Reutilizar Button, Message, Modal, Confirm, FormController, NotificationCenter y DataTable. La clase propia del módulo coordina las operaciones y conserva las llamadas al servidor. El pie de paginación pertenece a DataTable.

Cada archivo nuevo o modificado lleva un comentario inicial en español con su propósito, y comentarios en las decisiones relevantes. CSS agrupa las definiciones originales por componente. Los iconos JavaScript proceden de las plantillas EJS del catálogo local.

Para filtros y listados nuevos, consultar `docs/21_FILTROS_SELECTORES_Y_LISTADOS_U010.md`.
