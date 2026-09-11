# U006C — Iconos rellenos del sidebar

El sidebar utiliza Bootstrap Icons, incluidos en la aplicación como SVG. Desde U006D, `views/components/sidebar-icon.ejs` utiliza el catálogo común de `views/components/icon.ejs`. No requiere internet para mostrarlos y no descarga fuentes, estilos ni scripts externos.

El parche U006C aplicó el cambio al menú lateral, tanto expandido como contraído, y a sus opciones de perfil. Los enlaces, los permisos, las imágenes de marca y el comportamiento del menú conservan su implementación anterior. U006D extiende la misma colección al cuerpo de los módulos; se describe en `docs/13_ICONOS_MODULOS_U006D.md`.

## Selección de iconos

| Elemento | Icono de Bootstrap |
| --- | --- |
| Inicio | house-door-fill |
| Ventas | cart-fill |
| Caja | safe2-fill |
| Productos | box-seam-fill |
| Inventario | diagram-3-fill |
| Compras | bag-fill |
| Proveedores | truck-front-fill |
| Reportes | bar-chart-fill |
| Usuarios | people-fill |
| Mi perfil | person-fill |
| Cerrar sesión | door-open-fill |
| Contraer o expandir | chevron-double-left |
| Cerrar menú móvil | x-lg |
| Desplegar perfil | chevron-up |

Las flechas y la cruz son los símbolos de control oficiales de la misma colección. El botón para expandir conserva la rotación existente de la flecha.

## Integración

- Los 14 iconos del sidebar utilizan el catálogo compartido, sin duplicar sus formas en otro componente.
- Los SVG usan `viewBox="0 0 16 16"`, `fill="currentColor"` y `stroke="none"`.
- La clase existente `paris-icon` conserva las dimensiones establecidas en cada zona del sidebar.
- El color se hereda del enlace o botón, incluido el estado activo negro sobre dorado.
- Los SVG decorativos tienen `aria-hidden="true"` y `focusable="false"`. Los nombres accesibles permanecen en los enlaces y botones.
- El componente solo selecciona nombres de un mapa fijo y no incorpora archivos indicados por el usuario.

## Origen y licencia

Colección: [Bootstrap Icons](https://icons.getbootstrap.com/), versión declarada 1.13.1.

Origen de los SVG y la licencia: [repositorio oficial twbs/icons, revisión 6945b7006285d444cc17ff2e22c7691719229526](https://github.com/twbs/icons/tree/6945b7006285d444cc17ff2e22c7691719229526).

Se conservan las formas originales. La etiqueta SVG exterior se adapta al tamaño, color y accesibilidad del sistema. La licencia MIT original se incluye en `public/licenses/bootstrap-icons-LICENSE.txt`.

## Alcance del parche

Compatible con la estructura U006 y sus ajustes U006A y U006B. No requiere cambios en las dependencias de Node.js ni en MySQL. El instalador comprueba los archivos afectados y conserva los originales antes de aplicar el cambio. No realiza commits ni subidas a GitHub.
