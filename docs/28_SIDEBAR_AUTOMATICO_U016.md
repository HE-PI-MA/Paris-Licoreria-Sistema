# Sidebar automático — U016

## Resultado

El menú se adapta al ancho disponible, conservando el diseño U015, el encabezado de 84px y las imágenes existentes.

| Ancho con raíz de 16px | Presentación |
| --- | --- |
| Más de 1200px | Menú completo de 224px, imagen con letras y nombres de módulos. |
| Más de 768px y hasta 1200px | Columna de 88px con símbolo e iconos; ayudas al enfocar o pasar el puntero. |
| Hasta 768px | Panel oculto, abierto por la hamburguesa integrada en la cabecera del módulo. |

Los límites usan 48rem y 75rem. CSS aplica el modo inicial sin esperar JavaScript; Sidebar observa los mismos límites. Al cambiar de tamaño se cierran los paneles transitorios y se conserva un destino de foco visible. El ancho del contenido se ajusta junto al menú.

La marca ahora es una imagen accesible sin enlace ni acción de navegación. Para ir a Inicio se utiliza la opción del menú. Se elimina el botón manual de contraer y el código SidebarPreference; una preferencia anterior en localStorage queda ignorada. No se reserva espacio lateral para un botón dentro de la marca.

En móvil, la hamburguesa abre un diálogo que bloquea el fondo. Se cierra con Escape, tocando el fondo o con el botón de cierre junto al panel, fuera de la imagen. Tab permanece dentro del menú abierto; al cerrarlo vuelve a la hamburguesa. El perfil conserva sus opciones y el cierre de sesión conserva CSRF, bloqueo de doble envío y recuperación de errores.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `views/components/sidebar.ejs` | Marca sin enlace, navegación autorizada, perfil y cierre táctil móvil. |
| `public/css/components/sidebar.css` | Centrado de marca y modos de ancho por media queries. |
| `public/js/components/sidebar.js` | Clase Sidebar: transiciones, foco, ayudas, menú móvil y perfil. |
| `views/layouts/workspace.ejs` | Carga de scripts sin sidebar-preference.js. |
| `public/js/components/sidebar-preference.js` | Eliminado: el ancho ya no es una preferencia manual. |
| `tests/sidebar-responsive-browser.test.js` | Límites, cambio de tamaño, marca, CSS inicial y navegación por teclado. |
| `tests/frontend.test.js`, `tests/application.test.js` | Interacciones y renderizado autenticado sin el control antiguo. |
| `tests/ui-browser.test.js`, `tests/module-style-browser.test.js` | Regresiones adaptadas al cambio automático. |

README, arquitectura, mantenimiento y mapa de archivos reflejan el comportamiento vigente; las guías U005 y U008 identifican su comportamiento histórico. Los comentarios de código explican las responsabilidades y decisiones de foco. No se añaden bloques CSS para sobreescribir reglas antiguas ni clases vacías.

## Integración y conservación

Se aplica sobre U015 publicado en `ff3fd73e57b7184cc716f8673bef5962d84068ae`. El manifiesto incluye archivos completos nuevos/modificados, la eliminación del archivo obsoleto y comprobaciones del resto del código. Acepta BOM y saltos CRLF equivalentes; si detecta otra edición, se detiene antes de reemplazar archivos.

1. Detener `node server.js` con Ctrl+C.
2. Extraer el ZIP y ejecutar `node aplicar-parche.js --proyecto "RUTA_DEL_PROYECTO"`.
3. Ejecutar `node publicar-github.js --proyecto "RUTA_DEL_PROYECTO"` para guardar el commit y subirlo con el Git configurado en el equipo.
4. Iniciar `node server.js` y recargar con Ctrl+F5.

El instalador guarda un respaldo de los archivos anteriores y los restaura si fallan las pruebas. No cambia MySQL, configuración, licencia ni dependencias. No ejecuta la instalación de Productos ni la migración U004. El publicador prepara únicamente los archivos del manifiesto, incluyendo la eliminación; verifica el contenido antes del commit y no fuerza el historial. Si falla el push, se conserva el commit para reintentar.

Para revisar sin instalar: `node aplicar-parche.js --proyecto RUTA --comprobar`. Para restaurar archivos, detener el servidor y ejecutar `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Esto no revierte commits publicados.

## Comprobaciones

Las pruebas usan sesiones, licencia y registros ficticios, sin conectarse a una base de negocio. La instalación en Windows y la publicación con la cuenta local se comprueban al ejecutar el paquete en ese equipo.

- 35 pruebas Node de aplicación, clases compartidas, autenticación, permisos, Productos, navegación y migración simulada.
- 20 escenarios de navegador: cinco de Sidebar U016 y quince de regresión de componentes U009, cabeceras U013 e interfaz U015.
- Ventanas de 320, 390, 768, 769, 1000, 1200, 1201 y 1440px; cambio repetido de modo, marca centrada, ayudas, perfil, Escape, Tab y retorno del foco.
- Prueba con JavaScript desactivado para comprobar la selección inicial de ancho por CSS. La interacción del menú requiere JavaScript, igual que las demás operaciones de la aplicación.
- Instalador: respaldo, restauración, eliminación y recuperación de archivo obsoleto, repetición, conflicto, BOM/CRLF, fallo de escritura, servidor abierto y conservación de configuración.
- Publicador probado con Git local ficticio: commit limitado al manifiesto, sin incluir archivos ajenos. No se publica desde las pruebas.

Las imágenes en `vista-previa/` son capturas de comprobación con datos ficticios y no se instalan en el sistema.
