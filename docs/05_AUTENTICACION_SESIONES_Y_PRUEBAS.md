# 05. Autenticacion, Sesiones y Pruebas de Seguridad

Fecha de verificacion: 06/09/2026.

## Autenticacion implementada

- bcrypt para contrasenas
- express-session
- Regeneracion de sesion despues del Login
- Cookie HttpOnly
- SameSite lax
- Revalidacion del usuario en MySQL
- Usuario debe permanecer ACTIVO
- Limite de intentos de Login
- GET /api/auth/me
- POST /api/auth/logout

Roles:
- ADMINISTRADOR
- ENCARGADO_VENTA

## Pruebas realizadas

### PR-SEG-01 Licencia criptografica
Estructura: VALIDA
Firma digital: VALIDA
Equipo autorizado: SI
Resultado: LICENCIA AUTENTICA
Estado: EXITOSA

### PR-SEG-02 Licencia instalada
Ruta:
C:\ProgramData\ParisLicoreria\license\license.json
Resultado: LICENCIA_VALIDA
Estado: EXITOSA

### PR-SEG-03 DPAPI
DPAPI disponible: true
Dato cifrado: true
Descifrado correcto: true
Estado: EXITOSA

### PR-SEG-04 Antes de activar
activada: false
estado: ACTIVACION_REQUERIDA
Estado: EXITOSA

### PR-SEG-05 Activacion real
activada: true
estado: ACTIVACION_VALIDA
Estado: EXITOSA

### PR-SEG-06 Simulacion sin activacion
Servidor de prueba: puerto 3101
licencia.valida: true
activacion.activada: false
accesoSistema: false
POST /api/auth/login:
SISTEMA_NO_ACTIVADO
Estado: EXITOSA

### PR-SEG-07 Equipo activado
En puerto 3100 el Login alcanzo la capa de autenticacion.
Con credenciales falsas devolvio:
Usuario o contrasena incorrectos
Estado: EXITOSA

### PR-SEG-08 /api/auth/me sin sesion
Resultado:
Debe iniciar sesion
Estado: EXITOSA

### PR-SEG-09 /api/auth/me con sesion
autenticado: true
nombreUsuario: admin_paris
rol: ADMINISTRADOR
Estado: EXITOSA

### PR-SEG-10 Logout
POST /api/auth/logout:
Sesion cerrada correctamente

Luego /api/auth/me:
Debe iniciar sesion
Estado: EXITOSA

## Actualización del estado — U007

La pantalla temporal de acceso fue reemplazada por el espacio de trabajo con sidebar. Esa vista antigua y su JavaScript se retiraron en U007.

Los nueve módulos y Mi perfil requieren licencia y usuario activo. Las páginas administrativas comprueban el rol en el servidor mediante `navigation.allowed`; el menú usa la misma definición. RoleMiddleware queda como utilidad probada para futuras API, sin una instancia sin uso en App.

Las sesiones persisten en `sesion_web`. CSRF comprueba token y origen para las escrituras JSON. Los límites se aplican antes del trabajo de autenticación/licencia. En producción se exige HTTPS directo o un proxy explícito y se utilizan cookies Secure.

Comando de regresión: `node --test tests/application.test.js tests/migration-runner.test.js tests/mysql.test.js`. En la revisión U007: 18 aprobadas, ninguna fallida y una integración MySQL omitida. Las pruebas utilizan dobles de autenticación, licencia y datos; no sustituyen la comprobación en Windows.

Las comprobaciones PR-SEG anteriores son un registro del 06/09/2026, no una repetición de pruebas reales de esta entrega. El usuario confirmó posteriormente login/logout en Windows y las cuatro revisiones de datos sin incidencias tras U004; U007 no vuelve a ejecutar esa revisión real desde el entorno de preparación.
