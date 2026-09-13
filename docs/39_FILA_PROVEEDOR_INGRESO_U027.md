# Proveedor e ingreso en una fila — U027

Base revisada: U026, commit `17326c466c6680dd8eaa4ec41667866a40bde45b`, repositorio `HE-PI-MA/Paris-Licoreria-Sistema`.

## Cambio

Nueva compra agrupa **Nombre o empresa, Teléfono, Ubicación de ingreso y Observación** en una sola fila cuando hay espacio. El título del grupo es **Proveedor e ingreso**. En pantallas pequeñas los campos se distribuyen automáticamente en varias filas.

PurchaseForm sigue heredando CatalogForm. Reutiliza `app-form-grid--compact` de forms.css, ya existente; no se agregan estilos propios ni clases JS. Los selectores, autocompletado, valores, validaciones y guardado de ubicaciones mantienen su comportamiento U026. Los campos de cantidad, costo, precio, lote y vencimiento siguen en su fila.

No requiere cambios en la base de datos ni permisos adicionales a U026.

## Instalación

Descargar el ZIP U027 en **Descargas**, detener el servidor con **Ctrl+C** y pegar este bloque completo en PowerShell:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
    $zip = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "Parche_Paris_Licoreria_U027_*.zip" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $zip) { throw "Primero descarga el ZIP U027 en Descargas." }
    $destino = Join-Path $env:TEMP ("Paris_U027_" + [guid]::NewGuid())
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $destino
    node "$destino\aplicar-parche.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la instalación. Copia aquí el error." }
    node "$destino\publicar-github.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la publicación. Copia aquí el resultado." }
    Set-Location -LiteralPath $proyecto
    node server.js
}
```

Recargar con **Ctrl+F5**. El instalador verifica los archivos U026 y crea un respaldo antes de aplicar el cambio. Mantiene `.env`, licencias y datos. El publicador prepara únicamente los archivos del parche y publica sin force mediante el Git del equipo del usuario.

## Comprobación

Inspección en Chromium a 1440, 800 y 390 px: distribución, ausencia de desbordamiento horizontal del formulario, autocompletado del teléfono y conservación de una ubicación nueva al cambiar de campo. Las capturas incluidas usan datos ficticios.

Instalador verificado en copias temporales: respaldo, restauración, BOM/CRLF, conflictos, aplicación repetida y servidor detenido. Ejecuta la suite Node existente. Publicador comprobado mediante un commit local; la publicación real se ejecuta en el equipo del usuario.
