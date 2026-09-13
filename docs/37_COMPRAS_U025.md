# Compras — U025

Base revisada: U024, commit `646c6ffd96e7ebfb9f41d9576ce69f5188eedadd`, repositorio `HE-PI-MA/Paris-Licoreria-Sistema`.

## Uso

1. Abrir **Compras → Nueva compra**.
2. Escribir el nombre del proveedor. Si ya existe y está activo, seleccionarlo: su teléfono se completa y se conserva sin modificarlo. Si es nuevo, completar nombre y teléfono; se creará al guardar la compra. El teléfono es opcional y se valida si se proporciona.
3. Elegir la ubicación de ingreso. La fecha de la compra se registra con el reloj de MySQL. La observación es opcional.
4. Escribir el producto y seleccionar una coincidencia existente, o completar un nombre nuevo con categoría y unidad base. Para el nuevo producto, el estado inicial es ACTIVO y el stock mínimo inicial es cero; después pueden ajustarse en Productos.
5. Elegir o escribir la presentación. Una presentación nueva necesita nombre, equivalencia en unidades base y precio de venta; el código de barras es opcional. Las presentaciones existentes conservan su equivalencia y su precio. También se pueden seleccionar productos/presentaciones nuevos que ya están en el borrador.
6. Completar cantidad comprada y **costo por presentación**. Lote y vencimiento son opcionales. **Agregar producto** añade la fila al borrador. No escribe en MySQL.
7. En las acciones de cada fila se puede consultar el detalle, editar dentro del mismo formulario o quitar del borrador. La tabla tiene altura limitada y desplazamiento interno con la barra oculta. Su numeración no corresponde al identificador del producto.
8. **Guardar compra** confirma todo. El total y los botones del pie permanecen visibles. **Cancelar** solicita confirmación si hay cambios; cancelar no crea proveedores, productos ni presentaciones.

Ejemplo: comprar 2 paquetes de 6 a Bs 45,25 por paquete registra Bs 90,50 de compra e ingresa 12 unidades base. El precio de venta pertenece a la presentación y es independiente de ese costo. Si se vende únicamente por unidad, la presentación Unidad tiene equivalencia 1.

Máximo: 50 filas por compra. El listado principal consulta el servidor por bloques de 50; no descarga todo el historial al abrir el módulo. Se puede buscar por proveedor o número de compra. El detalle de compras anteriores no repite cantidades ni subtotales aunque existan varios lotes o ubicaciones por detalle.

## Responsabilidades y reutilización

- `PurchaseInput`: contrato y validación del proveedor, ubicación y filas. Reutiliza RecordInput, SupplierInput y ProductInput.
- `PurchaseService`: reglas de compra, referencias/versiones, conversión, límites y coordinación de una sola transacción.
- `PurchaseRepository`: consultas paginadas e inserción de compra, detalle_compra, lote_producto y lote_ubicacion. Reutiliza los métodos de inserción de ProductRepository y SupplierRepository.
- `OperationStore`: conserva la compra y el resultado de su clave de operación en la misma transacción. Compras solicita REPEATABLE READ para bloquear también las coincidencias de nombres nuevos. Un reintento del mismo contenido usa la misma clave.
- `CatalogController`: adaptador HTTP compartido; SupplierController conserva su interfaz. Compras mantiene activación, sesión, rol ADMINISTRADOR y CSRF.
- `PurchaseForm extends CatalogForm`: formulario único con campos globales, Modal, FormController y SearchSelect. `PurchaseDraft` mantiene las filas temporales; `PurchaseView` presenta datos seguros con RecordDetails/DataTable; `PurchasesPage` coordina el listado y las notificaciones.
- `Decimal`: una implementación compartida entre Node y navegador, exportada como CommonJS o ParisUI.Decimal. Utiliza enteros BigInt para convertir cantidades y sumar centavos, con el mismo redondeo de las rutinas de MySQL.
- No existe CSS propio de Compras. Se reutilizan botones, campos, selectores, mensajes, modal, detalles y tabla. Las secciones, barra de acciones y total de formularios se definen en `public/css/components/forms.css`.

### Reglas para otros módulos

`CatalogForm` acepta `size` y su método `selector` puede recibir un cliente de opciones distinto del cliente que guarda el formulario. `SearchSelect({ select, load, allowCustom: true })` conserva texto libre y lo incluye en FormData como `nombreDelSelectText`; esto permite detectar cambios pendientes. El componente no crea registros. Sus valores existentes y el texto nuevo deben validarse en el servicio de cada operación.

Los menús y filas de DataTable solo comunican acciones. No añadir operaciones de negocio a DataTable ni copiar estilos al módulo. Conservar `fillHeight: false` y `mode: 'scroll'` para un listado dentro de un modal, y destruir las instancias al cerrar.

## Integridad y alcance

Proveedor, producto y presentación nuevos se insertan junto con la compra y el stock; un error revierte todo, incluida la clave de operación. Se verifican estado, relación producto-presentación y versiones bajo bloqueo. Nunca se actualiza el teléfono ni el precio de un catálogo existente desde Compras. Una coincidencia ya registrada que no fue seleccionada se rechaza con un mensaje; los registros inactivos deben revisarse en su módulo.

El stock se ingresa mediante lotes y ubicaciones, respetando los triggers existentes. No se cambia directamente una columna de stock en Producto. No se invoca sp_registrar_compra dentro de otra transacción porque esa rutina confirma su propia transacción y rompería el guardado conjunto de nuevos catálogos.

No se implementan en esta entrega anulación/edición de una compra ya confirmada, devolución, pagos, egresos de Caja ni Ventas. Las compras confirmadas ofrecen consulta de detalle. Los datos de vencimiento conservan las reglas actuales: un lote vencido puede tener existencia física pero no disponibilidad para venta.

## Instalación

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Desde la carpeta extraída ejecutar:

```powershell
$proyecto = "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"
node aplicar-parche.js --proyecto "$proyecto"
node "$proyecto\scripts\check-purchases.js"
```

Cambiar la ruta por la carpeta real del proyecto. El instalador comprueba la base U024, guarda respaldo de los archivos modificados y restaura si falla la instalación o su suite de pruebas. No cambia .env, licencias, datos reales ni migraciones anteriores. No instala dependencias nuevas.

**Base de datos:** U025 utiliza las tablas, vistas y triggers existentes de U004, más las dependencias de U012 y U023 ya instaladas. No requiere una migración nueva. El comprobador es de solo lectura: comprueba esas dependencias, los campos usados y el motor InnoDB. No concede privilegios.

Si la cuenta de aplicación usa permisos mínimos, el administrador de MySQL debe aplicar los permisos actualizados de `database/permisos_minimos.sql`, adaptando cuenta y nombre de base. Compras necesita SELECT/INSERT en compra, detalle_compra, lote_producto y lote_ubicacion; SELECT en ubicacion y vw_compras_totales; y los permisos de catálogos/idempotencia ya existentes. No requiere UPDATE/DELETE sobre el historial. El chequeo de lectura no sustituye la concesión de INSERT; esa combinación se probó con una cuenta limitada en la base desechable.

3. Publicar el cambio desde la carpeta extraída:

```powershell
node publicar-github.js --proyecto "$proyecto"
Set-Location "$proyecto"
node server.js
```

El publicador verifica la base remota U024, prepara únicamente el commit de los archivos del manifiesto y publica sin force. La publicación real se ejecuta con el Git del equipo del usuario; no se ha realizado un push desde este paquete de pruebas. Recargar con Ctrl+F5.

Comprobar archivos sin aplicar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`. Restaurar archivos con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Restaurar archivos no revierte compras que el usuario haya registrado ni commits publicados.

## Verificación

- Suite Node: autenticación, activación, CSRF, módulos, catálogos y contrato de Compras; todos con datos ficticios.
- Chromium: compra con proveedor/producto/presentación nuevos y existentes, autocompletado, texto libre, borrador, edición, detalle, quitar, confirmación al cancelar, retorno del foco, envío único, reintento tras perder la respuesta, notificación y pantalla móvil. Regresión de Productos y Proveedores.
- MySQL Community 8.4.11 aislado: creación conjunta, stock por equivalencia, centavos exactos, reintentos simultáneos, rollback de una fila tardía inválida, versiones/estados, coincidencias de nombres y permisos mínimos. La base y la cuenta de prueba se crean con nombres aleatorios y se eliminan al terminar.
- Instalador/publicador: copias temporales, respaldo/restauración, conflictos, BOM/CRLF, escritura interrumpida, servidor detenido, aplicación repetida y commit local limitado al manifiesto.

Las pruebas no utilizaron ni modificaron la base del negocio. No se ejecutó la aplicación en el Windows del usuario ni se realizó el push real desde este entorno. Las capturas incluidas están identificadas por sus datos ficticios.

Comandos para repetir pruebas:

```text
node --test tests/purchases.test.js
```

`tests/purchases-browser.test.js` requiere Playwright y Chromium con las variables PARIS_UI_BROWSER_TESTS=1, PARIS_PLAYWRIGHT_PATH y, cuando corresponda, PARIS_BROWSER_EXECUTABLE/PARIS_BROWSER_ARGS. `tests/purchases-mysql.test.js` requiere PARIS_MYSQL_TEST=1 y una instancia aislada mediante TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER y TEST_DB_PASSWORD; nunca carga .env. No apuntar esa prueba a una instalación de negocio.
