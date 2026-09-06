# 01. Arquitectura del Sistema

## 1. Proyecto

Nombre: Paris Licoreria Sistema

Repositorio de aplicacion:
https://github.com/HE-PI-MA/Paris-Licoreria-Sistema

Repositorio de base de datos:
https://github.com/HE-PI-MA/BD1-Paris-Licoreria

## 2. Objetivo

Desarrollar un sistema web para apoyar la gestion operativa de Paris Licoreria.

## 3. Tecnologias

- Node.js
- Express.js
- EJS
- JavaScript
- CSS
- MySQL 8
- mysql2
- PNPM
- Git
- GitHub

## 4. Arquitectura POO

Flujo principal:

Route -> Controller -> Service -> Repository -> MySQL

Route: administra las rutas HTTP.
Controller: recibe solicitudes y respuestas.
Service: contiene la logica de negocio.
Repository: centraliza el acceso a MySQL.
Database: administra el pool de conexiones.

## 5. Estructura principal

- docs
- public/css
- public/img
- public/js
- src/config
- src/controllers
- src/core
- src/middleware
- src/models
- src/repositories
- src/routes
- src/services
- src/utils
- views
- server.js
- package.json

## 6. Base de datos

Base utilizada: paris_licoreria
Host de desarrollo: 127.0.0.1
Puerto MySQL: 3306

Las credenciales privadas se almacenan en .env.
El archivo .env esta excluido de Git.

## 7. Puerto de la aplicacion

Paris Licoreria utiliza:
http://localhost:3100

El puerto 3000 se mantiene disponible para otro sistema local.

## 8. Roles

- ADMINISTRADOR
- ENCARGADO_VENTA

## 9. Tabla USUARIO

- id_usuario
- id_rol
- nombre
- apellido
- nombre_usuario
- contrasena
- estado

El nombre de usuario es unico.
Los estados permitidos son ACTIVO e INACTIVO.

## 10. Estado de la Etapa 1

- Proyecto inicial creado
- PNPM configurado
- Dependencias instaladas
- Arquitectura POO creada
- Conexion MySQL validada
- Puerto 3100 configurado
- Repositorio GitHub creado
- Primer commit realizado

Commit inicial:
5cc41aa - Crear nucleo POO de Paris Licoreria
