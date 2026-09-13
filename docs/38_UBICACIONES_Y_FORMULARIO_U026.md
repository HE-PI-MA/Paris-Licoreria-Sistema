# Ubicaciones y formulario de Compras — U026

Base: U025, commit `6a739fb6f4e813c1af9e274c45ea2a7d46e5bf7a`, repositorio `HE-PI-MA/Paris-Licoreria-Sistema`.

## Uso

La ubicación indica dónde ingresa físicamente la mercadería. En **Compras → Nueva compra → Ubicación de ingreso**, buscar y seleccionar una ubicación existente o escribir **HELADERA**, **CAJA DOS**, **DEPÓSITO**, etc. El nombre permanece al cambiar de campo. Máximo: 80 caracteres.

El lugar nuevo se registra al pulsar **Guardar compra**, junto con la compra y sus productos. Después aparece entre las sugerencias. **Agregar producto** solo agrega una fila al borrador; **Cancelar** no crea la ubicación. Todas las filas de esa compra ingresan en el destino elegido.

Una coincidencia exacta activa se reutiliza incluso si se escribió sin seleccionarla. No se crean duplicados por mayúsculas o espacios repetidos. Un destino inactivo se rechaza y no se reactiva desde Compras. No se incorpora una pantalla independiente para administrar ubicaciones en esta entrega.

Los campos inferiores se organizan así en pantallas amplias:

| Cantidad comprada | Costo (Bs) | Precio venta (Bs) | Lote | Vencimiento |
| --- | --- | --- | --- | --- |
| Número de presentaciones que ingresan. | Lo pagado por cada presentación. | Precio al vender esa presentación. | Código opcional. | Fecha opcional del lote. |

En pantallas pequeñas se distribuyen en varias filas. Proveedor/teléfono y ubicación/observación permanecen alineados por pares. La fecha de la compra sigue siendo automática; **Vencimiento** es la fecha del lote. Las presentaciones existentes conservan su precio de venta.

## Implementación

- `PurchaseForm extends CatalogForm` reutiliza `SearchSelect` con texto libre. No contiene estilos propios.
- `forms.css` define la variante reutilizable `app-form-grid--compact`; los campos usan las clases comunes.
- `PurchaseInput` acepta un destino por `locationId` o por `locationName`, nunca ambos. Conserva el contenido normalizado del contrato U025 por ID para mantener su idempotencia.
- `PurchaseService` resuelve el destino dentro de la transacción existente. `PurchaseRepository` consulta el nombre e inserta la ubicación usando parámetros y el índice único existente.
- Un fallo revierte también el lugar nuevo. Un reintento de la misma compra no repite el ingreso. Si dos compras simultáneas compiten por crear el mismo nombre, se permite reintentar la operación que encuentre el bloqueo.

## Instalación en Windows

Descargar el ZIP en **Descargas**. Detener el servidor con **Ctrl+C** y ejecutar este bloque completo en PowerShell:

```powershell
& {
  $ErrorActionPreference = "Stop"
  $proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
  $zip = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "Parche_Paris_Licoreria_U026_*.zip" -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $zip) { throw "Primero descarga el ZIP U026 en Descargas." }
  $destino = Join-Path $env:TEMP ("Paris_U026_" + [guid]::NewGuid())
  Expand-Archive -LiteralPath $zip.FullName -DestinationPath $destino
  node "$destino\aplicar-parche.js" --proyecto "$proyecto"
  if ($LASTEXITCODE -ne 0) { throw "La instalación se detuvo. Copia aquí el error." }
  node "$proyecto\scripts\check-purchases.js"
  if ($LASTEXITCODE -ne 0) { throw "La comprobación falló. Copia aquí el resultado." }
  node "$destino\publicar-github.js" --proyecto "$proyecto"
  if ($LASTEXITCODE -ne 0) { throw "La publicación se detuvo. Copia aquí el resultado." }
  Set-Location -LiteralPath $proyecto
  node server.js
}
```

Recargar con **Ctrl+F5**. El instalador comprueba U025 y conserva un respaldo. No modifica `.env`, licencias ni datos del negocio. No hay dependencias ni migraciones nuevas. El publicador crea un commit limitado al parche y utiliza el Git del equipo del usuario para publicarlo sin force.

**Permisos de MySQL:** crear lugares requiere `SELECT, INSERT` sobre `ubicacion`. Si la aplicación usa una cuenta limitada que solo tenía SELECT, el administrador debe conceder INSERT a esa cuenta. `database/permisos_minimos.sql` contiene la concesión actualizada; ajustar base, cuenta y host a la instalación. No se necesitan UPDATE ni DELETE sobre ubicaciones. El comprobador verifica estructura y consultas en solo lectura; no concede ni garantiza INSERT.

## Verificación

Pruebas Node de contrato, errores, rollback, coincidencias e idempotencia; Chromium con texto libre que permanece al salir, cancelación, alta y reutilización de ubicación, reintento tras perder la respuesta, alineación de los cinco campos y pantalla de 390 px; regresión de Productos y Proveedores.

MySQL Community 8.4.11 en una base desechable: ubicación y compra atómicas, concurrencia de nombres, rechazo de inactivas, rollback tardío y cuenta con permisos SELECT/INSERT sobre ubicacion, sin UPDATE/DELETE. No se utilizó la base del negocio.

El paquete comprueba respaldo/restauración, aplicación repetida, BOM/CRLF, conflictos, interrupción de escritura, bloqueo con servidor abierto y commit local de los archivos previstos. La instalación y publicación reales se ejecutan en el equipo del usuario. Capturas con datos ficticios incluidas en `vista-previa`.
