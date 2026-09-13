# Notificaciones globales de acciones — U028

Base: U027, commit `23a3403628120ba1d8f086e98bf7f6b106999eab`, repositorio `HE-PI-MA/Paris-Licoreria-Sistema`.

## Corrección

La entrega U021 había conectado los resultados exitosos de Presentaciones a NotificationCenter, pero mantenía sus errores en un Message fijo dentro del modal. Ambos eran componentes compartidos, aunque presentaban estilos y comportamientos diferentes. U028 elimina esa franja y usa NotificationCenter también para los errores de acciones.

- El error aparece flotante, con fondo rojo completo, icono y título. Utiliza `app-toast` y los estilos existentes de `messages.css`.
- Se retira a los dos segundos, sin botón Cerrar. El tiempo se pausa mientras el puntero o el foco están sobre el aviso y mientras la pestaña está oculta.
- No aumenta el cuerpo del modal ni desplaza la tabla.
- Productos, Presentaciones, Proveedores y Compras usan sus instancias de NotificationCenter para los errores de acciones.
- La regla global de duración también incluye advertencias. Solo un aviso de carga sigue abierto hasta cerrar su operación.

**El historial sigue protegido:** cuando una presentación tiene compras o ventas, se conserva y el aviso explica que puede desactivarse. Retirar el aviso no elimina el registro ni modifica su estado.

Los mensajes de validación de formularios y los estados de carga/error de una tabla que ofrecen Reintentar conservan sus componentes compartidos. Esta corrección cambia los avisos de resultados de acciones; no cambia las reglas del negocio.

## Clases y limpieza

`NotificationCenter` centraliza posición, tiempo y pausa. `Message` conserva la construcción segura del texto y del icono. `ProductsPage.handle()` envía los errores al mismo centro que los éxitos; se elimina el parámetro alert, la creación del Message y su limpieza en Presentaciones. SuppliersPage y PurchasesPage utilizan el mismo componente para sus acciones fallidas.

No se agregan clases CSS, hojas de estilo, estilos locales ni temporizadores por módulo. No hay cambios SQL ni dependencias nuevas.

## Instalación

Descargar el ZIP en **Descargas**, detener el servidor con **Ctrl+C** y ejecutar este bloque completo:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
    $zip = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "Parche_Paris_Licoreria_U028_*.zip" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $zip) { throw "Primero descarga el ZIP U028 en Descargas." }
    $destino = Join-Path $env:TEMP ("Paris_U028_" + [guid]::NewGuid())
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $destino
    node "$destino\aplicar-parche.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la instalación. Copia aquí el error." }
    node "$destino\publicar-github.js" --proyecto "$proyecto"
    if ($LASTEXITCODE -ne 0) { throw "Falló la publicación. Copia aquí el resultado." }
    Set-Location -LiteralPath $proyecto
    node server.js
}
```

Recargar con **Ctrl+F5**. El instalador verifica U027, respalda los archivos y ejecuta la suite Node existente. El publicador limita el commit a los archivos del parche y utiliza el Git del equipo del usuario, sin force. Mantiene configuración, licencia y datos; no requiere migraciones ni cambios de permisos en MySQL.

## Verificación

Chromium con respuestas y datos ficticios: notificación de error de presentación, fondo rojo e icono compartidos, ausencia de botón y franja, altura estable, presencia antes de los dos segundos y retirada después. Se comprueba el rechazo de eliminar una presentación usada, conservación del registro y reintento de acciones. Regresión de Productos, Proveedores, Compras, componentes compartidos, pausa al leer y texto seguro.

Instalador/publicador comprobados en copias y Git temporales: respaldo, restauración, BOM/CRLF, conflicto de archivos, escritura interrumpida, servidor detenido, repetición y commit limitado al manifiesto. Capturas incluidas con datos ficticios. La instalación y publicación reales se ejecutan en el equipo del usuario.
