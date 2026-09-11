# Arquitectura del sistema

Estado: U007. La aplicación se organiza por responsabilidades. Express recibe peticiones, EJS genera HTML y MySQL mantiene datos y sesiones.

## Recorrido de una petición

1. `server.js` carga la configuración y comprueba conexión y migración U004.
2. `src/app.js` configura cabeceras, archivos públicos, límites, JSON, sesiones y CSRF; conecta dependencias y rutas.
3. Las rutas aplican licencia, sesión y autorización según el recurso.
4. El controlador prepara una respuesta. Un servicio resuelve las reglas y un repositorio consulta o guarda datos.
5. Las vistas y componentes generan el HTML. El JavaScript del navegador gestiona la interacción.

Los archivos estáticos se sirven antes del middleware de sesión. Las escrituras actuales de la API requieren POST JSON y token CSRF. El acceso a las páginas de módulos se valida en el servidor aunque el enlace no aparezca en el menú.

## Directorios

| Ubicación | Responsabilidad |
| --- | --- |
| `src/config/` | Conexión, configuración de ejecución, navegación y presentación de módulos. |
| `src/routes/` | Direcciones y orden de los controles de acceso. |
| `src/controllers/` | Entradas HTTP, respuestas y datos para EJS. |
| `src/services/` | Autenticación, licencia, activación y almacén de sesiones. |
| `src/repositories/` | Consultas SQL y lectura/escritura de archivos de licencia y activación. |
| `src/middleware/` | Sesión activa, licencia, CSRF y límites de solicitudes. |
| `src/core/` | Esquema, serialización y firma de la licencia. |
| `src/utils/` | Identificación del equipo, protección de Windows y registro seguro de errores. |
| `views/layouts/` | Marco común del espacio de trabajo. |
| `views/components/` | Sidebar, iconos, cabecera, controles y mensajes. |
| `views/<modulo>/content.ejs` | Cuerpo específico de cada módulo; Inicio utiliza `views/dashboard/`. |
| `public/` | Estilos, interacción, fuentes e imágenes servidos localmente. |
| `database/` | Migración y guía de permisos mínimos. |
| `scripts/` | Migración, comprobación de datos y creación inicial de administrador. |
| `tests/` | Pruebas con dobles y prueba opcional de MySQL desechable. |

## Una base para todos los módulos

`navigation.js` define enlaces y roles. `module-layouts.js` define la acción principal y la plantilla de contenido. `WebController.renderWorkspace` prepara el usuario, el menú filtrado y el módulo. `workspace.ejs` integra el marco y carga el contenido declarado en la configuración.

No se repite el sidebar ni la estructura de cuatro áreas en cada pantalla. Perfil y acceso restringido utilizan el mismo espacio de trabajo con un cuerpo propio.

## Límites actuales

No hay controladores ni repositorios de productos, compras, ventas o caja conectados a estas pantallas. Al implementarlos se deben validar permisos de operación y propiedad de los registros, además del permiso general de página. Las rutas de vistas no sustituyen las futuras rutas de API.

`RoleMiddleware` se conserva como utilidad probada para futuras API; no se instancia sin uso en `App`. La autorización actual de páginas procede de `navigation.allowed`.
