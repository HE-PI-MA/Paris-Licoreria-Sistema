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
| Adaptación automática, menú móvil, perfil y logout | `public/js/components/sidebar.js` |
| Búsquedas, filtros, selectores y fechas | `public/js/components/filter-bar.js`, `search-select.js`, `date-range.js` |
| Ordenamiento y menú de acciones | `public/js/components/data-table.js`, `action-menu.js` |
| Medir navegación local | `scripts/diagnosticar-navegacion.js` |
| Texto del negocio en mayúsculas | `TextCase` en `public/js/components/ui-core.js`; marcar campos con `data-uppercase`. |
| Hamburguesa integrada en la cabecera | `views/components/sidebar-opener.ejs` y `views/components/module/header.ejs` |
| Datos de consulta en bloques | `public/js/components/record-details.js` y `public/css/components/record-details.css` |
| Mensajes compartidos | `public/js/components/module-layout.js` |
| Estilos y comportamiento de login/activación | `public/css/pages/auth.css` y `public/js/pages/` |
| Compilación y actualización de plantillas EJS | `src/core/TemplateCache.js` |
| Configuración general de Express y orden del middleware | `src/app.js` |

## Valores visuales vigentes — U017

Modificar las variables de `:root` en `sidebar.css`; `--module-space` está centralizada en `base/tokens.css`. Evitar bloques repetidos al final del archivo:

| Variable | Valor actual | Uso |
| --- | --- | --- |
| `--module-space` | `10px` | Espaciado compartido del cuerpo de módulos. |
| `--sidebar-full-logo-height` | `112px` | Caja de imagen completa; compensa márgenes transparentes para llenar la cabecera. |
| `--sidebar-symbol-logo-height` | `70px` | Símbolo del menú contraído. |
| `--sidebar-width` | `14rem` | Ancho expandido. |
| `--sidebar-rail` | `5.5rem` | Ancho contraído. |
| `--sidebar-brand-height` | Cabecera menos 1px | Bloque de marca: 83px. |
| `--sidebar-header-height` | `84px` | Cabecera del menú; altura mínima compartida con la cabecera del módulo. |

Con raíz de 16px, el ancho expandido es 224px y el contraído 88px. Ambas cabeceras del sidebar conservan 84px. Las alturas de imagen incluyen márgenes transparentes internos. En móvil la hamburguesa se integra en la cabecera del módulo; no hay una segunda barra. Los controles pueden pasar a otra fila para evitar desbordamientos.

Desde U016, CSS selecciona el modo antes de ejecutar JavaScript: más de `75rem` muestra el menú completo, entre `48rem` y `75rem` muestra iconos, y hasta `48rem` usa el panel móvil. `Sidebar` observa los mismos límites mediante `matchMedia`; si se cambian, actualizar ambos archivos. No hay un ajuste manual ni dependencia de localStorage. La marca no es un enlace; Inicio conserva su opción de navegación. El cierre táctil móvil queda junto al panel, fuera de la marca.

Las imágenes originales están en `public/img/login/paris-login-logo.webp` y `public/img/brand/paris-isologo.png`. CSS conserva sus proporciones con `object-fit: contain`; no corta el logo para producir el símbolo.

La fuente del espacio de trabajo es Inter local. Los iconos comunes son SVG locales de Bootstrap Icons; conservar `public/licenses/bootstrap-icons-LICENSE.txt`. Los estilos base de autenticación tienen su propia escala de espaciado: no convertir indiscriminadamente todos los controles a un único padding.

La tabla usa filas uniformes y conserva el desplazamiento con barra oculta. El contador solo se anuncia a lectores de pantalla; los controles del pie siguen disponibles cuando son necesarios. Consultar [U015](27_AJUSTES_VISUALES_U015.md) para las variantes del selector y las reglas de mayúsculas; [U014](26_TABLAS_Y_ESTILO_U014.md) documenta carga, numeración y prioridades.

## Cómo documentar

Explicar responsabilidades, entradas, salidas, reglas y motivos de las decisiones. Los comentarios del código cubren puntos como la rotación de sesión, revalidación de usuario, autorización de URL, caché de activación, foco del menú móvil y selección de plantillas.

No comentar cada asignación obvia ni mantener listas de números de línea: cambian al editar y duplican el código. Para localizar una función, buscar su nombre y su archivo. Mantener el comentario junto al bloque que explica.

## Al desarrollar el contenido

Conservar el marco común y editar la vista del módulo correspondiente. Agregar rutas, controlador, servicio y repositorio cuando la operación lo necesite. Declarar y comprobar permisos, validar entradas y usar parámetros SQL. Habilitar controles solo cuando su acción funcione.

Los include de EJS proceden de la configuración del servidor. Los datos de usuario se imprimen con `<%= ... %>` para escaparlos. `<%- include(...) %>` se reserva para componentes controlados; no renderizar texto recibido como HTML.

`ParisModule.showMessage('loading', 'Cargando…')` activa `aria-busy`; los otros tipos son info, success, warning, error y empty. `clearMessage()` oculta avisos y termina la carga. Los mensajes usan `textContent`.

## Verificación y Git

Usar las pruebas existentes para comprobar sesión, licencia, permisos y páginas compartidas. Añadir pruebas cuando aparezcan operaciones de negocio o se corrija un fallo concreto. La prueba MySQL requiere una base desechable independiente; no activar esa prueba contra datos reales.

Preparar únicamente los archivos revisados. Revisar el diff y conservar `.env`, claves, activación y respaldos fuera del commit. El paquete U017 incluye un publicador que verifica los archivos y limita el commit al manifiesto. Un push fallido deja el commit local disponible para reintentar, sin usar force.

## Organización JavaScript desde U008

Modificar el flujo común de login/activación en AuthForm, y sus reglas específicas en LoginPage o ActivationPage. Sidebar y ModuleLayout agrupan estado y métodos de sus componentes. Mantener `auth-form.js` antes del script de página; `sidebar.js` se carga con `defer`, sin un script previo de preferencia.

Las clases no reemplazan los componentes EJS ni las hojas CSS. La guía `18_ORGANIZACION_POO_U008.md` describe esa separación. Usar `node --test tests/frontend.test.js` para comprobar los eventos y el estado de las clases con dobles de elementos; las comprobaciones visuales se realizan en el navegador de la instalación.

## Componentes compartidos desde U009

Consultar `20_COMPONENTES_COMPARTIDOS_U009.md` antes de desarrollar Productos. Reutilizar Button, Message, Modal, Confirm, FormController, NotificationCenter y DataTable. La clase propia del módulo coordina las operaciones y conserva las llamadas al servidor. El pie de paginación pertenece a DataTable.

Cada archivo nuevo o modificado lleva un comentario inicial en español con su propósito, y comentarios en las decisiones relevantes. CSS agrupa las definiciones originales por componente. Los iconos JavaScript proceden de las plantillas EJS del catálogo local.

Para filtros y listados nuevos, consultar `docs/21_FILTROS_SELECTORES_Y_LISTADOS_U010.md`.

## Auditoría U011

El mapa `23_MAPA_ARCHIVOS_Y_COMENTARIOS.md` identifica la responsabilidad de cada archivo JavaScript y hoja de estilo. Al añadir código, documentar propósito y contratos; comentar decisiones de seguridad, foco, concurrencia o recuperación cuando ayuden a mantenerlo. No convertir datos de configuración o funciones sin estado en clases vacías.

Las hojas de autenticación se enlazan únicamente en login y activación; no volver a importarlas desde `app.css`. Reutilizar `.app-sr-only` para texto accesible oculto.

Después de editar una vista EJS en desarrollo, TemplateCache invalida las funciones compiladas. Si la carpeta está en un recurso de red que no comunica cambios, reiniciar el servidor o desactivar la caché al construir App con `{ templateCache: false }`. En producción, reiniciar el proceso al desplegar.

## Productos y componentes U017

Consultar [U017](29_PRODUCTOS_Y_MODALES_U017.md). Modal admite un icono local y cierra mediante su pie; conservar Cancelar/Cerrar y requestClose para comprobar cambios pendientes. RecordDetails reutiliza ValueFormat y muestra texto seguro. La alineación numérica es centrada con la misma Inter del listado. SearchSelect se limpia editando su texto. ModuleLayout oculta su región cuando no hay aviso, pero mantiene los errores accesibles.
