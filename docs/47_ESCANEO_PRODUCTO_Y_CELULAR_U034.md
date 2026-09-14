# Escaneo, foto y celular — U034

Base comprobada: U033 publicado en `HE-PI-MA/Paris-Licoreria-Sistema`, commit `d8d78752105cf9e74a83984ddc75a2bc5bda1222`. No requiere migraciones, cuentas nuevas ni cambios de existencias.

## Así se usa Nuevo producto

1. El primer bloque permite **Escanear código**, **Elegir foto** o **Tomar foto**. La foto es opcional y se guarda al confirmar el formulario. Si la foto elegida incluye barras legibles, también se intenta leerlas localmente.
2. El código aparece completo, incluidos ceros iniciales. Se busca en tus productos; si ya existe, puedes abrir el registro y sus datos sin duplicarlo. Se avisa antes de descartar el borrador.
3. Para un código nuevo, **Buscar nombre y categoría** consulta Open Food Facts. Es opcional y requiere Internet en la computadora que ejecuta el servidor. Solo se envía ese código comercial, no fotos, contraseñas, precios, compras ni el catálogo del negocio.
4. Se sugieren nombre y una categoría compatible, cuando existen datos. La categoría se selecciona únicamente si también está registrada en tu sistema. Se reconocen grupos concretos: bebidas alcohólicas, gaseosas, galletas y dulces. Las demás categorías se eligen manualmente; no se asigna Otros por descarte. No se reemplazan campos que ya escribiste.
5. Revisa nombre, categoría y **¿Cómo lo cuentas?**. Puedes añadir la primera forma de venta: **¿Cómo lo vendes?**, **¿Cuánto trae?** y **Precio de esa forma de venta**. Un código necesita estos datos para quedar asociado a la botella, paquete o caja correcta. Ejemplo: se cuenta en unidades, se vende como paquete de 6, trae 6 y cuesta Bs 25.
6. **Guardar** confirma el producto, la foto elegida y la primera forma de venta juntos. Si falla cualquier parte, se revierte toda esa operación. Las existencias empiezan en cero; ingresan mediante Compras o los movimientos autorizados de Inventario. También puedes guardar un producto sin foto, código ni primera presentación y completar sus formas de venta después.

Se retiró el botón aislado del buscador de Productos. El buscador sigue aceptando nombres y códigos escritos o recibidos de un lector de teclado. Compras y Presentaciones conservan su lector compartido.

## Qué puede reconocer

El código de barras es un identificador; los nombres y categorías vienen de una base de datos. Una foto del frente del envase sin barras no reconoce automáticamente esos textos: esta actualización no incluye OCR ni reconocimiento visual mediante IA. La foto queda como imagen del producto y los datos pueden completarse manualmente.

Open Food Facts es un catálogo colaborativo y no contiene todos los productos. Sus datos pueden estar incompletos; no se inventan datos si no hay coincidencia. No se importan imágenes de ese catálogo ni se deducen precios, cantidades del paquete o unidades de control de stock. Las sugerencias muestran su fuente y enlace antes de guardar.

La consulta usa un destino HTTPS fijo, campos mínimos, un límite de seis segundos y 256 KiB, caché temporal limitada y un máximo de doce consultas nuevas por minuto por proceso. No se ejecuta mientras escribes ni se llama al catálogo público automáticamente desde Compras. Sesión, licencia y rol de administrador siguen siendo obligatorios.

Datos de referencia: [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/), bajo [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) y [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/). Conservar la atribución correspondiente al reutilizar estos datos. La integración utiliza el contrato de lectura v3; las pruebas automatizadas simulan el catálogo público. Una consulta al entorno público de pruebas agotó el tiempo de conexión desde el entorno de revisión, por lo que no se afirma haber comprobado su disponibilidad desde la red del negocio.

## Por qué aparecía el aviso en el celular

La dirección observada era `http://192.168.0.17:3100`. La cámara en vivo del navegador necesita un contexto seguro, normalmente HTTPS, y permiso para usarla. La excepción de localhost corresponde a la propia computadora; la IP local abierta desde otro equipo no tiene esa excepción. [Documentación de la cámara del navegador](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Con HTTP, el lector ahora ofrece **Tomar foto del código** y **Subir foto del código**, sin mostrar un botón de cámara en vivo que no puede funcionar. Tomar foto solicita la cámara trasera mediante el selector de archivos; la opción exacta depende del navegador y del celular. [Atributo capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).

## Instalar y publicar U034

Descarga `Parche_Paris_Licoreria_U034_Escaneo_Producto_Celular.zip` en Descargas. Detén el servidor con **Ctrl+C en la ventana que está ejecutando node server.js**; puede ser otra PowerShell o la terminal de VS Code. El instalador conserva la comprobación de servidor abierto y crea respaldo antes de modificar archivos.

```powershell
& {
    $proyecto = 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
    $zip = Join-Path $env:USERPROFILE 'Downloads\Parche_Paris_Licoreria_U034_Escaneo_Producto_Celular.zip'
    $parche = Join-Path $env:TEMP ('Paris_U034_' + [guid]::NewGuid().ToString('N'))
    if (-not (Test-Path -LiteralPath $zip)) { throw 'Primero descarga el ZIP U034 en Descargas.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $parche -ErrorAction Stop
    node (Join-Path $parche 'aplicar-parche.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'No se aplico U034. Revisa el mensaje anterior.' }
    node (Join-Path $parche 'publicar-github.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'Falta publicar U034. Revisa el mensaje anterior.' }
    Set-Location $proyecto
    $env:HOST = '0.0.0.0'
    $env:PORT = '3100'
    node server.js
}
```

Recarga la computadora con Ctrl+F5 y recarga el celular. Para instalar U034 no hay que ejecutar setup-media otra vez. La subida se confirma cuando el publicador muestra **REVISION GUARDADA Y SUBIDA A GITHUB**. La integración de esta conversación tiene lectura del repositorio; el bloque utiliza tu Git local para publicar.

## Preparar la cámara en vivo con HTTPS local

Estos pasos son para probar el sistema en tu red local. No publican la aplicación en Internet. Para una instalación pública se necesita un dominio y un certificado de una autoridad pública.

1. Instala mkcert una sola vez:

```powershell
winget install -e --id FiloSottile.mkcert
```

2. Abre otra PowerShell para que reconozca el programa, entra al proyecto y prepara el certificado. `192.168.0.17` es la IP de tu captura; si cambió, usa la dirección IPv4 actual que muestra `ipconfig`.

```powershell
Set-Location 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
node scripts/https-local.js --preparar 192.168.0.17
```

El comando genera certificados con mkcert y guarda los archivos fuera del proyecto, en `%LOCALAPPDATA%\ParisLicoreria\https`. Comprueba que la IP pertenece a esta computadora, protege esa carpeta para tu usuario y SYSTEM y verifica certificado, clave y vigencia. No modifica .env ni agrega certificados a Git. mkcert puede pedir autorización de Windows para instalar la autoridad de confianza local; es necesaria para que el navegador confíe en el certificado.

3. Copia al teléfono **solo `Paris-Licoreria-CA.crt`**, cuya ruta imprime el comando. En Android/Samsung, busca **Instalar certificado / Certificado de CA** dentro de Ajustes → Seguridad; el nombre exacto del menú cambia según la versión. Instala ese certificado público. **No copies ni compartas archivos que contengan `key`**, especialmente `rootCA-key.pem`. El certificado permite que ese dispositivo confíe en los certificados locales emitidos por tu computadora.

4. Detén el servidor HTTP con Ctrl+C en su ventana. Inicia HTTPS:

```powershell
Set-Location 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
node scripts/https-local.js --comprobar
node scripts/https-local.js
```

5. Abre **`https://192.168.0.17:3100/login`** tanto en el celular como en la computadora. El comando también imprime la dirección exacta. Ambos equipos deben seguir en la misma red. Inicia sesión, entra a Nuevo producto → Escanear código → Encender cámara y permite el acceso.

Si el navegador muestra un error de certificado, revisa la instalación del certificado de CA y la IP; no desactives la validación del navegador. Si la IP cambia, ejecuta --preparar con la nueva IP. Al mantener la misma autoridad local no hace falta reinstalar su certificado en el teléfono. Para volver a HTTP, detén el servidor HTTPS e inicia el servidor habitual; el ayudante restaura el entorno del proceso y no cambió tu .env.

Fuentes de preparación: [mkcert y confianza en dispositivos](https://github.com/FiloSottile/mkcert), [paquete mkcert en WinGet](https://github.com/microsoft/winget-pkgs/tree/master/manifests/f/FiloSottile/mkcert).

## Verificación y alcance

Se verificaron contratos y permisos HTTP, códigos repetidos/UPC-EAN, reintentos y reversión completa en MySQL temporal. En Chromium se leyó una foto EAN-13 real generada para prueba, se guardaron producto/foto/presentación, se comprobó el flujo de producto existente, la vista móvil, los avisos globales y que las respuestas tardías no sobrescriban datos. También se conserva la prueba de cierre de las pistas de cámara, usando una cámara simulada.

La preparación de certificados y las ACL de Windows se cubren con comandos simulados; certificado, IP, clave y conexión HTTPS se verifican con certificados efímeros locales. No se ejecutaron mkcert ni la instalación del certificado en tu Windows o en tu Android desde aquí. La comprobación final de permisos de cámara y confianza del teléfono debe realizarse en esos dispositivos.

Los estilos nuevos están en `public/css/components/media.css` y reutilizan los botones, campos, modales, selectores y notificaciones globales. `ProductCapture` coordina el formulario; `BarcodeScanner` lee imágenes/cámara; `PhotoField` conserva la foto en borrador; `ProductLookupService` consulta el catálogo; `ProductService` coordina la escritura transaccional existente.
