# Inventario U030

Inventario permite al administrador consultar cuánto tiene, dónde está la mercadería y por qué cambió una cantidad. Usa los productos, compras, lotes y ubicaciones existentes. No vuelve a registrar una compra al trasladar, contar o retirar mercadería.

## Uso

La tabla principal muestra producto, categoría, cantidad física, disponible, medida, estado de existencias y aviso de vencimiento. Incluye búsqueda, filtro de categoría y filtro de avisos. Las columnas secundarias pasan a VER MÁS cuando falta espacio. La tabla carga por bloques y permite desplazarse con rueda, teclado o gesto, sin barra visible.

| Campo o acción | Para qué sirve |
| --- | --- |
| CANTIDAD FÍSICA | Todo lo registrado en las ubicaciones, incluida mercadería vencida. |
| DISPONIBLE | Cantidad que las reglas vigentes permiten vender: producto y ubicación activos, y lote no vencido. |
| SE CUENTA EN | Medida del producto, por ejemplo UNIDAD o GRAMO. Las cantidades no son paquetes a menos que esa sea la medida del producto. |
| STOCK BAJO | Disponible igual o inferior a la cantidad mínima configurada en Productos. AGOTADO indica cero disponible. |
| VENCIMIENTO | Mercadería vencida o que vence en los próximos 30 días, según la fecha del servidor MySQL. |
| VER EXISTENCIAS | Resumen y tabla por lote y ubicación, con cantidad, medida y vencimiento. Incluye filas en cero para poder registrar un conteo real posterior. |
| VER MOVIMIENTOS | Historial general desde la cabecera o de un producto desde ACCIONES. Permite buscar, filtrar tipo y consultar detalle. |

En VER EXISTENCIAS, abrir ACCIONES de la ubicación y lote que se quiere modificar:

1. **TRASLADAR:** elegir o escribir el destino, indicar cantidad y motivo. El mismo lote sale del origen y entra en el destino. Una ubicación nueva se crea al guardar; cancelar no la crea. No se permite origen igual al destino ni destino inactivo.
2. **CORREGIR POR CONTEO:** escribir la cantidad total que se contó en esa fila, no la diferencia. El formulario muestra cuánto se sumará o descontará antes de guardar. El motivo es obligatorio. Si no hay diferencia, no se genera movimiento.
3. **RETIRAR MERCADERÍA:** elegir daño, pérdida, vencimiento u otro motivo, indicar cantidad y explicar lo ocurrido. Descuenta stock físico. No permite retirar más de lo registrado; VENCIDO solo se acepta para un lote que ya está vencido.

Ejemplo: hay 24 botellas en DEPÓSITO. Trasladar 6 a HELADERA deja 18 y 6, total 24. Si después se cuentan 17 en DEPÓSITO, escribir 17 en el conteo: se descuenta 1 y el total queda en 23. Para productos contados en gramos, todas esas cantidades se expresan en gramos y admiten hasta tres decimales.

Las compras nuevas siguen sumando stock automáticamente y ahora registran su ubicación de ingreso en el historial. Para introducir mercadería que todavía no tiene lote ni ubicación, registrar la compra. Un conteo no crea productos ni presentaciones.

Los avisos de éxito y error de acciones utilizan NotificationCenter: color e icono globales, desaparición a los dos segundos, con las pausas compartidas al interactuar o cambiar de pestaña. Las validaciones junto a los campos y los errores de carga con REINTENTAR mantienen el comportamiento global de formularios y tablas.

## Historial y conservación

- Cada traslado o conteo registra fecha, usuario, motivo y cantidades anteriores/posteriores. El traslado también conserva ambos saldos del destino.
- Los retiros usan `ajuste_inventario` y su trigger existente: la aplicación no descuenta dos veces.
- Las compras anteriores a U030 se muestran con su cantidad y fecha originales. Si no se guardó la ubicación original, el detalle dice que no está registrada; no se deduce a partir de la ubicación actual.
- El historial también consulta las ventas que ya existan en la base. Una venta anulada se identifica y muestra efecto neto cero; no se inventa una fecha de anulación. La interfaz de Ventas y Caja sigue pendiente.
- En el historial, una cantidad negativa representa una salida o corrección hacia abajo. Un traslado muestra la cantidad transportada: no cambia el total del producto.
- Las cantidades originales compradas y `lote_producto.cantidad_inicial` permanecen intactas. Los conteos registran diferencias separadas. No se eliminan movimientos desde la interfaz; una corrección posterior requiere otro movimiento y su motivo.

## Arquitectura y clases compartidas

| Responsabilidad | Clases o archivos |
| --- | --- |
| Validar filtros, decimales, versiones y motivos | InventoryInput, que reutiliza ProductInput/RecordInput |
| Coordinar operaciones y reglas | InventoryService |
| Consultar y bloquear existencias | InventoryRepository |
| Registrar y consultar historial | InventoryMovementRepository |
| Consultar, crear y reutilizar ubicaciones | LocationRepository, compartido con PurchaseRepository |
| Adaptar HTTP y permisos | InventoryController, CatalogController e inventory.routes |
| Coordinar página, vistas y formularios | InventoryPage, InventoryView e InventoryForm |
| Presentación y transporte comunes | DataTable, FilterBar, SearchSelect, Modal, RecordDetails, Button, CatalogForm, CatalogApi, Decimal y NotificationCenter |

No se añade ninguna hoja CSS ni estilos locales de Inventario. Se usan las clases existentes de tablas, formularios, botones, etiquetas y modales. CatalogForm admite un foco inicial opcional para estos formularios. CatalogController expone la preparación compartida de argumentos sin duplicar la gestión de errores HTTP.

Las escrituras requieren administrador activo, sesión, licencia y CSRF. OperationStore guarda el movimiento y el resultado del reintento en la misma transacción. Se bloquean todas las ubicaciones del lote en orden estable, se valida la versión consultada y se calculan diferencias con decimales exactos. Un error revierte cantidades, destino nuevo e historial. Un reintento del mismo formulario conserva la clave; una versión antigua pide cerrar y reabrir la acción antes de seguir.

## Preparación de MySQL

**Detener el servidor y respaldar la base antes de instalar.** El parche de archivos no modifica MySQL. U030 necesita una preparación explícita antes de volver a usar Compras o Inventario.

`node scripts/setup-inventory.js` requiere una cuenta de instalación con los permisos de las preparaciones anteriores y CREATE/TRIGGER/INSERT sobre la migración nueva. Se conecta a la base configurada por los mecanismos existentes del proyecto. No enviar ni publicar contraseñas; usar la administración local de la instalación.

La preparación comprueba U004/U012/U023 y Compras, crea `inventario_movimiento`, adapta los dos triggers conocidos que limitan la distribución de un lote y agrega dos protecciones de inmutabilidad al historial. El límite pasa a contemplar las diferencias firmadas de los conteos. No recrea tablas de negocio ni modifica registros anteriores. Registra el checksum U030 al terminar.

Una ejecución repetida verifica la instalación. Si se interrumpió después de crear la tabla o sustituir parte de los triggers conocidos, puede reanudarse. Si encuentra una estructura o trigger desconocido, se detiene y no lo sobrescribe. Los cambios DDL de MySQL no constituyen una única transacción: conservar el servidor detenido hasta terminar la preparación.

Después, actualizar los permisos de la cuenta de ejecución según `database/permisos_minimos.sql`, ajustando base, usuario y host. Los permisos nuevos son SELECT/INSERT en movimientos y ajustes, UPDATE en las cantidades de ubicación y lecturas para el historial. No conceder UPDATE/DELETE del historial, UPDATE de lotes, ni CREATE/DROP/TRIGGER a la cuenta de la aplicación.

`node scripts/setup-inventory.js --comprobar` verifica versión, estructura y consultas sin cambios. La cuenta limitada no puede ver los cuerpos de los triggers; su inspección completa se realiza con la cuenta de instalación al ejecutar la preparación. No iniciar el servidor si falla la preparación o faltan permisos.

## Instalar los archivos en Windows

Descargar `Parche_Paris_Licoreria_U030_Inventario.zip`. Detener `node server.js` con Ctrl+C. El paquete exige la base U029 revisada; conserva configuración, licencia y datos y crea un respaldo de archivos. Ante diferencias desconocidas no sobrescribe el proyecto.

```powershell
$proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
$zip = Get-ChildItem "$env:USERPROFILE\Downloads\Parche_Paris_Licoreria_U030_Inventario*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) { throw "Descarga primero el ZIP U030 en Descargas." }
$parche = Join-Path $env:TEMP ("Paris-U030-" + [guid]::NewGuid().ToString("N"))
Expand-Archive -LiteralPath $zip.FullName -DestinationPath $parche
node "$parche\aplicar-parche.js" --proyecto "$proyecto"
if ($LASTEXITCODE -ne 0) { throw "No se aplicó el parche. Revisa el mensaje anterior." }
node "$proyecto\scripts\setup-inventory.js"
if ($LASTEXITCODE -ne 0) { throw "Falta preparar Inventario. Conserva el servidor detenido y revisa permisos e instrucciones." }
```

Si la cuenta del proyecto es limitada, un administrador debe completar la preparación y los GRANT descritos antes de continuar. No sustituir la cuenta de ejecución por root permanentemente.

Para publicar los archivos y arrancar después de completar la preparación:

```powershell
node "$parche\publicar-github.js" --proyecto "$proyecto"
if ($LASTEXITCODE -ne 0) { throw "No se publicó. Revisa el mensaje anterior." }
Set-Location "$proyecto"
node server.js
```

El publicador solo incluye los archivos del manifiesto y verifica la base Git U029. Si el remoto cambió, se detiene. No publica `.env`, datos, respaldos ni licencia. Recargar el navegador con Ctrl+F5.

El respaldo del instalador permite restaurar archivos con `node aplicar-parche.js --restaurar RUTA_DEL_RESPALDO`, con el servidor detenido. Eso no desinstala la migración ni revierte movimientos de inventario; no borrar el historial para volver a una versión anterior.

## Verificación

- Pruebas Node: navegación, permisos, licencia, CSRF, validación de cantidades y compatibilidad de los catálogos compartidos.
- MySQL desechable: compra e ingreso, conservación del total al trasladar, conteos positivos/negativos, retiros, fracciones, vencimientos, permisos mínimos, concurrencia, reintentos, rollback y preparación repetible/reanudable.
- Chromium con MySQL de prueba: filtros, existencias, cancelación, traslado tras pérdida de respuesta, conteo, retiro, conflicto de versión, historial y pantalla móvil.
- Las capturas incluidas utilizan datos ficticios. Estas pruebas no acceden a la base ni a la licencia de la instalación Windows.

Pruebas habituales: `npm test`. Las pruebas MySQL y de navegador se omiten si no se configura su entorno explícito. Consultar `tests/support/inventory-mysql-fixture.js` para TEST_DB_*; requiere una cuenta de pruebas capaz de crear y eliminar únicamente bases y cuentas desechables. No apuntarlas a una base de negocio. No se añadieron dependencias de producción.
