# Login y actualización acumulada — U033

Base: U031, commit `04b32300f602010669c50bf7ca1e880a9262ad9d` de `HE-PI-MA/Paris-Licoreria-Sistema`. La salida recibida confirmó que el intento de instalar U032 se detuvo porque el servidor seguía abierto. U033 incorpora el menú compacto U032 y la corrección de los campos del login, sin necesitar instalar U032 primero.

## Qué ocurrió

La captura del celular muestra el login y una respuesta de credenciales incorrectas. Por tanto, el celular ya alcanza la aplicación; ese mensaje no indica un problema de conexión Wi-Fi.

El CSS global aplica mayúsculas a la presentación. Los campos de acceso lo heredaban, por lo que al mostrar una contraseña mixta podía verse toda en mayúsculas aunque el valor enviado conservara las letras originales. Reescribir en otro equipo lo que se veía podía producir una contraseña diferente. La captura no permite conocer ni comprobar el valor real enviado por el teléfono; no se presenta esa explicación como prueba de su causa exacta.

## Corrección compartida

- `app-input-verbatim`, en `components/forms.css`, muestra los valores tal como se escriben.
- Usuario y contraseña usan esa clase antes y después de pulsar Mostrar contraseña.
- Ambos campos declaran `autocapitalize="none"`, `autocorrect="off"` y `spellcheck="false"` para evitar cambios automáticos del teclado.
- Se mantienen autocomplete de usuario y contraseña, el botón del ojo y el envío de la contraseña exacta. La contraseña no se convierte a mayúsculas ni minúsculas y no se recortan sus espacios.
- El usuario continúa con el tratamiento previo de espacios externos. No se modifica su validación en MySQL.
- El servidor conserva bcrypt, CSRF, sesiones, licencia y límite de intentos. La contraseña distingue mayúsculas y minúsculas.
- Se incluye el menú Mi perfil / Cerrar sesión ajustado al sidebar de U032.

No se cambiaron contraseñas, cuentas ni datos de la instalación. Las pruebas utilizan exclusivamente credenciales ficticias.

## Pruebas

La prueba nueva falló antes del ajuste porque el estilo calculado era `uppercase`, y pasó después con `none`. Se comprobó en Chromium de escritorio y con emulación móvil de 360 px: atributos de teclado, mostrar/ocultar sin alterar espacios o letras, rechazo de una clave con mayúsculas distintas y acceso correcto con el texto original. Las solicitudes conservan CSRF y la sesión llega a Inicio.

La prueba de login y la del sidebar suman ocho casos y diez resultados contando los dos grupos, sin fallos. Las capturas corresponden a datos ficticios. La emulación usa el servidor HTTP de prueba; no reemplaza la comprobación del teclado ni la red del celular real.

El instalador verifica hashes, crea respaldo y restaura ante fallos. Se verifica también el bloqueo con servidor abierto, aplicación repetida, cambios ajenos y creación de un commit local exacto. El publicador no envía configuración privada ni utiliza force.

## Antes de instalar: detener el servidor correcto

Ctrl+C debe pulsarse en la ventana donde está ejecutándose `node server.js`. Esa ventana puede ser otra PowerShell o la terminal de Visual Studio Code. Una ventana que ya muestra el prompt `PS C:\...>` no tiene ese servidor ejecutándose en primer plano.

Si no se encuentra la ventana, este comando muestra el identificador del proceso que escucha en 3100:

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Get-Process -Id $_ | Select-Object Id, ProcessName, MainWindowTitle }
```

Usar el identificador para localizar la instancia correspondiente. No finalizar todos los procesos node ni desactivar la comprobación del instalador. Si el puerto corresponde a otra aplicación, revisar antes de detenerla.

## Aplicar U033 y publicar

Descargar `Parche_Paris_Licoreria_U033_Login_y_Menu.zip` en Descargas. Con el servidor detenido:

```powershell
& {
    $proyecto = 'C:\Users\Usuario\Documents\Paris-Licoreria-Sistema'
    $zip = Join-Path $env:USERPROFILE 'Downloads\Parche_Paris_Licoreria_U033_Login_y_Menu.zip'
    $parche = Join-Path $env:TEMP ('Paris_U033_' + [guid]::NewGuid().ToString('N'))
    if (-not (Test-Path -LiteralPath $zip)) { throw 'Primero descarga el ZIP U033 en Descargas.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $parche -ErrorAction Stop
    node (Join-Path $parche 'aplicar-parche.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'No se aplicó U033. Revisa el mensaje.' }
    node (Join-Path $parche 'publicar-github.js') --proyecto $proyecto
    if ($LASTEXITCODE -ne 0) { throw 'Falta publicar U033. Revisa el mensaje.' }
    Set-Location $proyecto
    $env:HOST = '0.0.0.0'
    $env:PORT = '3100'
    node server.js
}
```

U033 no necesita migraciones ni permisos nuevos de MySQL. La integración de la conversación no dispone de escritura en GitHub; el bloque utiliza el Git configurado en la computadora. La subida queda confirmada cuando aparece REVISION GUARDADA Y SUBIDA A GITHUB.

Recargar con Ctrl+F5 en computadora y recargar la página del celular. Volver a escribir la contraseña original con sus mayúsculas y minúsculas reales. La cuenta y su contraseña siguen siendo las mismas. No enviar capturas con la contraseña visible.

La dirección observada en la captura es `http://192.168.0.17:3100/login`; sirve mientras la computadora conserve esa IP y ambos equipos sigan en la misma red. Si cambia la IP, usar la nueva dirección de la computadora.

Si el acceso sigue rechazándose, compartir solo el mensaje de error con la contraseña oculta. No se restablecen cuentas ni contraseñas por un error de presentación.
