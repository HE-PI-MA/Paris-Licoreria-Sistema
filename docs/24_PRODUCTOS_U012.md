# Productos y presentaciones — U012

## Alcance y base

Revisión sobre `51ae18fbeb36c92981376c083acdb6675b03772b` (U011) de `HE-PI-MA/Paris-Licoreria-Sistema`.
Productos utiliza MySQL real y admite operaciones de administrador. No carga datos ficticios ni modifica existencias al instalar. La demostración de componentes permanece separada en `/demostracion/componentes`.

## Pantalla y formularios

- Cabecera: Productos y Nuevo producto.
- Controles: nombre o código de barras; categoría, estado y stock mínimo. El servidor filtra y pagina, sin descargar el catálogo entero.
- Tabla: producto, categoría, unidad base, cantidad de presentaciones, stock disponible, stock mínimo, estado y acciones. Orden por nombre, categoría, stock, mínimo o estado.
- Pie: total, página anterior/siguiente y 5, 10, 25 o 50 registros por página.
- Acciones: detalle, editar, presentaciones, activar/desactivar y eliminar con confirmación.
- Producto: nombre (120), categoría, unidad base, mínimo (hasta tres decimales), estado y descripción opcional (255).
- Presentación: nombre (80), equivalencia positiva (hasta tres decimales), barras opcionales únicas (50), precio en bolivianos (dos decimales) y estado.

Los campos obligatorios se señalan con asterisco. Los errores aparecen debajo del campo o en un aviso persistente. Guardar muestra “Guardando…” y bloquea campos, doble envío y cierre mientras termina. Escape y Cancelar solicitan confirmación si quedan cambios. Los selectores mantienen teclado y búsqueda remota.

El detalle permite consultar existencias físicas y disponibles. Un producto inactivo puede conservar existencias físicas, aunque la vista SQL indique cero disponible. Productos no es el formulario para registrar compras, bajas o ajustes.

## Reglas del catálogo

1. Categoría y unidad deben existir. Para crear o activar un producto, la categoría debe estar activa.
2. La unidad base no cambia si existen presentaciones, respetando la protección V2.
3. No se agregan ni activan presentaciones de un producto inactivo.
4. Nombre de presentación único dentro de su producto; código de barras único en toda la tabla. Un código vacío se guarda como NULL.
5. Una equivalencia ya utilizada en compras o ventas no se modifica. Se puede editar su precio o nombre conservando el historial.
6. Eliminar un producto comprueba todas sus presentaciones. Si alguna tiene compras o ventas, devuelve un conflicto y conserva todo. Cero stock no autoriza borrar historial.
7. Si no hay historial, el producto y sus presentaciones se eliminan en una transacción; las claves foráneas también protegen referencias concurrentes.
8. Cada edición envía la versión de los campos consultados. Un formulario desactualizado recibe 409 y debe reabrirse.
9. Cada escritura envía una clave UUID. El resultado y la escritura se confirman juntos; repetir la misma clave y datos devuelve el resultado anterior. Reutilizar la clave con otros datos devuelve 409. Tras un fallo de conexión, reintentar desde el mismo formulario conserva la clave. No hay reintentos automáticos ocultos.

## Clases y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/domain/ProductInput.js` | ProductInput normaliza y limita entradas; ProductError representa errores de negocio. |
| `src/repositories/ProductRepository.js` | Consultas parametrizadas, versiones, paginación, bloqueos y transacciones. |
| `src/services/ProductService.js` | Reglas de catálogo, referencias, historial y coordinación de escrituras. |
| `src/controllers/ProductController.js` | Adapta solicitudes/respuestas HTTP y oculta errores SQL internos. |
| `src/routes/product.routes.js` | ProductRoutes aplica licencia, sesión y rol ADMINISTRADOR a toda la API. |
| `public/js/pages/products-api.js` | ProductsApi transporta JSON, CSRF y claves de operación. |
| `public/js/pages/product-forms.js` | CatalogForm compone el modal; ProductForm y PresentationForm declaran sus campos. |
| `public/js/pages/products.js` | ProductsPage conecta tabla, filtros, formularios, detalle y acciones. |
| `views/productos/content.ejs` | Contenedor del catálogo, sin ejemplos ni JavaScript incrustado. |
| `public/css/pages/products.css` | Solo distribución específica de formularios, detalle y barra de presentaciones. |
| `scripts/setup-products.js` | ProductsSetup comprueba U004 e instala/verifica la infraestructura U012. |
| `database/migrations/U012.sql` | Nueva tabla de control de reintentos; no altera tablas del negocio. |

Se reutilizan DataTable, FilterBar, SearchSelect, Modal, Confirm, FormController, Button, Message, NotificationCenter y ModuleLayout. No se duplica su implementación. FormController admite `error.userMessage` como texto para explicar conflictos del servidor. Los nuevos scripts se cargan únicamente en Productos y después de los componentes comunes.

Los comentarios explican el propósito de cada archivo y las reglas que no resultan evidentes. No se añaden comentarios a cada asignación. CSS mantiene las definiciones originales; no se agregan parches visuales globales al final de otros archivos.

## API

Todas las rutas están bajo `/api/productos`. Los GET no escriben. Los POST requieren JSON, sesión, licencia, rol de administrador, `X-CSRF-Token` y `X-Operation-Id` (UUID v4).

| Método y ruta | Resultado |
| --- | --- |
| GET `/` | `{records,total}`; parámetros page, pageSize, term, categoryId, state, lowStock, sort, direction. |
| GET `/opciones/categories` o `/opciones/units` | `{options:[{value,label}],total}`, búsqueda y paginación. |
| GET `/:id` | Detalle y versión del producto. |
| POST `/` | Crear producto; devuelve `{id}`. |
| POST `/:id/editar` | Actualizar campos y versión esperada. |
| POST `/:id/estado` | Estado deseado y versión. |
| POST `/:id/eliminar` | Versión y eliminación protegida. |
| GET `/:id/presentaciones` | Presentaciones paginadas del producto. |
| GET `/:id/presentaciones/:presentationId` | Detalle, versión e indicador de equivalencia usada. |
| POST `/:id/presentaciones` | Crear presentación. |
| POST `/:id/presentaciones/:presentationId/editar` | Editar presentación. |
| POST `/:id/presentaciones/:presentationId/estado` | Activar/desactivar presentación. |
| POST `/:id/presentaciones/:presentationId/eliminar` | Eliminar presentación sin historial. |

Ejemplo de producto: `{name,categoryId,unitId,description,minimum,state}`. Edición añade `version`. Presentación: `{name,factor,barcode,price,state}`. El servidor conserva precisión decimal con cadenas y rechaza campos inesperados como stock. Las acciones sobre presentaciones verifican conjuntamente el identificador del padre y del hijo.

400: formato de petición; 401: sesión; 403: licencia o permiso; 404: registro ausente; 409: conflicto/historial/reintento; 422: validación; 503: infraestructura o permisos pendientes. Los valores se muestran como texto seguro, sin insertar HTML del usuario.

## Instalación y permisos

Requiere la instalación U011, MySQL 8.0.22 o posterior de la serie 8 y la migración U004 original. Conservar dependencias: no hay paquetes npm nuevos. Detener el servidor antes de aplicar el ZIP.

El instalador valida los archivos, respalda el código anterior, instala los archivos completos y ejecuta las 35 pruebas automáticas sin base del negocio. Luego ejecuta `node scripts/setup-products.js` en la conexión configurada.

U012 crea solamente `catalogo_operacion`: usuario, clave, huella de solicitud, resultado JSON y fecha. No contiene contraseñas ni el formulario completo. Registra U012 en `app_migration`. No borra ni modifica productos, compras, ventas o existencias. No requiere reconstruir U004. No eliminar sus resultados mientras puedan existir reintentos pendientes.

Una cuenta de instalación necesita CREATE en la base, REFERENCES sobre usuario e INSERT sobre app_migration; una cuenta de ejecución no necesita estos permisos. `database/permisos_minimos.sql` incluye los permisos de ejecución precisos para catálogo y solo lectura del historial. Ajustar explícitamente base, cuenta y host si no se llaman `paris_licoreria` y `paris_app@localhost`.

Si la cuenta configurada tiene permisos limitados, el instalador puede terminar con los archivos instalados y la preparación SQL pendiente. No indica éxito ni publica en ese caso. Un administrador SQL debe ejecutar `database/migrations/U012.sql`, registrar el checksum incluido en `REGISTRAR_U012.sql` del paquete y conceder los permisos de catálogo a la cuenta de ejecución. Después repetir el instalador: reconoce los archivos instalados y reanuda la comprobación sin duplicar cambios. No compartir ni subir `.env` para hacerlo.

Comprobación posterior:

```powershell
node scripts/setup-products.js --comprobar
node scripts/db-check.js
node server.js
```

El publicador del ZIP guarda únicamente los archivos de su manifiesto. Comprueba rama main, repositorio, contenido, índice vacío y base Git exacta antes de crear el commit. No fuerza push ni mezcla cambios ajenos. Si GitHub recibe otro commit, se detiene para integrar esos cambios.

Para restaurar código, con el servidor detenido: `node aplicar-parche.js --restaurar RUTA_DEL_RESPALDO`. Esa restauración no borra la infraestructura SQL ni operaciones que se hayan registrado después de instalar; volver al código previo no equivale a restaurar datos.

## Comprobaciones realizadas

- Node: 35 comprobaciones aprobadas (las opcionales de navegador y MySQL se ejecutaron por separado).
- Chromium: 18 comprobaciones previas de componentes y regresiones U011 aprobadas; 5 nuevas de Productos aprobadas. Consulta remota, paginación, vacío/error/reintento, teclado, descarte, foco, validación, envío único, reintento con la misma clave, edición de unidad/factor protegidos, presentaciones y error persistente. Anchos de 320, 390, 900 y 1440 px.
- MySQL Community 8.4.11, base desechable y cuenta con permisos mínimos: 9 escenarios U012 aprobados. Instalación repetible, tabla incompatible, permisos, envíos simultáneos, edición/versiones, referencias, filtros literales, barras únicas, presentaciones, estados, historial de compra/venta y eliminación sin historial. También pasó la integración U004 existente.
- Instalador: conflictos, archivos incompletos, respaldo, aplicación repetida, restauración y fallo de escritura; publicador probado con un commit local desechable.

Las pruebas de interfaz interceptan una API ficticia; las de MySQL ejercitan repositorio y servicio reales con el esquema, vistas y protecciones existentes. No se ejecutaron operaciones en tu Windows ni en tu base. La licencia/DPAPI se simula en este entorno Linux. El push lo realizará tu Git local al ejecutar el publicador.

Para repetir: `npm test`; para MySQL de pruebas, configurar `PARIS_MYSQL_TEST=1`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER` y `TEST_DB_PASSWORD`, usando un servidor de pruebas con permiso de crear bases/cuentas temporales. Para Chromium, usar las variables de las pruebas existentes y ejecutar también `tests/products-browser.test.js`.

## Límites funcionales

No se implementa administración de categorías/unidades, carga de fotos, importación/exportación, compras, ventas, facturación ni ajuste manual de stock. Categorías y unidades se eligen del catálogo ya existente. Los errores SQL no se traducen en permisos adicionales automáticos. U011 y sus optimizaciones de navegación se conservan.
