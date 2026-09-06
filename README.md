# Paris Licoreria Sistema

Sistema web responsive para la gestion operativa de Paris Licoreria.

## Tecnologias

- Node.js
- Express.js
- EJS
- MySQL 8
- PNPM
- JavaScript
- CSS

## Arquitectura

Route -> Controller -> Service -> Repository -> MySQL

## Seguridad implementada

- Licencia Ed25519 ligada al equipo
- Activacion protegida con DPAPI de Windows
- Login bloqueado sin activacion valida
- bcrypt
- Limite de intentos
- Sesiones
- Revalidacion de usuario ACTIVO
- AuthMiddleware
- RoleMiddleware preparado para modulos
- Clave privada fuera del repositorio

## Interfaz implementada

- Pantalla de activacion
- Login responsive
- Mostrar/ocultar contrasena
- Mensajes propios
- Pantalla temporal de acceso autorizado
- Design System centralizado
- Sin alert(), confirm() ni prompt() como UX habitual

## Roles

- ADMINISTRADOR
- ENCARGADO_VENTA

## Base de datos

paris_licoreria

Proyecto independiente de BD:
BD1-Paris-Licoreria

## Ejecucion

Desarrollo:
pnpm dev

Produccion:
pnpm start

Puerto de desarrollo:
http://localhost:3100

## Pendiente

- Ajuste visual definitivo del Login
- Dashboard
- Productos e inventario
- Proveedores y compras
- Ventas y caja
- Usuarios
- Reportes

## Antes de produccion

- Sesiones persistentes en lugar de MemoryStore
- HTTPS y cookies seguras segun entorno
- Usuario MySQL de privilegios minimos
- RoleMiddleware en cada modulo real
- Permisos de Windows sobre ProgramData
- Mantener privada la clave de firma

Para uso comercial se recomienda que el repositorio de la aplicacion no sea publico.
