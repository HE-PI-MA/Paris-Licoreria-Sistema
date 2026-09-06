# 02. Configuracion y Ejecucion

## 1. Requisitos

- Windows
- Node.js
- PNPM
- MySQL 8
- Git

## 2. Instalacion de dependencias

El proyecto utiliza PNPM como gestor de paquetes.

Comando:
pnpm install

Para desarrollo:
pnpm dev

Para ejecucion normal:
pnpm start

## 3. Dependencias principales

- express
- ejs
- mysql2
- dotenv
- express-session
- bcrypt
- helmet
- express-validator
- nodemon como dependencia de desarrollo

## 4. Variables de entorno

El proyecto utiliza un archivo .env privado.

Variables principales:

- NODE_ENV
- PORT
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD
- SESSION_SECRET

El archivo .env no debe subirse a GitHub.

El repositorio contiene .env.example como referencia.

## 5. Configuracion de desarrollo

Puerto de la aplicacion: 3100
Puerto de MySQL: 3306
Base de datos: paris_licoreria
Host de MySQL: 127.0.0.1

## 6. Inicio del servidor

Comando:
pnpm dev

Resultado esperado:

MYSQL: CONEXION CORRECTA
Servidor: http://localhost:3100
Estado: http://localhost:3100/api/estado
Arquitectura: POO

## 7. Endpoints iniciales

GET /
Verifica que Express este funcionando.

GET /api/estado
Verifica la comunicacion entre la aplicacion y MySQL.

## 8. Control de versiones

Rama principal: main

Repositorio:
https://github.com/HE-PI-MA/Paris-Licoreria-Sistema

El directorio node_modules y el archivo .env estan excluidos mediante .gitignore.
