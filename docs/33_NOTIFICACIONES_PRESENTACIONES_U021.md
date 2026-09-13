# Notificaciones compartidas de Presentaciones — U021

> Actualización U028: la decisión anterior de mantener errores fijos fue sustituida por notificaciones temporales compartidas. Ver [comportamiento vigente](40_NOTIFICACIONES_GLOBALES_U028.md). Esta guía conserva el detalle histórico de U021.

## Problema y corrección

Presentaciones mostraba sus operaciones completadas con `Message.show('success', ...)` dentro del cuerpo del modal. Eso generaba una franja fija debajo de la tabla, con apariencia y duración distintas de los avisos flotantes de Productos.

Ahora `ProductsPage.saved(message, table)` reutiliza la instancia existente de `NotificationCenter` y actualiza los listados afectados. Guardar, editar, activar, desactivar y eliminar una presentación pasan por este método. El callback de PresentationForm no reenvía el objeto de respuesta como texto: utiliza el mensaje compartido de guardado.

Se conserva la organización mediante clases y se comenta la responsabilidad de los puntos modificados. No se agrega otra clase, temporizador, hoja CSS ni estilo de página. `public/js/components/messages.js` administra los avisos; `public/css/components/messages.css` conserva su apariencia compartida.

## Comportamiento

- Fondo verde completo, icono de éxito, título y mensaje, igual que el resto del catálogo.
- Aparición flotante sobre el modal, sin cambiar la altura de su cuerpo ni dejar una franja debajo de la tabla.
- Cierre automático a los 2.000 ms, sin botón Cerrar. Como en las demás notificaciones, el tiempo se pausa al poner el cursor encima, enfocar el aviso con teclado o pasar a otra pestaña.
- Una sola región de notificaciones se mueve al modal superior y vuelve al documento al cerrar los diálogos.
- Los errores de la operación conservan la alerta visible del modal. No se convierten en avisos de éxito ni desaparecen a los dos segundos. Un reintento exitoso limpia ese error.
- Los mensajes concretos son «Presentación guardada correctamente.», «Estado de la presentación actualizado.» y «Presentación eliminada.».

Para un futuro módulo, usar su instancia de `NotificationCenter.show('success', mensaje)` después de confirmar la escritura. Reservar `Message` para validaciones y problemas que requieren atención; no crear una alerta fija para confirmar un guardado.

## Archivos completos incluidos

| Archivo | Responsabilidad |
| --- | --- |
| `public/js/pages/products.js` | Coordina las operaciones de Productos y Presentaciones con el aviso compartido. |
| `tests/products-browser.test.js` | Comprueba creación, edición, cambios de estado, eliminación, reintentos y duración con datos ficticios. |
| `README.md` | Registra la revisión actual y enlaza esta guía. |
| `docs/33_NOTIFICACIONES_PRESENTACIONES_U021.md` | Explica el cambio, su uso y la integración. |

El ZIP contiene estos archivos en `archivos/`, las diferencias en `CAMBIOS.diff`, el manifiesto de compatibilidad y una captura con datos ficticios en `vista-previa/`.

## Comprobaciones

Las pruebas del catálogo usan respuestas HTTP y repositorios ficticios. No modifican datos reales del negocio.

- 35 pruebas Node: autenticación, licencia, sesión, permisos, CSRF, migración simulada, diagnóstico y contratos de Productos.
- 6 escenarios de navegador Chromium: listados, errores y reintentos; teclado y descarte; validación y doble envío; protección de unidades y equivalencias; notificaciones de presentaciones; adaptación a diferentes anchos.
- Para los avisos se comprueban el fondo compartido, icono, ausencia de botón de cierre y de alerta fija, permanencia antes de los dos segundos y retirada después. Se comprueba que un error sigue visible tras cinco segundos y que un reintento exitoso lo limpia.
- El instalador se verifica con copias temporales: respaldo, restauración, aplicación repetida, rechazo de versiones distintas, conservación de configuración, bloqueo si el servidor sigue abierto y commit local limitado al manifiesto.

No se ejecutan MySQL real ni DPAPI de Windows en este entorno. La instalación Windows y la publicación del repositorio real se realizan desde el equipo del usuario.

## Instalación y publicación

Base U020: `db7ab2c18eae8ba06595ec5fd2562a9b4e52fcaa`, rama main de HE-PI-MA/Paris-Licoreria-Sistema.

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Desde el proyecto, iniciar `node server.js` y recargar con Ctrl+F5.

El instalador valida los archivos, crea un respaldo y ejecuta las 35 pruebas Node. Restaura los archivos si las pruebas fallan. El publicador verifica la base remota y publica únicamente el manifiesto, sin force. Si falla el push, conserva el commit local para reintentar.

Comprobar sin instalar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`.

Restaurar archivos con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Esto no revierte commits ya publicados.
