# Fotos WebP — U038

## Funcionamiento

Elegir foto y Tomar foto siguen aceptando JPG, PNG y WebP. En Nuevo producto, Editar producto y al registrar productos nuevos desde Compras, las fotos terminan guardadas como WebP real. No se cambia solamente la extensión.

La conversión se ejecuta automáticamente al guardar. Cancelar no registra la imagen. La foto comparte la transacción del producto o de la compra; si otro dato falla, también se revierte la imagen.

El lector de códigos utiliza la fotografía para reconocer las barras y no guarda esa captura como un archivo independiente. Las imágenes de diseño distribuidas con el sistema tampoco son archivos subidos por los usuarios.

## Clases compartidas y tamaño

- `ImageFile.photo` prepara una copia reducida en el navegador y solicita WebP. Si el navegador no puede codificarlo, envía JPEG reducido para que el servidor termine la conversión.
- `ImageCodec.toWebp` es la conversión compartida del servidor. Comprueba firma, contenido real, dimensiones y número de imágenes; decodifica JPG, PNG o WebP y genera WebP sin metadatos originales. No admite imágenes animadas ni archivos disfrazados.
- `ProductPhotoRepository.save` llama a esa función para todas las fotos que guarda. Almacena los bytes resultantes y su huella en `producto_imagen`.
- La API responde con el formato real de los bytes: WebP nuevo o JPEG histórico. Se conservan sesión, permisos y las clases visuales de U037.

La foto enviada al servidor conserva el límite de entrada de 256 KiB y un máximo de 768 píxeles por lado. El guardado busca un peso de hasta 80 KiB: primero ajusta calidad y, si hace falta, reduce proporcionalmente hasta 640 o 512 píxeles. El límite final es 128 KiB. No amplía imágenes pequeñas ni recorta el producto.

El peso concreto depende de la fotografía. Se busca una imagen liviana que permita distinguir el producto; no se promete una reducción fija ni compresión sin pérdida. El peso del archivo original elegido en el celular no es el peso finalmente almacenado.

## Fotos anteriores y reintentos

Las JPEG existentes se mantienen y siguen mostrándose. Editar solamente el nombre, precio u otros datos no vuelve a comprimirlas. Al elegir una foto de reemplazo y guardar, se almacena WebP. U038 no hace una conversión masiva de fotos antiguas.

Se conserva la normalización JPEG anterior para que una operación enviada antes de U038 pueda reintentarse con la misma clave sin duplicar registros. La conversión de almacenamiento ocurre dentro de la escritura compartida, después de resolver el reintento.

## Dependencia e instalación

El conversor es `sharp` 0.35.4, fijado en package.json y pnpm-lock.yaml. Requiere Node.js 20.9 o superior; el equipo reportado con Node 25 cumple ese requisito. El instalador prepara las dependencias con pnpm 10.34.5 y el archivo de versiones, sin ejecutar scripts de instalación de paquetes. Descarga las dependencias necesarias; requiere conexión a Internet en ese paso.

Con el servidor detenido, aplicar el paquete U038 sobre U037. El instalador crea un respaldo, prepara el conversor y ejecuta una conversión de prueba. Si hay un fallo, restaura los archivos del proyecto. Puede quedar el paquete descargado en el equipo; no se alteran los datos de negocio.

No requiere migración ni ejecutar setup-media.js: se mantiene la misma tabla y su límite anterior. Comprobación local, sin leer la base: `node scripts/check-image-codec.js`.

Fuentes del conversor: [instalación y plataformas](https://sharp.pixelplumbing.com/install/), [opciones de salida WebP](https://sharp.pixelplumbing.com/api-output/#webp), [límites de entrada](https://sharp.pixelplumbing.com/api-constructor/).

## Verificación

Las pruebas convierten JPEG, PNG y WebP reales; verifican firma WebP, dimensiones, peso y ausencia de metadatos. Rechazan archivos falsos, truncados y animados. MySQL temporal comprueba reintentos, compatibilidad JPEG, conversión al reemplazar y reversión completa ante errores. Chromium comprueba fotos desde el formulario y Compras, persistencia del borrador y funcionamiento del lector.

Se utilizan imágenes y datos ficticios. Las pruebas de integración requieren activación expresa y variables TEST_DB_*; no usan la base del negocio.
