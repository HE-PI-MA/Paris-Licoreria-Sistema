# U006D — Iconos compartidos en sidebar y módulos

El contenido de los módulos utiliza la misma colección Bootstrap Icons que el sidebar. Los iconos del módulo coinciden en el menú lateral y en su cuerpo. Las variantes rellenas se aplican también a filtros, acciones y mensajes.

## Catálogo único

`views/components/icon.ejs` contiene los 24 iconos oficiales utilizados en la interfaz del espacio de trabajo. `views/components/sidebar-icon.ejs` llama a este componente para conservar las referencias existentes del sidebar.

El catálogo es local: los SVG se incluyen directamente en el HTML generado por el servidor. No requiere internet, fuentes de iconos, scripts externos ni paquetes adicionales.

## Contenido actualizado

- Inicio: el icono de bienvenida coincide con el del sidebar.
- Ventas, Caja, Productos, Inventario, Compras, Proveedores, Reportes y Usuarios: sus paneles de contenido muestran el mismo icono que sus enlaces del menú.
- Cabeceras: sus acciones usan los símbolos de la misma colección.
- Controles: el buscador utiliza la lupa oficial y Filtros utiliza un embudo relleno.
- Mensajes: información, confirmación, advertencia y error utilizan las variantes rellenas.
- Estados: la carga conserva la animación del símbolo de actualización y el respeto a la preferencia de movimiento reducido; el estado vacío utiliza la caja de productos.
- La página de acceso denegado utiliza un candado relleno. El botón del menú móvil utiliza el símbolo de menú de Bootstrap.

## Iconos añadidos al catálogo de U006C

| Uso | Nombre interno | Bootstrap Icons |
| --- | --- | --- |
| Crear o añadir | plus | plus-circle-fill |
| Buscar | search | search |
| Filtros | filter | funnel-fill |
| Actualizar o cargar | refresh | arrow-repeat |
| Información | info | info-circle-fill |
| Confirmación | success | check-circle-fill |
| Advertencia | warning | exclamation-triangle-fill |
| Error | error | x-circle-fill |
| Menú móvil | menu | list |
| Acceso denegado | lock | lock-fill |

La lupa, las flechas de actualización y el símbolo de menú conservan sus formas oficiales. No se rellenan sus huecos a mano ni se alteran sus dibujos para simular otras variantes.

Se conservan el tamaño, los colores, los espacios y las etiquetas accesibles existentes. Los SVG decorativos usan `aria-hidden="true"` y `focusable="false"`; su color procede del texto del componente. Los controles pendientes de desarrollo continúan deshabilitados.

## Origen y licencia

Colección: [Bootstrap Icons](https://icons.getbootstrap.com/), versión declarada 1.13.1.

Los SVG proceden de la revisión [6945b7006285d444cc17ff2e22c7691719229526 del repositorio oficial](https://github.com/twbs/icons/tree/6945b7006285d444cc17ff2e22c7691719229526). Se conservan las formas oficiales y se adapta únicamente la etiqueta SVG exterior al componente de la aplicación.

Se reutiliza la licencia MIT original instalada con U006C en `public/licenses/bootstrap-icons-LICENSE.txt`.

## Instalación

Este ajuste requiere los iconos del sidebar U006C instalados. El instalador verifica la compatibilidad, guarda una copia de los archivos anteriores y comprueba el resultado. No modifica MySQL, permisos ni configuración, ni realiza commits o subidas a GitHub.
