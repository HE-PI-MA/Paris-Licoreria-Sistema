# Menú de perfil compacto — U032

Base comprobada: U031, commit `04b32300f602010669c50bf7ca1e880a9262ad9d` de `HE-PI-MA/Paris-Licoreria-Sistema`. Los 272 archivos de la copia base coinciden con GitHub.

## Corrección

En móvil, el menú Mi perfil / Cerrar sesión utilizaba `position: fixed` y un ancho calculado sobre toda la pantalla. Al abrir el sidebar podía extenderse sobre el contenido del módulo.

La clase compartida `sidebar-profile-menu` ahora se ancla al pie del sidebar:

- Móvil y escritorio completo: encima del botón de usuario y dentro del ancho del sidebar.
- Ancho intermedio, con solo iconos: a un lado de la barra, con ancho compacto.
- Conserva iconos, colores, foco, flechas del teclado, Escape, Mi perfil y Cerrar sesión.

La corrección de la interfaz está únicamente en `public/css/components/sidebar.css`. Se reutiliza la clase existente; no se agregan estilos en línea ni otra implementación de JavaScript. Aplica a todos los módulos que comparten el sidebar.

## Verificación

La comprobación nueva reprodujo el problema a 768 px antes del cambio y pasó después. La suite del sidebar completó seis casos, siete resultados contando el grupo, sin fallos en Chromium. Comprueba 320, 390, 768, 1000 y 1440 px para el perfil, además de los límites de cambio existentes, foco, Escape y ancho inicial sin JavaScript. Se revisaron capturas con datos ficticios.

El parche verifica la revisión base, guarda un respaldo y permite restaurar. El publicador comprueba que el commit contenga exactamente los cuatro archivos de esta revisión y conserva archivos ajenos. Las verificaciones del publicador se realizan en Git local de prueba, sin publicar.

## Instalación y publicación desde PowerShell

Descargar `Parche_Paris_Licoreria_U032_Menu_Perfil.zip` en Descargas. Detener el servidor con Ctrl+C y ejecutar:

```powershell
& {
    $proyecto = 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
    $zip = Join-Path $env:USERPROFILE 'Downloads\Parche_Paris_Licoreria_U032_Menu_Perfil.zip'
    $parche = Join-Path $env:TEMP ('Paris_U032_' + [guid]::NewGuid().ToString('N'))

    if (-not (Test-Path -LiteralPath $zip)) {
        throw 'No se encontró el ZIP U032 en Descargas.'
    }
    Expand-Archive -LiteralPath $zip -DestinationPath $parche -ErrorAction Stop
    node (Join-Path $parche 'aplicar-parche.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'No se aplicó U032. Revisa el mensaje.' }
    node (Join-Path $parche 'publicar-github.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'Falta publicar U032. Revisa el mensaje.' }
}
```

GitHub se actualiza cuando el publicador muestre REVISION GUARDADA Y SUBIDA A GITHUB. Se utiliza el Git configurado en la computadora; no se fuerza la subida si la base remota cambió. La integración de esta conversación no tiene permiso de escritura.

U032 no requiere migraciones ni permisos nuevos de MySQL. Reiniciar:

```powershell
Set-Location 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
node server.js
```

Si ya se configuró `HOST=0.0.0.0` en esa sesión de PowerShell para el celular, se conserva. Al usar una ventana nueva, repetir el arranque de red local explicado anteriormente. Actualizar con Ctrl+F5 en computadora y recargar la página en el celular.

Para restaurar, con el servidor detenido, ejecutar `node aplicar-parche.js --restaurar RUTA_DEL_RESPALDO` desde la carpeta extraída. El instalador muestra la ruta concreta al crear el respaldo. La restauración de archivos no revierte un commit que ya se haya publicado.
