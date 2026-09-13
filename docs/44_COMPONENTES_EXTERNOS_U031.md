# Componentes externos locales — U031

Las bibliotecas se distribuyen con el proyecto y no se solicitan a un CDN al usar la aplicación. Sus archivos se conservan sin modificar. La actualización de estos componentes debe revisar origen, licencia y pruebas antes de sustituirlos.

| Componente | Uso | Procedencia y licencia conservada |
| --- | --- | --- |
| @zxing/browser 0.1.5 | Decodificación de barras en cámara, canvas y fotografía. | Distribución UMD del paquete oficial. `public/js/vendor/zxing-browser-LICENSE`, MIT. [Repositorio](https://github.com/zxing-js/browser). |
| Núcleo @zxing/library incluido en ese UMD | Decodificadores utilizados por el componente anterior. | `public/js/vendor/zxing-library-LICENSE`, Apache 2.0 y avisos del proyecto. No se atribuye al núcleo una versión exacta que la distribución UMD no declara. [Repositorio](https://github.com/zxing-js/library). |
| ts-custom-error incluido en el UMD | Clases de error del lector. | `public/js/vendor/ts-custom-error-LICENSE`, MIT. [Repositorio](https://github.com/adriengibrat/ts-custom-error). |
| jpeg-js 0.4.4 | Validar y reescribir el JPEG en el servidor sin extensiones nativas. | `src/vendor/jpeg-js/LICENSE`, BSD de dos cláusulas. Se conservan además los avisos originales de decoder.js y encoder.js, incluidos los de Apache 2.0. [Repositorio](https://github.com/jpeg-js/jpeg-js). |
| Bootstrap Icons 1.13.1 | Iconos camera-fill y upc-scan en el catálogo existente. | Licencia MIT ya incluida en `public/licenses/bootstrap-icons-LICENSE.txt`. [Repositorio](https://github.com/twbs/icons/tree/v1.13.1). |

El mapa de fuentes del UMD de @zxing/browser identifica el núcleo @zxing/library y ts-custom-error. La dependencia opcional text-encoding no está incluida en ese UMD y no se agrega al sistema.

## Huellas SHA-256 de los archivos originales incluidos

| Archivo | SHA-256 |
| --- | --- |
| public/js/vendor/zxing-browser-0.1.5.min.js | b5ad3df920738ca7adcb74508d7e6b6a5b9024993fb9a0c702da1ad8964eca07 |
| src/vendor/jpeg-js/index.js | 404574b5cede8905627bff9b05975c0472d50425feb6906b0a55335e6743c4b4 |
| src/vendor/jpeg-js/lib/decoder.js | a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f |
| src/vendor/jpeg-js/lib/encoder.js | 00bde8df2517eca556669ab6fc27b414e9ba3fc52a0a71e1e37ec7c5f19c3d34 |

La lectura por cámara usa los métodos públicos documentados por [ZXing Browser](https://github.com/zxing-js/browser). La conexión de un lector físico en modo teclado se maneja en BarcodeField; no se atribuye esa función al SDK de cámara.

La versión fija y la verificación de integridad permiten reproducir esta entrega. No sustituyen una consulta de vulnerabilidades actualizada; la consulta del inventario de dependencias fue bloqueada por la revisión automática, como se detalla en el informe U031.
