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

## 5. Estado actual de las contrasenas

Durante la inspeccion se comprobo:

- Prefijo almacenado: $2y$
- Longitud observada: 47 caracteres

Esta informacion sugiere que las contrasenas fueron generadas mediante un esquema relacionado con bcrypt, pero todavia no se considera validada su compatibilidad con la libreria bcrypt utilizada por Node.js.

Antes de implementar el inicio de sesion se realizara una prueba controlada de compatibilidad.

No se modificaran las contrasenas existentes hasta completar esa verificacion.

## 6. Reglas previstas de autenticacion

Para iniciar sesion el sistema debera comprobar:

- Que el nombre de usuario exista
- Que el usuario se encuentre ACTIVO
- Que la contrasena sea valida
- Que el rol exista

Una vez autenticado, la sesion almacenara solamente la informacion necesaria del usuario.

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

## 9. Estado

Estructura de ROL verificada.
Estructura de USUARIO verificada.
Usuarios iniciales identificados.
Compatibilidad de contrasenas pendiente de prueba.
