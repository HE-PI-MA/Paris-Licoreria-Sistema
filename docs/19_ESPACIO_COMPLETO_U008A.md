# U008A — El módulo utiliza el espacio disponible

El elemento main identifica el contenido principal de la página. En el espacio de trabajo contiene las cuatro áreas de cada módulo: cabecera, controles, contenido y mensajes.

## Cambio

El contenedor del espacio de trabajo dispone sus elementos en columna y tiene como altura mínima la ventana disponible. El main crece hasta ocupar el espacio restante. En móviles la cabecera superior ocupa su altura antes de distribuir ese espacio.

La estructura del módulo mantiene sus cuatro áreas. La fila de contenido recibe el espacio sobrante; cabecera, controles y mensajes conservan su altura natural. El panel, su área interior y el estado de preparación crecen juntos. Los mensajes quedan después del panel.

Se elimina el límite de ancho de 100rem del main, para que utilice todo el ancho disponible junto al sidebar. Se conserva el padding compartido de 10 px.

Se utiliza min-height, no una altura fija ni un recorte con overflow hidden. Si la información requiere más espacio que la ventana, la página puede crecer y desplazarse. La estructura se comparte entre los nueve módulos. Perfil y acceso restringido conservan sus cuerpos propios dentro del main ampliado.

## Archivos

- public/css/components/sidebar.css: columna del espacio de trabajo y tamaño del main.
- public/css/components/module-layout.css: reparto de filas y crecimiento del panel de contenido.

Este ajuste utiliza CSS; no cambia las clases JavaScript, las rutas ni la base de datos. La altura responde al tamaño de ventana sin cálculos de píxeles en JavaScript.

## Instalación y verificación

El paquete comprueba las versiones revisadas y respalda los archivos antes de modificarlos. Puede aplicarse mientras funciona el servidor; recargar con Ctrl + F5 después de instalar.

Se revisaron las diferencias y la compatibilidad de archivos; la prueba existente de estructura compartida comprueba el renderizado de las páginas y recursos. No equivale a una prueba visual de navegador. Revisar el resultado en la instalación con el sidebar abierto, contraído y en pantalla pequeña.

El publicador permite guardar estos tres archivos a partir del commit U008 9c8ce630d282814e5b96bb72fd839c02a95bc5d1, con la autenticación Git del equipo. No publica otros cambios preparados o un historial diferente.
