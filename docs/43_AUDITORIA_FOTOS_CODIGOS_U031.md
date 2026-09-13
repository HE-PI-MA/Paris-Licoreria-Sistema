# Auditoría, fotos y lectura de códigos — U031

Revisión del 13 de septiembre de 2026. Base: ZIP recibido y commit `6f7b324212f3ff4b264b27b8c8fbb37317830bdd` de `HE-PI-MA/Paris-Licoreria-Sistema`. Los 251 archivos del proyecto coincidían con esa versión de GitHub. Se excluyeron de la copia de trabajo las dependencias instaladas, la configuración privada y los metadatos de Git. No se leyó la configuración privada ni se conectó una base de negocio.

## Resultado y correcciones

| Hallazgo | Corrección comprobada |
| --- | --- |
| Los errores de algunos formularios se colocaban dentro del cuerpo y quedaban visibles. | FormController usa el mismo NotificationCenter de las páginas. Avisos con icono, color completo y duración de dos segundos; conservan la pausa al leerlos con teclado o cursor. |
| Un aviso flotante podía cubrir Guardar y bloquear el reintento. | Dentro del modal, las notificaciones se colocan arriba. El botón Guardar continúa accesible. |
| Productos repetía la gestión HTTP y de errores de los demás catálogos. | ProductController hereda CatalogController y declara solamente los argumentos propios y la respuesta de imagen. |
| La barra de Presentaciones tenía un CSS exclusivo de Productos. | Se reemplazó por `app-section-toolbar` en los estilos compartidos. Se eliminó `pages/products.css`. |
| AuthForm reconstruía el botón desde una cadena HTML. | Conserva y restaura sus nodos originales. El contenido anterior provenía de una plantilla confiable; no se presenta este cambio como una vulnerabilidad XSS confirmada. |
| El historial ordenaba identificadores como texto: M-9 podía preceder a M-10 en orden descendente. | El desempate usa la parte numérica y respeta la dirección elegida. Comprobado con doce conteos del mismo segundo, sin modificar el historial confirmado. |
| Algunos lectores presentan las mismas barras como UPC-A de 12 cifras o EAN-13 de 13. | Se resuelve la equivalencia únicamente con dígito de control válido. El código almacenado conserva sus caracteres. Se bloquean duplicados equivalentes y datos antiguos ambiguos. |
| La generación de claves dependía exclusivamente de `crypto.randomUUID`. | El cliente compartido dispone de un UUID v4 alternativo con `crypto.getRandomValues`. No usa Math.random ni marcas de tiempo como identificador. |

Se revisaron las consultas parametrizadas, filtros y órdenes permitidos, validación, permisos, CSRF, reintentos, versiones, transacciones y componentes utilizados por los cuatro módulos. Las pruebas de compras y existencias siguen pasando después de las modificaciones.

## ¿Dónde se registra la foto?

| Lugar | Comportamiento |
| --- | --- |
| Productos → Nuevo producto / Editar | Elegir foto, Tomar foto y Quitar foto. Es opcional. Se confirma al guardar el producto. |
| Compras → Producto nuevo | Puede adjuntarse una foto. Se guarda cuando se confirma la compra completa. |
| Compras → Producto existente | Se muestra la foto del catálogo. Para cambiarla se utiliza Editar en Productos. |
| Dos filas de la compra con el mismo producto nuevo | Se reutilizan el producto y su foto. Cada fila puede usar otra forma de compra. |
| Cancelar o fallo en una fila | No se guarda la foto ni queda un archivo abandonado. Un fallo revierte toda la compra. |
| Tabla y detalle de Productos | Muestran la misma imagen. Sin foto aparece el icono del producto. |

La imagen pertenece al producto, mientras que el código de barras y el precio pertenecen a la forma de venta: una botella y una caja pueden tener códigos y precios diferentes. La imagen actual del catálogo no constituye una fotografía histórica de cada compra.

Se aceptan JPG, PNG y WebP de hasta 15 MB en el selector. El navegador reduce la foto a un JPEG de hasta 768 píxeles por lado. El servidor valida, decodifica y reescribe el JPEG para quitar metadatos y contenido ajeno, con un máximo de 256 KiB. Los archivos no reconocidos se rechazan.

MySQL guarda una imagen pequeña por producto en `producto_imagen`. La compra, el producto y la foto participan en la misma transacción. No existe una carpeta pública de fotos ni una ruta de subida que acepte nombres de archivos del cliente. La consulta de imágenes exige sesión, activación y rol de administrador; responde JPEG con `no-store` y `nosniff`. Las copias de seguridad deben incluir esta tabla; en una exportación MySQL es recomendable conservar los BLOB como binarios, por ejemplo con `--hex-blob`.

Productos admite solicitudes de hasta 400 KiB y Compras de hasta 4 MiB. El formulario de compra avisa si las fotos acumuladas superan su límite. Estos cuerpos se procesan después de licencia, autenticación, rol y CSRF. Login y activación mantienen su límite de 16 KiB.

## Cómo utilizar los lectores

**Lector USB o Bluetooth configurado como teclado:** colocar el cursor en Código de barras y escanear. Configurarlo para terminar con Enter. En Compras se buscan el producto y su forma de compra exacta; Enter no guarda la compra. Si el código no existe, se conservan las barras escritas para completar el nuevo producto. Agregar producto y Guardar compra siguen siendo acciones explícitas.

**Cámara:** pulsar el botón con el icono de barras y luego Encender cámara. También se puede utilizar Foto del código. El lector está disponible en el buscador de Productos, en el código de las formas de venta y en Compras. El sistema solicita video, sin audio, y detiene las pistas al leer, cerrar, ocultar la página o agotar el intento de 45 segundos. Si el permiso llega después de cerrar, también se detiene esa cámara.

Formatos configurados: EAN-13, EAN-8, UPC-E, Code 128, Code 39, Code 93, ITF y Codabar. UPC-A se reconoce como su EAN-13 equivalente. El contenido leído se trata como un código; no abre direcciones web. No se incorporó lectura de QR.

Si existen dos formas de venta con códigos UPC/EAN equivalentes importados anteriormente, se muestra un error para corregirlas en Productos. No se elige una arbitrariamente ni se modifican los registros antiguos automáticamente.

### Acceso desde el celular

1. El servidor continúa en la computadora de la instalación. El celular abre su dirección desde la misma red.
2. `127.0.0.1` en el celular apunta al propio celular, no a la computadora. Se necesita la dirección real del equipo y permitir el acceso en la red local.
3. Para cámara en vivo, configurar HTTPS con un certificado que el celular reconozca. El servidor ya admite `TLS_CERT_PATH`, `TLS_KEY_PATH`, `PUBLIC_ORIGIN` y un `HOST` apropiado, o un proxy HTTPS expresamente configurado. No se cambian estos valores automáticamente.
4. Conceder permiso de cámara en el navegador. Si no está disponible, utilizar Foto del código o el lector de teclado.

HTTPS y el permiso son requisitos del navegador. La excepción de localhost sirve en el equipo que ejecuta el navegador; no convierte una dirección HTTP de la red local en un origen seguro. [Referencia de getUserMedia en MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

No se probó un celular físico ni un lector USB/Bluetooth físico. Chromium comprobó la decodificación real de imágenes y una cámara de prueba mediante MediaStream; esas pruebas no certifican todos los dispositivos, condiciones de luz o navegadores móviles.

## CSS y reutilización

Hay **17 archivos CSS y 205 nombres de clase distintos**. Algunas clases aparecen en varios selectores; no se sumaron varias veces. No se encontraron declaraciones idénticas repetidas dentro de una misma regla. Las clases sin una referencia literal completa corresponden a variantes construidas por los componentes, como colores de botones, estados y tamaños de modal.

| Grupo | Organización |
| --- | --- |
| Base | app.css, tokens.css y reset.css. |
| Controles compartidos | Botones, formularios, avisos, estados, modales, detalles, tablas, filtros y menús. |
| Estructura compartida | Sidebar y marco de módulos. |
| Fotos y escáner | `components/media.css`, utilizado por Productos y Compras. |
| Páginas específicas conservadas | Acceso/activación y demostración de componentes. Tienen estructuras propias y no duplican un CSS de cada módulo comercial. |

Las vistas EJS no contienen bloques `<style>` ni atributos `style`. Quedan ocho asignaciones de geometría en JavaScript para colocar listas flotantes, menús y ayudas del sidebar; calculan posición/tamaño según la pantalla. No definen colores ni una apariencia distinta. Quitarlas rompería el posicionamiento.

Las tablas siguen construyéndose mediante **DataTable** y sus estilos globales. Se agregó un tipo de celda de producto con foto al componente; no una segunda implementación de tabla. Foto, escáner, botones, avisos y modales utilizan clases reutilizables. Se mantienen los alias públicos de U023 por compatibilidad: son referencias a las mismas clases, no copias de su implementación.

La búsqueda de referencias no detectó estilos propios sin uso que debieran eliminarse. Una revisión estática no demuestra que nunca exista código sin uso ni que todo el sistema esté libre de errores. No se borraron métodos públicos o variantes dinámicas solo porque su nombre no aparezca como una llamada literal.

## Comprobaciones realizadas

- **62 resultados correctos** en la ejecución ordinaria de Node; cero fallos. Los 20 casos opcionales no habilitados se reportan como omitidos en esa ejecución.
- **36 resultados correctos** en MySQL temporal: Productos, Compras, Inventario y fotos. Incluyen reintentos simultáneos, rollback, versiones, mínimos privilegios, códigos equivalentes concurrentes, historial y migración repetida/reanudada.
- **36 resultados correctos** en Chromium: 22 de Productos/Proveedores/Compras y 14 de Inventario/fotos/lector. Incluyen cancelación, teclado, errores, reintento, diseño móvil, foto en dos filas, lectura de barras y cierre de cámara tardía.
- Revisión visual de capturas de escritorio y móvil; datos e imágenes sintéticos de prueba.
- Comparación completa de los 251 archivos de la base con el commit de GitHub indicado.

El instalador del parche comprueba hashes, respaldo/restauración, archivos incompletos, cambios locales desconocidos, ejecución repetida y servidor detenido. No aplica cambios a MySQL por su cuenta.

La consulta externa de vulnerabilidades de dependencias **no se completó**: la revisión automática rechazó enviar el inventario de paquetes y versiones del proyecto a `registry.npmjs.org`. No se intentó eludir esa decisión. No se afirma que las dependencias estén libres de vulnerabilidades. Los componentes locales añadidos y sus licencias constan en [Componentes externos U031](44_COMPONENTES_EXTERNOS_U031.md).

No se auditó una instalación Windows en ejecución, su configuración privada, la red real ni su base de negocio. Ventas, Caja, Reportes y Usuarios siguen pendientes de desarrollo de sus operaciones; esta entrega no los presenta como terminados.

### Estado de GitHub

La lectura del repositorio permitió comprobar la base completa. El intento de crear el primer archivo de U031 fue rechazado por GitHub con **403: Resource not accessible by integration**. No se creó un commit ni se cambió main. El ZIP incluye un publicador que utiliza el Git ya configurado en la computadora del propietario; verifica el repositorio, rama, base, hashes y lista exacta de archivos. Nunca usa force ni recibe contraseñas. Se comprobó su creación de un commit en un repositorio local desechable, sin publicar.

## Actualizar la instalación existente

Detener `node server.js` con **Ctrl+C**. Conservar una copia de la base antes de la preparación de esquema.

Esta revisión todavía no está en GitHub: hacer git pull no instala U031. Para aplicar el ZIP de parche, extraerlo primero. Desde la carpeta extraída que contiene **aplicar-parche.js** y **publicar-github.js**, ejecutar:

```powershell
node .\aplicar-parche.js --proyecto 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
if ($LASTEXITCODE -ne 0) { throw 'No se aplicó el parche. Revisar el mensaje.' }
```

No ejecutar `aplicar-parche.js` desde la carpeta del sistema si ese archivo está en la carpeta extraída. El instalador comprueba la revisión y ejecuta las pruebas ordinarias antes de dar por terminada la aplicación; restaura los archivos si fallan.

Para publicar en GitHub, permanecer en esa misma carpeta extraída:

```powershell
node .\publicar-github.js --proyecto 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
if ($LASTEXITCODE -ne 0) { throw 'GitHub no se actualizó. Revisar el mensaje y los permisos del Git local.' }
```

El publicador se detiene si hay otra rama, remotos inesperados, cambios preparados ajenos o una revisión base diferente. Si el commit local se creó pero el envío falló, se puede repetir el mismo comando: verifica ese commit antes de reintentar el envío. La escritura requiere que la cuenta configurada en Git tenga permiso sobre el repositorio.

Luego entrar a la carpeta del sistema para preparar las fotos:

```powershell
Set-Location 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
```

### Preparar MySQL una vez

U004, U012, U023 y U030 deben estar instaladas. **No volver a ejecutar esas migraciones para esta actualización.**

Con la cuenta de instalación de MySQL configurada para este comando:

```powershell
node scripts/setup-media.js
if ($LASTEXITCODE -ne 0) { throw 'Falta preparar U031. Mantén detenido el servidor y revisa los permisos de MySQL.' }
```

El script crea únicamente `producto_imagen`, comprueba su estructura y registra U031. Si encuentra otra estructura o checksum, se detiene. Requiere CREATE para la tabla e INSERT en app_migration, además de las lecturas de comprobación. No concede privilegios ni sustituye una tabla ajena.

Si la aplicación utiliza la cuenta limitada `paris_app` sobre `paris_licoreria`, ejecutar en MySQL Workbench con la cuenta administradora, **después** de preparar U031:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON paris_licoreria.producto_imagen
TO 'paris_app'@'localhost';
```

Adaptar base, usuario y host si la instalación utiliza otros. El permiso se incluye en `database/permisos_minimos.sql`; no es necesario conceder CREATE/DROP/TRIGGER a la cuenta de la aplicación. Si el usuario actual no puede preparar el esquema, utilizar la cuenta de instalación y luego volver a la cuenta de ejecución; no publicar sus contraseñas.

Finalmente, con la configuración normal de la aplicación:

```powershell
node scripts/setup-media.js --comprobar
if ($LASTEXITCODE -ne 0) { throw 'Falta completar U031 o sus permisos. No iniciar el servidor.' }
node server.js
```

Recargar el navegador con **Ctrl+F5**. Las bibliotecas de foto y barras están incluidas localmente; no se necesita instalar nuevas dependencias de Node para U031.
