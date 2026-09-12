# Mapa de archivos y comentarios — U011

Este mapa describe el código propio del proyecto. Las dependencias instaladas, las claves privadas y los datos de ejecución no forman parte del parche. Las guías U009 y U010 contienen los contratos completos de la base visual.

## JavaScript por responsabilidad

| Archivo | Clase o forma | Para qué sirve |
| --- | --- | --- |
| `src/app.js` | `App` | Compone Express: seguridad, sesiones, dependencias, rutas y plantillas. App.close libera sus recursos. |
| `src/config/database.js` | `Database` | Mantiene un único pool MySQL configurado desde el entorno; los repositorios reutilizan sus conexiones. |
| `src/config/module-layouts.js` | Funciones / configuración | Configura acción principal, buscador y contenido de cada módulo con plantillas permitidas por el servidor. |
| `src/config/navigation.js` | Funciones / configuración | Catálogo de navegación y roles permitidos: lo comparten el sidebar y la autorización de las páginas. |
| `src/config/runtime.js` | `ConfigurationError` | Valida la configuración del servidor, secretos, origen HTTPS y proxies antes de aceptar peticiones. |
| `src/controllers/AuthController.js` | `AuthController` | Responde al login, logout y consulta de sesión; regenera el identificador al autenticar y evita exponer errores internos. |
| `src/controllers/LicenseController.js` | `LicenseController` | Expone el estado y la activación de la licencia; delega la validación criptográfica a los servicios. |
| `src/controllers/SystemController.js` | `SystemController` | Entrega el estado técnico permitido por sus rutas sin mostrar credenciales ni detalles de conexión. |
| `src/controllers/WebController.js` | `WebController` | Renderiza las páginas; la licencia y la sesión se exigen en web.routes.js. |
| `src/core/LicensePayload.js` | `LicensePayload` | Serializa únicamente los campos firmados de la licencia en un orden estable para verificar su firma. |
| `src/core/LicenseSchema.js` | `LicenseSchema` | Valida tipos, fechas y campos de la licencia antes de comprobar su firma y vigencia. |
| `src/core/LicenseVerifier.js` | `LicenseVerifier` | Verifica la firma Ed25519 con la clave pública local; reutiliza la clave, nunca una decisión de acceso. |
| `src/core/TemplateCache.js` | `TemplateCache` | Reutiliza funciones EJS compiladas, nunca páginas ni datos del usuario. En desarrollo invalida las plantillas al editar vistas; si la vigilancia falla, desactiva la caché. |
| `src/middleware/AuthMiddleware.js` | `AuthMiddleware` | Revalida el usuario de la sesión en cada petición; rechaza cuentas inactivas y distingue páginas de API. |
| `src/middleware/CsrfMiddleware.js` | `CsrfMiddleware` | Emite el token de sesión y comprueba token, origen y JSON en las escrituras de la API. |
| `src/middleware/LicenseMiddleware.js` | `LicenseMiddleware` | Exige activación válida antes de continuar y dirige al acceso correspondiente cuando falla. |
| `src/middleware/RoleMiddleware.js` | `RoleMiddleware` | Utilidad probada para futuras rutas de API; las páginas usan navigation.allowed. |
| `src/middleware/rateLimits.js` | Funciones / configuración | Crea límites independientes por tipo de solicitud para reducir abuso antes de las verificaciones costosas. |
| `src/repositories/ActivationRepository.js` | `ActivationRepository` | Lee y guarda los bytes protegidos de activación en su ruta privada mediante reemplazo temporal. |
| `src/repositories/AuthRepository.js` | `AuthRepository` | Consulta usuarios y roles con parámetros SQL; el servicio decide si pueden autenticarse. |
| `src/repositories/LicenseRepository.js` | `LicenseRepository` | Lee la licencia instalada desde su ruta privada y distingue ausencia de errores de lectura. |
| `src/repositories/SystemRepository.js` | `SystemRepository` | Comprueba disponibilidad de MySQL con una consulta mínima, sin leer registros del negocio. |
| `src/routes/auth.routes.js` | `AuthRoutes` | Declara las rutas de autenticación y el orden de los controles de licencia y sesión. |
| `src/routes/license.routes.js` | `LicenseRoutes` | Conecta las rutas HTTP de consulta y activación con LicenseController. |
| `src/routes/system.routes.js` | `SystemRoutes` | Declara las rutas técnicas del sistema y sus restricciones de exposición. |
| `src/routes/web.routes.js` | `WebRoutes` | Registra páginas públicas, módulos autorizados y la demostración exclusiva de administración. |
| `src/services/ActivationService.js` | `ActivationService` | Valida la activación vinculada al equipo; reutiliza el descifrado solo mientras sus bytes permanezcan iguales. |
| `src/services/AuthService.js` | `AuthService` | Autentica con bcrypt y obtiene la identidad pública actualizada; nunca devuelve el hash al cliente. |
| `src/services/LicenseService.js` | `LicenseService` | Coordina esquema, firma, vigencia y equipo para decidir si la licencia instalada es válida. |
| `src/services/MySqlSessionStore.js` | `MySqlSessionStore` | Guarda las sesiones y su expiración en MySQL, compartidas entre instancias. |
| `src/services/SystemService.js` | `SystemService` | Obtiene el estado del sistema mediante su repositorio y concentra esa consulta técnica. |
| `src/utils/MachineFingerprint.js` | `MachineFingerprint` | Obtiene la huella estable del equipo de forma asíncrona y comparte el cálculo entre solicitudes concurrentes. |
| `src/utils/NavigationDiagnostics.js` | `NavigationDiagnostics` | Medición opcional por petición, sin registrar usuarios, cookies, consultas SQL ni credenciales. Solo la usa scripts/diagnosticar-navegacion.js; las comprobaciones originales se ejecutan completas. |
| `src/utils/WindowsProtection.js` | `WindowsProtection` | Protege y recupera la activación con DPAPI de Windows; ejecuta PowerShell sin bloquear el hilo de Node. |
| `src/utils/safeLog.js` | Funciones / configuración | Registra solo categorías permitidas y un identificador; nunca serializa errores, cuerpos ni cabeceras. |
| `public/js/components/action-menu.js` | `ActionMenu` | Menú de acciones reutilizable. Conserva nombres accesibles, flechas, Escape y retorno del foco. El módulo recibe la opción elegida; el menú nunca realiza operaciones del negocio. |
| `public/js/components/auth-form.js` | `AuthForm` | Comportamiento compartido por login y activación: mensajes, envío y espera. |
| `public/js/components/data-table.js` | `DataTable` | Tabla compartida con paginación local o una función de consulta al servidor. Presenta valores como texto. Las acciones se delegan a la clase del módulo mediante onAction. |
| `public/js/components/date-range.js` | `DateRange` | Rango de fechas sin dependencias: usa controles nativos y valores YYYY-MM-DD, sin convertir zonas horarias. |
| `public/js/components/filter-bar.js` | `FilterBar` | Conecta el buscador del módulo con filtros configurables, chips y limpieza. Reutiliza Modal, FormController, DateRange y SearchSelect; solo comunica una consulta al módulo. |
| `public/js/components/form-controller.js` | `FormController` | Controla formularios de módulos: validación por campo, cambios pendientes y envío único. La función onSubmit pertenece al módulo; esta clase no conoce rutas ni escribe datos. |
| `public/js/components/messages.js` | `Message`, `NotificationCenter` | Mensajes comunes para módulos, formularios y notificaciones. Message presenta el aviso; NotificationCenter administra únicamente su posición y duración. |
| `public/js/components/modal.js` | `Modal`, `Confirm` | Diálogo reutilizable con cabecera, cuerpo desplazable y pie. Controla teclado, foco y descarte de cambios; Confirm utiliza exactamente este mismo diálogo. |
| `public/js/components/module-layout.js` | `ModuleLayout` | Coordina los avisos y el estado de carga del módulo mediante el presentador Message. |
| `public/js/components/search-select.js` | `SearchSelect` | Selector con búsqueda local o por páginas del servidor. Conserva el select original para FormData. El cuadro visible controla teclado y foco; las respuestas antiguas se cancelan y nunca pisan la búsqueda actual. |
| `public/js/components/sidebar.js` | `Sidebar` | Adaptación al ancho, foco, ayudas y perfil del menú lateral. Los permisos siguen en el servidor. |
| `public/js/components/ui-core.js` | `Icon`, `Button` | Utilidades visuales compartidas: elementos con texto seguro, iconos locales y botones. Los iconos se clonan de plantillas EJS controladas; los datos nunca se interpretan como HTML. |
| `public/js/pages/activation.js` | `ActivationPage` | Especializa el formulario común con el código y los mensajes de licencia. |
| `public/js/pages/components-demo.js` | `ComponentsDemo` | Demostración de componentes compartidos; todos los datos son ficticios y viven en memoria. Simula consultas por página y operaciones lentas sin acceder a APIs de negocio ni a MySQL. |
| `public/js/pages/login.js` | `LoginPage` | Define los campos y las acciones propias de la página de inicio de sesión. |
| `scripts/create-admin.js` | Funciones / configuración | Alta inicial de administrador desde consola; valida contraseña y rol sin imprimir el secreto introducido. |
| `scripts/db-check.js` | Funciones / configuración | Comprueba fechas de caja, pagos, stock y claves de demostración mediante consultas de solo lectura. |
| `scripts/diagnosticar-navegacion.js` | `DiagnosticApp` | Inicia el servidor local con mediciones. Detener el servidor normal antes de ejecutar este archivo. |
| `scripts/migrate.js` | Funciones / configuración | Aplica o reanuda U004 con registro y verificación de su huella; requiere respaldo y servidor detenido. |
| `scripts/sql.js` | Funciones / configuración | Separa las sentencias de los archivos SQL del proyecto, respetando sus bloques DELIMITER. |

`server.js` inicia HTTP/HTTPS, valida la conexión y el esquema antes de escuchar y cierra recursos al detenerse. Utiliza una función de arranque con inyección de App para permitir el diagnóstico.

## CSS por componente

| Archivo | Para qué sirve |
| --- | --- |
| `public/css/app.css` | Entrada de estilos: base y controles compartidos. Las páginas de acceso cargan su propio CSS. |
| `public/css/base/reset.css` | Normalización básica y texto accesible que no necesita mostrarse visualmente. |
| `public/css/base/tokens.css` | Variables compartidas de color, tipografía y espaciado del sistema. |
| `public/css/components/action-menu.css` | El menú aparece en la capa de popovers, sin aumentar el ancho ni recortar la tabla. |
| `public/css/components/buttons.css` | Botones de módulos: variantes, iconos, foco por teclado y estado de procesamiento. |
| `public/css/components/data-table.css` | Tabla semántica con desplazamiento contenido, estados y pie de paginación compartidos. |
| `public/css/components/filters.css` | Filtros activos, selectores y fechas comparten la tipografía y los controles de forms.css. |
| `public/css/components/forms.css` | Campos comunes y validación. Los estilos propios del login permanecen en auth.css. |
| `public/css/components/messages.css` | Avisos de módulos, formularios y notificaciones: mismos colores y tipos de mensaje. |
| `public/css/components/modal.css` | Modal general: cabecera y pie visibles; el cuerpo largo tiene desplazamiento propio. |
| `public/css/components/module-layout.css` | Marco reutilizable: cabecera, controles, cuerpo flexible y mensajes del módulo. |
| `public/css/components/sidebar.css` | Sidebar, perfil y espacio de módulos. Cabecera de 84px, imagen completa de 112px y símbolo de 70px; anchos de 14rem y 5.5rem. Modos automáticos en 48rem y 75rem, coordinados con Sidebar. |
| `public/css/pages/auth.css` | Estilos del login y de Activación; se cargan únicamente en esas dos páginas. |
| `public/css/pages/components-demo.css` | Distribución exclusiva de la demostración; los controles utilizan los componentes globales. |

## Vistas EJS

| Archivo | Para qué sirve |
| --- | --- |
| `views/auth/activation.ejs` | Activación del equipo: muestra la licencia y permite enviar el código cuando corresponde. |
| `views/auth/login.ejs` | Acceso al sistema: formulario protegido por CSRF y estilos propios de autenticación. |
| `views/caja/content.ejs` | Cuerpo de caja: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/components/icon.ejs` | Catálogo de iconos SVG locales; solo acepta identificadores definidos por el proyecto. |
| `views/components/module/controls.ejs` | Buscador y filtros compartidos; se habilitan únicamente para páginas implementadas. |
| `views/components/module/header.ejs` | Cabecera compartida: título del módulo y su acción principal. |
| `views/components/module/messages.ejs` | Regiones accesibles de ModuleLayout; comparten presentación con los avisos de formulario. |
| `views/components/module/placeholder.ejs` | Estado de preparación reutilizable mientras el módulo no tenga operaciones conectadas. |
| `views/components/sidebar-icon.ejs` | U006D: el sidebar utiliza el mismo catalogo de iconos que los modulos. |
| `views/components/sidebar.ejs` | Compone marca, navegación autorizada y perfil del menú lateral adaptable. |
| `views/components/ui-icons.ejs` | Plantillas para JavaScript; las formas proceden del mismo catálogo local usado por el sidebar. |
| `views/compras/content.ejs` | Cuerpo de compras: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/dashboard/content.ejs` | Saludo inicial del espacio de trabajo; el resumen operativo sigue pendiente. |
| `views/demo/components.ejs` | Demostración aislada: la clase de página mantiene los registros ficticios en memoria. |
| `views/inventario/content.ejs` | Cuerpo de inventario: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/layouts/workspace.ejs` | Marco autenticado: sidebar, componentes comunes y cuerpo específico de cada módulo. |
| `views/productos/content.ejs` | Cuerpo de productos: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/proveedores/content.ejs` | Cuerpo de proveedores: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/reportes/content.ejs` | Cuerpo de reportes: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/usuarios/content.ejs` | Cuerpo de usuarios: reutiliza el estado de preparación hasta conectar sus operaciones. |
| `views/ventas/content.ejs` | Cuerpo de ventas: reutiliza el estado de preparación hasta conectar sus operaciones. |

## Datos, recursos y pruebas

- `database/migrations/U004.sql`: migración ya instalada, protegida por su huella. No editarla para preparar otra migración.
- `database/permisos_minimos.sql`: guía del usuario MySQL de ejecución y sus permisos actuales.
- `tests/fixtures/v2/`: base y datos ficticios para integración desechable; no son scripts para reiniciar la instalación.
- `tests/support/application-fixture.js`: servidor con sesión y licencia simuladas, sin conexión a la base del negocio.
- `tests/audit.test.js` y `tests/audit-browser.test.js`: regresiones de las correcciones U011. Las demás pruebas conservan la cobertura de las revisiones anteriores.
- `public/img/`, `public/fonts/`, `public/licenses/`: imágenes, fuentes y sus licencias locales.
- `.env.example`: ejemplo sin secretos; `.gitignore`: exclusiones de archivos privados/de ejecución; `package.json` y `pnpm-lock.yaml`: comandos y dependencias reproducibles.

## Cómo comentar el siguiente archivo

Al crear una clase, añadir un comentario inicial con su propósito y responsabilidad. En métodos públicos, explicar entradas, resultado, errores relevantes y quién debe realizar las operaciones del negocio. Comentar especialmente seguridad, cancelación, foco, concurrencia y decisiones que no resulten evidentes del código.

```javascript
/** Coordina el listado y los formularios de Productos mediante los componentes compartidos. */
class ProductsPage {
  /** Recibe la consulta del listado; la API valida permisos y aplica paginación en el servidor. */
  async loadPage(query) {
    // Aquí se integrará la API de Productos cuando exista.
  }
}
```

Este fragmento es un ejemplo de documentación, no un CRUD funcional. Evitar comentarios que repitan cada asignación. Si cambia un método, actualizar su comentario en la misma edición. No mantener documentación basada en números de línea.

## Al comenzar Productos

1. Declarar sus permisos de operación y endpoints. Reutilizar licencia, sesión, CSRF y consultas parametrizadas. La autorización de la página no reemplaza la autorización de una API.
2. Crear su clase de página para coordinar la consulta, los modales y los avisos. Mantener las reglas de negocio en servicio/repositorio del servidor.
3. Configurar DataTable con columnas, `load` y `onAction`; conectar FilterBar para cambiar la consulta y reiniciar la página. Las guías U009/U010 muestran las firmas exactas.
4. Crear el formulario como contenido de Modal, validarlo con FormController y pedir Confirm para descartar/eliminar. Mostrar errores por campo o persistentes según su alcance.
5. Tras guardar, actualizar la tabla y mostrar una notificación breve. No copiar los componentes ni habilitar botones antes de tener su operación implementada.
6. Usar `destroy()` en componentes temporales al cerrar o reemplazar sus contenedores. Crear una instancia por componente para evitar duplicar eventos.
7. Añadir pruebas de contratos y reglas de Productos con datos ficticios. Mantener la demostración separada en `/demostracion/componentes`.

Referencias: [Componentes U009](20_COMPONENTES_COMPARTIDOS_U009.md), [Filtros y listados U010](21_FILTROS_SELECTORES_Y_LISTADOS_U010.md), [Auditoría U011](22_AUDITORIA_CORRECCIONES_U011.md).

## Componentes de consulta U017

`public/js/components/record-details.js` incorpora RecordDetails para información semántica y segura; su estilo está en `public/css/components/record-details.css`. ValueFormat, en ui-core.js, sirve a DataTable y RecordDetails. Modal, SearchSelect y NotificationCenter conservan sus responsabilidades y utilizan la presentación de U017.
