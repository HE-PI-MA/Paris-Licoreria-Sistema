# Categorías y campos claros en Nueva compra — U029

Base revisada: U028, commit `df4ae80d0e773382d12318ffa14bcc389c34206a`, repositorio `HE-PI-MA/Paris-Licoreria-Sistema`.

## Qué cambia

Categoría permite seleccionar una sugerencia o escribir un nombre nuevo al registrar un producto nuevo desde Nueva compra. El texto permanece al salir del campo y al editar o reutilizar el producto del borrador. La categoría se crea al guardar la compra completa y queda disponible en los selectores de Productos y Compras.

Una coincidencia exacta activa se reutiliza. El nombre se guarda en mayúsculas, sin espacios exteriores ni espacios consecutivos. La base conserva su índice único: dos compras concurrentes no crean categorías duplicadas. Si otra transacción interviene, se puede reintentar la misma compra. Una categoría inactiva no se reactiva automáticamente.

Los productos que ya existen conservan su categoría y forma de contar. En Compras esos datos se autocompletan y quedan bloqueados; sus cambios se realizan desde Productos. Las medidas disponibles siguen siendo las del catálogo: esta entrega habilita nombres nuevos para categorías, no inventa medidas ni conversiones.

## Cómo llenar el producto

| Campo | Qué indica | Ejemplo |
| --- | --- | --- |
| Producto | Nombre del artículo. | COCA-COLA 2 LITROS |
| Categoría | Grupo del producto; admite uno nuevo. | GASEOSAS |
| ¿Cómo lo cuentas? | Cómo cuentas las existencias. | UNIDAD para botellas, GRAMO para productos por peso. |
| ¿Cómo lo compras? | La botella, bolsa, caja o paquete que compras y al que asignas precio. | PAQUETE DE 6 |
| ¿Cuánto trae? | Cuántas unidades o gramos trae cada paquete indicado arriba. | 6 si trae seis botellas; 1000 si compras un kilo y cuentas en gramos; 1 si compras una botella. |
| Cantidad comprada | Cuántos de esos paquetes o unidades compras. | 2 paquetes de 6 ingresan 12 unidades. |
| Costo (Bs) | Lo que pagas por cada paquete o unidad indicada. | 45,50 por paquete; dos paquetes cuestan 91,00. |
| Precio venta (Bs) | Lo que cobrarás por vender ese mismo paquete o unidad. | 60,00 por paquete. |
| Código de barras | Código de esa botella o paquete, si lo tiene. | 7771234567890 |
| Lote y vencimiento | Datos opcionales impresos en la mercadería. | L-2026-08 y su fecha de vencimiento. |

El precio de venta corresponde al paquete o unidad seleccionado; no se reparte automáticamente entre las botellas. Si también se vende por botella, esa opción de venta mantiene su propio precio en Productos.

Los campos de proveedor, teléfono, ubicación, observación y producto muestran ejemplos en lugar de “Buscar y seleccionar” o “Buscar o escribir nuevo”. Al enfocar se oculta el ejemplo por la regla CSS global existente; el título del campo se mantiene. Las sugerencias siguen flotando y el texto se guarda en mayúsculas cuando corresponde. Los códigos se conservan tal como se escriben.

## Reutilización y datos

PurchaseForm sigue heredando CatalogForm y utiliza SearchSelect, DataTable, RecordDetails, Modal, FormController y los estilos globales. CatalogForm.field, CatalogForm.selector y SearchSelect ahora aceptan la opción placeholder; no se copian componentes ni se añade CSS propio. setClassification comparte la restauración de categoría/medida al seleccionar o editar un producto del borrador.

PurchaseInput acepta categoryId o categoryName en el producto nuevo; rechaza referencias existentes con campos adicionales. ProductInput.productFields comparte las mismas validaciones del producto. PurchaseService y ProductRepository crean o reutilizan la categoría en la misma conexión y transacción que la compra. Si falla una fila, se revierten categoría, proveedor, ubicación, producto, compra, lotes y clave de operación. No se escribe al enfocar, escribir, agregar una fila o cancelar.

La forma normalizada del contrato anterior por categoryId mantiene su hash de reintento. No cambia el cálculo decimal, la protección del historial, las notificaciones globales U028 ni la distribución compacta U027. No se agregan dependencias ni tablas.

## Permiso para crear categorías

La cuenta de MySQL que ejecuta la aplicación necesita SELECT e INSERT sobre categoria. El permiso de lectura solo permite seleccionar categorías existentes. Se actualizó `database/permisos_minimos.sql`; la cuenta no necesita UPDATE ni DELETE sobre categoria.

Si se utiliza la cuenta limitada del ejemplo, un administrador de MySQL aplica únicamente:

```sql
GRANT SELECT, INSERT ON paris_licoreria.categoria TO 'paris_app'@'localhost';
```

Usar los nombres reales de base y cuenta si son distintos. El instalador no concede permisos ni ejecuta migraciones. `check-purchases.js` consulta estructura y motores sin modificar registros; no certifica permisos de escritura.

## Instalación

Descargar el ZIP U029 en **Descargas** y detener el servidor con **Ctrl+C**. Ejecutar este bloque completo en PowerShell:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
    $zip = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "Parche_Paris_Licoreria_U029_*.zip" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $zip) { throw "Primero descarga el ZIP U029 en Descargas." }
    $destino = Join-Path $env:TEMP ("Paris_U029_" + [guid]::NewGuid())
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $destino
    node "$destino\aplicar-parche.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la instalación. Copia aquí el error." }
    node "$proyecto\scripts\check-purchases.js"
    if ($LASTEXITCODE -ne 0) { throw "Falló la comprobación. Copia aquí el resultado." }
    node "$destino\publicar-github.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la publicación. Copia aquí el resultado." }
    Set-Location -LiteralPath $proyecto
    node server.js
}
```

Recargar con **Ctrl+F5**. El instalador verifica los archivos U028, respalda lo que cambia y ejecuta la suite de la aplicación con datos simulados. El publicador limita el commit al parche y utiliza el Git del equipo, sin force. La configuración, licencia y base de datos existentes se conservan. La instalación y publicación reales se ejecutan en el equipo del usuario.

## Verificación

- Pruebas Node: validación de categoría, hash compatible, alta/reutilización, reintentos y rollback, junto con la suite existente.
- MySQL 8.4 desechable: permisos mínimos, alta concurrente de categorías, sugerencias, categoría inactiva, stock exacto y reversión completa ante un error tardío.
- Chromium: escritura y conservación al salir del campo, edición y reutilización del borrador, guardado con respuesta perdida, autocompletado, categoría existente bloqueada, ejemplos, filas alineadas y móvil. Regresión de Productos, Proveedores y notificaciones U028. Las capturas usan datos ficticios.
- Instalador y publicador: verificación en copias y Git locales, respaldo/restauración, BOM/CRLF, conflictos, escritura interrumpida, servidor detenido, aplicación repetida y commit limitado al manifiesto. No se publica desde las pruebas.
