# Categoría nueva en Productos — U036

## Problema y resultado

En Nuevo producto, Categoría solo admitía una opción existente. Al salir del campo, el selector borraba un nombre nuevo como AGUAS. Compras ya admitía ese caso.

Ahora se puede escribir el nombre de una categoría o elegir una sugerencia. El texto permanece al pasar al siguiente campo. La categoría nueva se guarda únicamente al pulsar Guardar y completar correctamente el alta del producto.

Ejemplo: escribir AGUAS en Categoría, completar el nombre del producto y seleccionar Unidad en ¿Cómo lo cuentas? Al guardar quedan registrados el producto y su categoría. Otra botella puede usar la misma categoría.

## Reglas de guardado

- Se recortan los espacios, se unifican los espacios interiores y se convierte el nombre a mayúsculas; límite de 80 caracteres y nombre obligatorio.
- Una coincidencia activa se reutiliza, incluso si se escribe sin seleccionarla de la lista.
- Una categoría inactiva produce un error en el campo; no se duplica ni se reactiva automáticamente.
- Categoría, producto, foto opcional y primera forma de venta pertenecen a la misma transacción. Si falla un paso, se revierten los registros nuevos.
- Cancelar no envía el alta. Los reintentos conservan la protección contra duplicados.
- El alta de producto no aumenta existencias. La entrada de mercancía se registra en Compras.
- Editar producto mantiene la selección de categorías existentes. U036 resuelve el alta desde Nuevo producto.

## Clases compartidas

`CatalogForm.selector` configura `SearchSelect.allowCustom` y conserva la validación obligatoria en el campo visible. Las sugerencias siguen flotando sobre el formulario y utilizan el CSS global existente; no se añaden estilos propios ni nuevas reglas CSS.

`ProductInput.categoryFields` concentra las reglas de entrada y las reutiliza `PurchaseInput`. `ProductService.category` resuelve la coincidencia o el alta; `PurchaseService` usa ese mismo método. El repositorio conserva sus consultas parametrizadas sobre la conexión de la operación.

Los clientes anteriores pueden seguir enviando `categoryId`. En un alta se admite alternativamente `categoryName`; enviar ambos se rechaza. Se conserva la huella de los datos antiguos para los reintentos de operaciones.

## Instalación

Aplicar sobre U035 con el servidor detenido. El instalador verifica los archivos y crea un respaldo antes de reemplazarlos. Después, reiniciar el servidor y recargar la página en computadora y celular. No hay migración, cambio de dependencias ni ejecución de `setup-media.js` para U036. Los permisos de categoría que ya utiliza Compras son suficientes.

El publicador del paquete verifica los cambios y los sube mediante el Git local, sin forzar ni reemplazar otros commits. Instalar archivos no publica GitHub por sí solo.

## Verificación

Las pruebas de entrada y servicio cubren nombres inválidos, normalización, coincidencias activas, categorías inactivas y compatibilidad con Compras. Las pruebas con MySQL temporal cubren alta conjunta, reintentos, concurrencia y reversión ante errores. Las pruebas de navegador ejercitan el formulario real en escritorio y móvil: escribir y salir, cancelar, guardar, volver a seleccionar la categoría y mostrar errores de campo.

Las integraciones requieren activación explícita mediante `PARIS_MYSQL_TEST=1` o `PARIS_UI_BROWSER_TESTS=1` y `TEST_DB_*`, y trabajan en bases aleatorias desechables. Las pruebas no utilizan la base de la instalación.
