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

## RoleMiddleware

RoleMiddleware queda conectado al contenedor de dependencias.
Su aplicacion concreta se hara al desarrollar cada modulo real.
No se crean rutas ficticias de roles.

## Interfaz

Esta actualizacion agrega:
- Pantalla de activacion
- Login visual responsive
- Pantalla temporal de acceso autorizado
- Mensajes propios del sistema
- Sin alert(), confirm() ni prompt()

Los modulos operativos se desarrollaran despues.
