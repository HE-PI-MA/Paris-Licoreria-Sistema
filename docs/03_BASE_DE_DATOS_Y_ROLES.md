# 03. Base de Datos y Roles

## 1. Base de datos

Nombre de la base:
paris_licoreria

Motor utilizado:
MySQL 8

La aplicacion se conecta mediante mysql2/promise.

## 2. Tabla ROL

La tabla ROL contiene los campos:

- id_rol
- nombre
- descripcion

El campo nombre posee una restriccion UNIQUE.

Roles registrados actualmente:

1 - ADMINISTRADOR
2 - ENCARGADO_VENTA

### ADMINISTRADOR

Descripcion registrada:
Propietario y administrador general del sistema.

Este rol tendra acceso administrativo a los modulos autorizados del sistema.

### ENCARGADO_VENTA

Descripcion registrada:
Usuario encargado de ventas y caja.

Este rol tendra acceso operativo limitado segun los permisos definidos por la aplicacion.

## 3. Tabla USUARIO

Campos comprobados:

- id_usuario
- id_rol
- nombre
- apellido
- nombre_usuario
- contrasena
- estado

Clave primaria:
id_usuario

Relacion:
id_rol referencia a ROL.id_rol

Restriccion:
nombre_usuario es UNIQUE

Estados permitidos:

- ACTIVO
- INACTIVO

## 4. Usuarios existentes

Actualmente se comprobaron dos usuarios:

- admin_paris - ADMINISTRADOR - ACTIVO
- carlos_venta - ENCARGADO_VENTA - ACTIVO

No se documentan contrasenas reales.

## 5. Contraseñas

La aplicación verifica contraseñas con bcrypt. El SQL de demostración contiene marcadores que no sirven para iniciar sesión. `node scripts/create-admin.js` permite configurar el primer administrador sin publicar su contraseña y sin sustituir cuentas reales existentes.

La compatibilidad de un hash antiguo debe verificarse antes de migrarlo. Este parche no convierte prefijos `$2y$` ni cambia contraseñas existentes automáticamente.

## 6. Autenticación

Se comprueba usuario existente, estado ACTIVO, contraseña válida y rol relacionado. La sesión se regenera después del login y se persiste en MySQL. Las solicitudes protegidas consultan nuevamente el usuario activo.

## 7. Autorizacion por rol

La seguridad no dependera solamente de ocultar botones en la interfaz.

Las rutas del backend se protegeran mediante middleware.

Se implementaran controles para:

- Usuario autenticado
- Rol autorizado
- Usuario activo

## 8. Logica transaccional

Las operaciones criticas de negocio aprovecharan los procedimientos almacenados existentes en la base de datos.

La aplicacion no duplicara innecesariamente en JavaScript la logica transaccional ya protegida por MySQL.

## 9. Estado U004

El login está implementado. Las tablas `sesion_web` y `app_migration` se agregan a las 21 tablas de negocio. Las reglas SQL corregidas y las limitaciones de prueba se describen en `09_PARCHE_U004.md`.
