# Proveedores — U023

El módulo permite registrar a las personas o empresas que suministran mercadería. Prepara el catálogo que utilizará Compras; esta revisión no registra compras, pagos ni movimientos de existencias.

## Uso

Ingresar como administrador y abrir **Proveedores**. El listado utiliza DataTable: numeración independiente del ID, proveedor, teléfono, contacto, estado y acciones. En pantallas pequeñas, los datos secundarios se consultan con Ver más. La búsqueda consulta nombre, contacto, teléfono y NIT en el servidor. El selector filtra todos, activos o inactivos.

Se cargan bloques de 50 registros; el desplazamiento y Cargar más permiten continuar hasta el total disponible. La búsqueda y los filtros reinician el listado. Se conservan los estados de carga, vacío y error con Reintentar.

**Nuevo proveedor** abre el formulario compartido:

| Campo | Regla |
| --- | --- |
| Nombre o empresa | Obligatorio; hasta 120 caracteres. |
| Persona de contacto | Opcional; hasta 100 caracteres. |
| Teléfono | Opcional; hasta 30 caracteres, con al menos seis dígitos si se completa. Admite espacios, +, paréntesis, puntos y guiones. |
| NIT | Opcional; hasta 30 dígitos. Se conserva como texto, incluidos ceros iniciales. No admite duplicados cuando se completa. |
| Estado | Activo o Inactivo. |
| Dirección | Opcional; hasta 200 caracteres. |

Nombre, contacto y dirección se normalizan a mayúsculas. Las validaciones se repiten en el servidor. No se exige un NIT a un proveedor que no lo tenga registrado.

El menú Acciones permite ver detalle, editar, activar, desactivar y eliminar. La etiqueta de estado solo informa: pulsarla no modifica datos. Activar, desactivar y eliminar requieren confirmación. Si existen compras relacionadas, el proveedor no puede eliminarse; se conserva su historial y puede desactivarse. La futura operación de Compras deberá rechazar proveedores inactivos al registrar nuevas compras.

Guardar muestra Guardando… y bloquea envíos repetidos. Escape y Cancelar verifican cambios pendientes. Después del éxito aparece la notificación compartida durante dos segundos; los errores permanecen visibles y los errores de campo se muestran debajo del control.

## Clases y reutilización

| Archivo o clase | Responsabilidad |
| --- | --- |
| `public/js/components/catalog-api.js` — CatalogApi | JSON, CSRF, errores HTTP, consultas y clave estable de reintento. Extraído de ProductsApi; sirve a ambos catálogos. |
| `public/js/components/catalog-form.js` — CatalogForm | Campos, Modal, FormController, SearchSelect y envío. Extraído del formulario de Productos. |
| `public/js/pages/supplier-form.js` — SupplierForm | Declara exclusivamente los campos y la solicitud del proveedor. |
| `public/js/pages/suppliers.js` — SuppliersPage | Coordina listado, filtros, formularios, detalle, confirmaciones y notificaciones. |
| `src/domain/RecordInput.js` | Validadores comunes y RecordError; ProductInput y SupplierInput los reutilizan. |
| `src/domain/SupplierInput.js` | Reglas de entradas y consultas de Proveedores. |
| `src/repositories/OperationStore.js` | Transacción y resultado de reintentos; extraído de ProductRepository, compartido con SupplierRepository. |
| `src/repositories/SupplierRepository.js` | SQL parametrizado, versiones y consulta de compras relacionadas. |
| `src/services/SupplierService.js` | Operaciones del catálogo, concurrencia y protección del historial. |
| `src/controllers/SupplierController.js` | Traduce HTTP y errores controlados sin revelar consultas ni credenciales. |
| `src/routes/supplier.routes.js` | Endpoints protegidos por licencia, sesión y rol administrador. |
| `scripts/setup-suppliers.js` — SuppliersSetup | Verificación e instalación explícita de la estructura U023. |

Se conservan los nombres públicos de ProductsApi, ProductsApiError y CatalogForm de Productos para no romper sus consumidores. Los archivos compartidos se cargan antes de los específicos en workspace.ejs.

No se añade una hoja CSS de Proveedores ni estilos insertados desde su JavaScript. Se reutilizan botones, estados U022, campos, tabla, detalles, modales, confirmaciones, avisos y selector. La clase de distribución del filtro pasa de `module-category-field` a `module-select-field` en su definición original para servir tanto a categoría como a estado. Cada archivo nuevo documenta su responsabilidad.

## API y protección de datos

| Método y ruta | Operación |
| --- | --- |
| `GET /api/proveedores` | Lista remota: term, state, sort, direction, page y pageSize; devuelve records y total. |
| `GET /api/proveedores/:id` | Datos actuales con su version. |
| `POST /api/proveedores` | Crear. |
| `POST /api/proveedores/:id/editar` | Editar con version. |
| `POST /api/proveedores/:id/estado` | Cambiar state con version. |
| `POST /api/proveedores/:id/eliminar` | Eliminar con version cuando no existen compras. |

Todas las escrituras requieren el CSRF vigente y `x-operation-id` con UUID. CatalogApi conserva la clave cuando el usuario reintenta el mismo contenido tras perder la respuesta. OperationStore guarda la operación y su resultado en una misma transacción; no se crea un registro duplicado por ese reintento. Una clave usada con otro contenido se rechaza. Una nueva intención de crear, fuera de ese intento, es otra operación; el nombre no es una clave única.

Las ediciones obsoletas se rechazan para evitar sobrescribir el trabajo de otra sesión. La eliminación bloquea el proveedor y comprueba compras; la clave foránea existente también protege frente a compras concurrentes. NIT se almacena como texto nullable, con índice único; pueden existir varios proveedores sin NIT. Los datos se presentan como texto seguro.

## Preparación de MySQL

Base de archivos esperada: U022, commit `60cdf57f47c3831e538bba09c6bdf0d5d229fccb` de main. Se requiere la base V2 con U004 y U012 instaladas y MySQL 8.0.22 o posterior de la serie 8.

`database/migrations/U023.sql` añade en una única sentencia ALTER el campo opcional `proveedor.nit` y su índice único. Los proveedores actuales quedan con NIT sin registrar. No modifica sus demás campos, no borra tablas ni carga datos ficticios.

El preparador comprueba U012, las columnas, el motor, la clave primaria y la relación de Compras antes de alterar. Verifica la huella de U023 y utiliza un bloqueo de instalación. Si el ALTER terminó y se interrumpió el registro de la migración, repetir el comando registra la misma estructura ya comprobada; no vuelve a crearla. Una estructura incompatible se rechaza.

**Detener el servidor y respaldar la base antes de instalar.** El respaldo automático del parche cubre archivos, no sustituye el respaldo MySQL. No volver a ejecutar U004 ni importar la base de pruebas.

La cuenta de instalación necesita los permisos de lectura de U012, ALTER sobre proveedor e INSERT en app_migration. El comando utiliza la configuración existente de conexión; no cambia credenciales ni concede privilegios automáticamente. Si se utiliza una cuenta de ejecución limitada, un administrador de MySQL debe preparar U023 con una cuenta de instalación y conceder los permisos de ejecución indicados en `database/permisos_minimos.sql`, adaptados al nombre de base, cuenta y host reales. Proveedores necesita SELECT/INSERT/UPDATE/DELETE sobre proveedor y SELECT sobre compra; conserva los permisos U012 de catalogo_operacion.

## Instalación y GitHub

1. Detener el servidor, respaldar la base y extraer el ZIP en una carpeta nueva.
2. Instalar archivos: `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"` desde la carpeta extraída. El instalador comprueba la versión, respalda archivos y ejecuta 44 pruebas simuladas. Ante un fallo de esas pruebas restaura los archivos anteriores. No conecta MySQL ni modifica la licencia.
3. Desde el proyecto, preparar la estructura: `node scripts/setup-suppliers.js`. Si faltan permisos, completar el paso de administración descrito arriba y repetirlo; no continuar hasta que termine correctamente.
4. Comprobar la estructura con la cuenta de ejecución: `node scripts/setup-suppliers.js --comprobar`.
5. Publicar los archivos: `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"` desde la carpeta extraída.
6. Iniciar `node server.js` desde el proyecto y recargar con Ctrl+F5.

También están disponibles `npm run db:suppliers` y `npm run db:suppliers -- --comprobar`. No cambian dependencias ni requieren reinstalarlas.

`archivos/` contiene los archivos completos; `CAMBIOS.diff`, las diferencias; `vista-previa/`, capturas de datos ficticios. El publicador verifica la rama, la base y el contenido del manifiesto, crea un commit limitado a esos archivos y publica sin force. Si GitHub avanzó o existen cambios incompatibles, se detiene para conservarlos. El push real se realiza desde el equipo del usuario.

Revisar sin aplicar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`. Restaurar archivos con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. Esto no revierte commits ni la preparación MySQL. El campo NIT es aditivo y puede permanecer al restaurar la aplicación anterior; no eliminarlo automáticamente.

## Comprobaciones realizadas y límites

- **44 pruebas Node:** autenticación, licencia, permisos, CSRF, Productos, migraciones previas, validación de Proveedores, reintentos, versiones, NIT duplicado, eliminación con compras, parámetros SQL y recuperación del instalador de estructura simulado.
- **22 escenarios de navegador:** 7 de Proveedores, 6 de Productos, 4 de estructura/filtros y 5 de controles de marca. Se comprueban creación, edición, teclado, cambios pendientes, doble envío, respuesta perdida, lista de 55 proveedores, búsqueda/filtro, carga adicional, vacío/error/reintento, estados, eliminación, texto seguro y pantallas de 1440, 900, 390 y 320px.
- **Paquete:** comprobado en copias temporales: respaldo, restauración, aplicación repetida, BOM/CRLF, incompatibilidades, escritura interrumpida, servidor abierto, conservación de configuración y commit Git local limitado al manifiesto.

Los datos de esas comprobaciones son ficticios. No se conectó la base del negocio. No pudo ejecutarse MySQL 8 en este entorno; la migración y el SQL se verificaron con dobles de prueba, y su ejecución real queda pendiente en la instalación. Tampoco se ejecutaron DPAPI ni el arranque real de Windows. Las pruebas de Productos y de la interfaz compartida pasaron tras extraer las clases comunes; esto no equivale a afirmar que todo el sistema carece de errores o código duplicado.

El siguiente módulo previsto es **Compras**, que podrá utilizar este catálogo y las presentaciones de Productos para registrar entradas de mercadería con sus cantidades y costos.
