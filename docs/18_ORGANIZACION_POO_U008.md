# U008 — Organización con clases

## Alcance

La lógica JavaScript de la interfaz se organiza con clases. El servidor ya utiliza clases para aplicación, controladores, servicios, repositorios y controles de acceso. Las configuraciones siguen representándose mediante datos y funciones auxiliares: organizar el sistema con POO no exige convertir cada dato o función en una clase.

CSS define presentación mediante selectores y propiedades; no tiene constructores ni objetos de programación. Se mantiene organizado por componentes y variables compartidas. Las vistas EJS representan la estructura HTML. No se presenta CSS como si fuera POO de JavaScript.

## Clases de la interfaz

| Clase | Archivo | Responsabilidad |
| --- | --- | --- |
| `AuthForm` | `public/js/components/auth-form.js` | Flujo común de formularios: mensajes, espera, envío JSON con CSRF y recuperación tras errores. |
| `LoginPage` | `public/js/pages/login.js` | Usuario/contraseña, mostrar u ocultar contraseña y redirección al inicio. Hereda de AuthForm. |
| `ActivationPage` | `public/js/pages/activation.js` | Código de activación, mensajes de licencia y redirección al login. Hereda de AuthForm. |
| `SidebarPreference` | `public/js/components/sidebar-preference.js` | Leer y guardar exclusivamente la preferencia de menú contraído. |
| `Sidebar` | `public/js/components/sidebar.js` | Estado y eventos del menú, móvil, teclado, ayudas, perfil y cierre de sesión. Utiliza SidebarPreference. |
| `ModuleLayout` | `public/js/components/module-layout.js` | Mensajes, errores y estado de carga de un módulo. |

Cada instancia mantiene las referencias a sus elementos y su estado. Los eventos invocan métodos conservando `this`. Login y activación comparten la implementación de envío y mensajes, con validación y respuestas específicas en sus subclases.

## Inicialización y dependencias

Login y activación cargan `auth-form.js` antes del script de su página; ambos usan `defer`. La preferencia del sidebar se lee desde el head antes de dibujar el espacio de trabajo; después se inicializa Sidebar. No se carga código remoto.

`window.ParisUI` expone únicamente las clases compartidas AuthForm y SidebarPreference. Las clases de página quedan dentro de su archivo. `window.ParisModule` conserva los métodos documentados showMessage, clearMessage y resetMessage; sus métodos mantienen el contexto de la instancia.

La clase base protege contra envíos simultáneos del mismo formulario. Un formulario deshabilitado no se envía desde sus eventos. La autorización efectiva continúa en el servidor; estos controles visuales no la sustituyen.

## CSS por componentes

| Ubicación | Uso |
| --- | --- |
| `public/css/base/tokens.css` | Variables generales de color, tipografía y espacios. |
| `public/css/base/reset.css` | Reglas base del navegador. |
| `public/css/components/forms.css` | Campos, botones y avisos compartidos. |
| `public/css/components/sidebar.css` | Sidebar, perfil y contenedor de trabajo. |
| `public/css/components/module-layout.css` | Cabecera, controles, contenido y mensajes. |
| `public/css/pages/auth.css` | Presentación de login y activación. |

U008 conserva los estilos aprobados. El logo completo sigue en 135 px, el símbolo en 100 px y el espaciado de módulos en 10 px. No se añaden overrides para cambiar estos valores.

## Desarrollo de los módulos

La estructura visual se mantiene compartida. Cuando se implemente un módulo, su clase de página coordinará los controles específicos y reutilizará los mensajes comunes. En el servidor sus clases de controlador, servicio y repositorio se incorporarán según las operaciones. U008 no implementa ventas, compras o formularios de catálogo nuevos.

## Verificación

25 pruebas aprobadas: las 18 de aplicación y migración más 7 de comportamiento JavaScript. Se comprueban validación y envío de login/activación, CSRF, recuperación tras fallos, bloqueo de doble envío, API de mensajes, almacenamiento de preferencia, ayudas, perfil por teclado, menú móvil y logout. Las páginas verifican el orden de carga de sus scripts compartidos.

Las pruebas de JavaScript utilizan dobles de elementos; no son una revisión visual en navegador. La integración opcional con MySQL real permanece omitida en el entorno de preparación. Las pruebas no ejecutan operaciones sobre la base instalada del usuario.

## Instalación y Git

El paquete U008 es acumulativo e incluye la limpieza y documentación de U007. Reconoce el CSS adjuntado por el usuario y las versiones previamente revisadas. El instalador guarda respaldo, ejecuta las 25 pruebas y puede restaurar los archivos anteriores.

El publicador prepara solo los cambios del manifiesto. Admite la base original de GitHub o el commit exacto producido por el publicador U007, cuyo contenido comprueba antes de continuar. Si la publicación falla, conserva el commit local y permite reintentar. No fuerza el historial.

Se conservan configuración privada, dependencias, licencia, migración y datos. Publicar desde PowerShell requiere la autenticación Git ya configurada en el equipo. Preparar este paquete no equivale a haberlo instalado ni publicado.
