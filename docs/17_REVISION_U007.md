# U007 — Revisión, limpieza y documentación

Revisión preparada el 11/09/2026 sobre la copia de desarrollo posterior a U006 y los ajustes visuales. La fecha técnica no establece una jornada ni horas trabajadas del usuario.

## Resultado de la revisión

- Retirada la vista antigua `views/auth/inicio.ejs`, que ya no servía ninguna ruta, y su script `public/js/pages/inicio.js`. El cierre de sesión del espacio de trabajo utiliza el componente del sidebar.
- Eliminados los cinco bloques `.app-access-*` utilizados únicamente por esa vista.
- Retiradas la instancia no utilizada de `RoleMiddleware` en `App` y las dependencias que WebController y ActivationService recibían sin utilizar. La verificación del equipo continúa en LicenseService.
- Conservada la utilidad RoleMiddleware y su prueba para futuras API. Los permisos de páginas siguen definidos y comprobados mediante navigation.
- Comentadas las responsabilidades de los componentes y las decisiones de sesión, autorización, plantillas, caché y foco. WebController queda formateado y filtra una sola vez las partes del nombre.
- Corregidos los atributos de dimensiones del logo completo para corresponder a su archivo de 1000 × 1000. El tamaño CSS aprobado sigue en 135 px; el símbolo sigue en 100 px.
- Incluido el CSS consolidado, con espaciado de módulos de 10 px y cabecera compacta en el menú expandido.
- Actualizados README, arquitectura, roles y autenticación; añadidas las guías de módulos y mantenimiento. La documentación de entregas antiguas se conserva identificada como histórica.

## Verificación

Pruebas de aplicación y migración: **18 aprobadas, 0 fallidas**. La prueba opcional con MySQL real está **omitida** en este entorno. Se comprobaron renderizado de los nueve módulos, perfil, recursos locales, permisos de ambos roles, sesiones, CSRF y comportamiento de licencias mediante datos simulados.

El evento `MIGRATION_STATEMENT_4 / APPLICATION_ERROR` pertenece al ensayo de interrupción y recuperación; no representa una migración de la base instalada.

Se comprobó la sintaxis de 43 archivos JavaScript y 19 plantillas EJS, las referencias retiradas y los bloques CSS afectados. Aprobaron ocho ensayos del instalador y del publicador: instalación, repetición, restauración, conflictos, integridad, rutas protegidas, configuración de Git y contenido exacto del commit, utilizando carpetas y repositorios desechables. No se ha vuelto a consultar el MySQL del usuario ni probado la interfaz actual en su navegador desde este entorno. Esta revisión no es una certificación integral de seguridad ni una auditoría actualizada de vulnerabilidades de dependencias.

## Distribución y publicación

El paquete U007 reúne los cambios de interfaz posteriores a U004 y esta limpieza. El instalador comprueba versiones conocidas, conserva respaldo de los archivos afectados y ejecuta las 18 pruebas simuladas. Se detiene ante archivos distintos de las versiones aceptadas, antes de escribir.

No modifica la migración U004, dependencias, configuración privada ni datos. El publicador verifica rama, remoto, cambios preparados, integridad de archivos y el estado de Git antes de crear el commit y hacer un push normal a `origin/main`. No incluye otros cambios ajenos al manifiesto.

La cuenta conectada durante la preparación solo permite leer el repositorio. Por tanto, la publicación se ejecuta desde el equipo del usuario con su autenticación existente. Preparar este paquete no significa que GitHub ya esté actualizado.
