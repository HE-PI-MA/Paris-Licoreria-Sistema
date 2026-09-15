# U035 — Lector de barras y autocompletado

## Qué se corrigió

La foto enviada reproducía el error de lectura de U034. Con el lector anterior no se obtenía un resultado; al ampliar la búsqueda y permitir el giro se leyó el código 7771611000002. La prueba se hizo sobre la imagen original recibida, sin cambiar sus barras. La foto no forma parte del parche ni se publica en GitHub.

La clase compartida `BarcodeScanner` activa `TRY_HARDER` de la biblioteca ZXing local. Esa opción revisa más filas y permite probar la imagen girada. Se utiliza tanto para fotografías como para la cámara en vivo, en todos los módulos que ya usan ese lector. No añade dependencias ni servicios de reconocimiento de imágenes.

La clase `ProductCapture` ya no espera el botón «Buscar nombre y categoría». El proceso comienza al escanear, pulsar Enter con el código escrito o terminar de escribir y salir de ese campo. No consulta por cada tecla.

## Cómo funciona ahora

1. En Productos, pulsa **Nuevo producto → Escanear código**.
2. Toma o sube una foto del código completo. Si tienes HTTPS y permiso, también puedes usar **Encender cámara**.
3. Al leer las barras, el lector cierra su ventana y coloca el número en el formulario.
4. Primero se busca en tu propio sistema. Si ya está registrado y el formulario estaba vacío, se abre el producto existente con sus datos, sin crear otro. Si habías escrito otros datos o agregado una foto al borrador, se pide confirmar antes de descartarlo.
5. Si no está registrado, se consulta automáticamente el número en Open Food Facts. Se completa el nombre disponible y se selecciona la categoría cuando coincide con una categoría registrada y activa de tu sistema.
6. Revisa los datos, completa cómo lo cuentas, cómo lo vendes y el precio. Pulsa **Guardar** para registrar el producto y su primera forma de venta.

Escanear no guarda automáticamente, no crea una compra y no aumenta las existencias. El precio de tu negocio lo defines tú.

## Cuando no aparece el nombre o la categoría

Un código leído correctamente no garantiza que el catálogo público tenga ese producto. Si no hay coincidencia, el número se conserva y puedes completar los campos. Al quedar registrado, las siguientes lecturas se resuelven desde tu catálogo local.

El servicio público puede no tener nombre, categoría o conexión disponible. No se inventan esos datos. Si la categoría sugerida no existe entre las opciones del sistema, se informa la sugerencia y se conserva la selección manual. No se crean categorías desde este formulario.

La consulta externa solo transmite el código. Las fotos y los demás datos del formulario no se envían a Open Food Facts. Se mantienen la URL fija, la validación del código, el límite de solicitudes, la caché y el tiempo de espera de U034. Los códigos internos se buscan localmente y pueden registrarse manualmente.

Tomar una foto del envase sigue sirviendo para guardar la imagen del producto. Esta versión lee barras; no identifica un producto a partir del dibujo, la marca o el texto de su envase.

## Cambios mientras se busca

- Se respeta el nombre o categoría que hayas escrito o seleccionado.
- Si cambias de código, se cancela la consulta anterior y se ignoran respuestas tardías.
- Se quitan únicamente sugerencias del código anterior que no hayas editado.
- No se repite una consulta por los eventos de Enter y salida del mismo campo.
- Si el catálogo falla, aparece la notificación global temporal. El código y el borrador permanecen; puedes volver a escanear o pulsar Enter para reintentar.
- Cerrar el lector detiene la cámara, incluso si el permiso llega después de cerrar.

## Estilos y datos

No se crean clases CSS nuevas ni estilos propios. Se reutilizan `Modal`, `Button`, `PhotoField`, `BarcodeField`, `SearchSelect`, `CatalogForm` y `NotificationCenter`. El lector ampliado está en la clase común y el autocompletado de Nuevo producto permanece en `ProductCapture`.

No hay cambios en tablas, migraciones, contraseñas, licencias ni configuración del servidor. No hace falta volver a ejecutar `setup-media.js`. La creación transaccional del producto y su primera forma de venta se conserva.

## Instalación en Windows

Este parche corresponde a U034 publicado en el commit `dcc5d304e6a2a01c8a0269aa6dab5d9e607d6083` de `HE-PI-MA/Paris-Licoreria-Sistema`. El instalador comprueba compatibilidad y crea un respaldo antes de reemplazar archivos. Si detecta cambios distintos, se detiene para conservarlos.

1. Descarga **Parche_Paris_Licoreria_U035_Lector_Autocompletado.zip** en Descargas.
2. Detén el servidor con **Ctrl+C en la ventana donde está funcionando `node server.js`**. Puede ser otra PowerShell o la terminal de VS Code.
3. Ejecuta este bloque:

```powershell
& {
    $proyecto = 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
    $zip = Join-Path $env:USERPROFILE 'Downloads\Parche_Paris_Licoreria_U035_Lector_Autocompletado.zip'
    $parche = Join-Path $env:TEMP ('Paris_U035_' + [guid]::NewGuid().ToString('N'))

    if (-not (Test-Path -LiteralPath $zip)) {
        throw 'Primero descarga el ZIP U035 en Descargas.'
    }

    Expand-Archive -LiteralPath $zip -DestinationPath $parche -ErrorAction Stop

    node (Join-Path $parche 'aplicar-parche.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'No se aplico U035. Revisa el mensaje.' }

    node (Join-Path $parche 'publicar-github.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'Falta publicar U035. Revisa el mensaje.' }

    Set-Location $proyecto
    $env:HOST = '0.0.0.0'
    $env:PORT = '3100'
    node server.js
}
```

Este bloque inicia el servidor HTTP, como en las capturas recibidas. Para una instalación que ya tiene HTTPS configurado con U034, inicia después con `node scripts/https-local.js` en lugar de `node server.js`. El parche no convierte por sí solo HTTP en HTTPS.

Recarga la página en el celular y usa Ctrl+F5 en la computadora. En HTTP se mantienen **Tomar foto del código** y **Subir foto del código**. La cámara en vivo sigue necesitando HTTPS y permiso del navegador.

El ZIP incluye el publicador para tu PowerShell. La publicación ocurre cuando ese comando termina correctamente; generar o descargar este parche no actualiza GitHub por sí solo.

## Verificación

- Imagen real recibida: el lector corregido devuelve `7771611000002`; U034 sin la corrección fallaba.
- Chromium real: barras sintéticas giradas 0°, 90°, 180° y 270°, de tamaño reducido y fuera del centro.
- Flujo de móvil HTTP sin `mediaDevices`: foto que falla, reintento correcto y autocompletado sin segundo botón.
- Producto conocido: carga directa, sin duplicados ni consulta externa; protección de borrador escrito.
- Producto desconocido, código interno, consulta tardía, cambios manuales, caída del catálogo y reintento.
- Cámara simulada con barras giradas: lectura y cierre de pistas, incluido permiso tardío.
- El guardado se invoca solamente al confirmar. Las pruebas de esta versión usan un repositorio simulado; no se conectan a la base del negocio.
- Pruebas Node ordinarias y verificación del instalador, respaldo, restauración, compatibilidad, aplicación repetida y preparación de commit local.

No se pudo confirmar desde este entorno si Open Food Facts tiene una ficha para el agua de la foto. Las respuestas del catálogo usadas en las pruebas son simuladas. Tampoco se afirma una prueba física de cámara o permisos en el teléfono del usuario. Las pruebas MySQL de versiones anteriores quedan disponibles y se adaptan al nuevo flujo, pero no se repiten en esta corrección de interfaz.

Las capturas incluidas muestran datos ficticios. El archivo original del usuario, secretos y bases de datos no se distribuyen.
