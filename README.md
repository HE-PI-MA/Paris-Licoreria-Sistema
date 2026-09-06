# Paris Licoreria Sistema

Sistema web para la gestion operativa de Paris Licoreria.

## Tecnologias

- Node.js
- Express.js
- EJS
- MySQL 8
- PNPM
- JavaScript
- CSS

## Arquitectura

El backend utiliza Programacion Orientada a Objetos:

Route -> Controller -> Service -> Repository -> MySQL

## Caracteristicas previstas

- Sistema por roles
- Administrador y Encargado de Venta
- Interfaz responsive
- Design System centralizado
- Componentes reutilizables
- CSS basado en clases
- Sin estilos inline
- Gestion de productos e inventario
- Compras y proveedores
- Ventas con efectivo, QR y pago mixto
- Apertura, cierre y arqueo de caja
- Reportes
- Lectura de codigo de barras

## Base de datos

La aplicacion utiliza la base MySQL:

paris_licoreria

La base de datos se mantiene en un proyecto independiente:

BD1-Paris-Licoreria

## Puerto de desarrollo

http://localhost:3100

## Ejecucion

Desarrollo:

pnpm dev

Produccion:

pnpm start
