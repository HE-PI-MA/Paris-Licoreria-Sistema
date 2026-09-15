# Columna de foto y formato — U037

## Tabla de Productos

La tabla muestra N.º, Foto, Producto, Categoría, Se cuenta en, Disponible, Estado y Acciones. La fotografía tiene su propia columna compacta y centrada. Cuando no hay imagen, aparece el icono de producto que ya utiliza el sistema.

En pantallas pequeñas se mantienen la foto y el nombre. Ver más se encuentra junto al nombre y permite consultar los campos secundarios, con las mismas prioridades de la tabla compartida.

`ProductsPage` declara la columna de tipo `photo`. `DataTable` utiliza `ProductPhoto` para mostrarla y elige la primera columna de texto principal para Ver más. Las clases globales `app-table-photo` y `app-product-photo` controlan la apariencia. Se elimina el tipo compuesto `product` y el CSS `app-product-cell`, que solo se usaban para juntar nombre y foto.

## Formato que realmente se guarda

El sistema acepta archivos JPG, PNG y WebP en Elegir foto o Tomar foto. `ImageFile.photo` los reduce proporcionalmente a un máximo de 768 píxeles por lado y genera JPEG en el navegador. `ProductPhoto.optional` en el servidor decodifica y vuelve a generar JPEG sin metadatos del archivo original, con un límite final de 256 KiB.

`ProductPhotoRepository` guarda los bytes y una huella de la imagen en la tabla `producto_imagen`, asociados al producto. La API protegida devuelve `Content-Type: image/jpeg`. Por tanto, ver la foto en la página no significa que sea WebP: el formato actual es JPEG, incluso si el archivo elegido era PNG o WebP.

La imagen se guarda al confirmar el producto o la compra. Seleccionar una foto y cancelar no la registra. U037 cambia la distribución de la tabla; no vuelve a convertir ni migra las imágenes existentes.

## Instalación y comprobación

Aplicar sobre U036, con el servidor detenido. No requiere migraciones, preparación de fotos ni cambios de dependencias. Reiniciar y recargar en computadora y celular.

La prueba de fotos en navegador comprueba la columna Foto, el nombre separado, el icono cuando falta una imagen, el contenido JPEG servido y almacenado en MySQL temporal, y el detalle de fila en pantallas de 768, 390 y 320 píxeles. También se comprueba la tabla global con carga continua, numeración y detalles adaptables. Todas las imágenes y registros de las pruebas son ficticios.
