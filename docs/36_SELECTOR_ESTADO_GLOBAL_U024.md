# Selector de estado compartido — U024

El campo Estado de los formularios de catálogo usaba un select HTML con la apariencia del campo compartido, pero abría la lista nativa del navegador. Por eso sus opciones se veían azules y blancas en Windows.

## Corrección

`CatalogForm.state()` ahora conecta el campo a `SearchSelect` con `searchable: false`. Esto aplica a Nuevo/Editar proveedor, Producto y Presentación, porque los tres formularios heredan el mismo método.

El componente conserva los estilos existentes de campos y selectores: fondo, borde, flecha, foco y opciones. No se añade CSS, una clase de página ni otro sistema de selectores. La lista flota sobre el cuerpo del modal y no empuja los demás campos.

SearchSelect solo añade una opción vacía interna cuando se usa con búsqueda. Las elecciones fijas conservan exactamente sus opciones declaradas; Estado muestra únicamente Activo e Inactivo, incluso después de bloquear y desbloquear el formulario. Los filtros que declaran una opción Todos la conservan.

Se mantiene el select original oculto para FormData y validación. Su valor continúa siendo ACTIVO o INACTIVO; la API y MySQL no cambian. El control visible mantiene su etiqueta, teclado, Escape, bloqueo durante Guardando… y limpieza al cerrar el modal. Abrir el selector no genera cambios pendientes; elegir otro estado sí.

## Cómo reutilizarlo

Los formularios que heredan CatalogForm deben llamar a `this.state(valor)` para incorporar el campo. No crear un select de Estado aparte ni copiar estilos en el módulo.

Para otra elección fija, usar `new ParisUI.SearchSelect({ select, searchable: false })`, registrar la instancia en los componentes del formulario y destruirla al cerrar. Para catálogos con búsqueda, conservar la variante con búsqueda y sus consultas actuales.

## Verificación

- 44 pruebas Node existentes mediante el instalador, con datos simulados.
- 14 escenarios de navegador: 8 de Proveedores y 6 de Productos/Presentaciones. La regresión comprueba el selector visible, las dos opciones, selección por teclado, Escape, cambios pendientes, valor enviado, edición de un proveedor inactivo, bloqueo durante el envío y apertura sin cambiar la altura del modal.
- El paquete se comprueba en copias temporales: respaldo, restauración, compatibilidad, aplicación repetida, escritura interrumpida, servidor detenido, configuración privada y commit local limitado al manifiesto.

Las pruebas no modifican la base del negocio. El navegador de prueba es Chromium en Linux; la comprobación visual en Windows corresponde a la instalación del usuario. No se requiere ejecutar migraciones ni volver a preparar Proveedores.

## Instalación y publicación

Base: U023, commit `236565151d5856c3beed668b24b3e744d53fa362` de main en HE-PI-MA/Paris-Licoreria-Sistema.

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Desde la carpeta extraída: `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Publicar desde esa misma carpeta: `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Iniciar `node server.js` desde el proyecto y recargar con Ctrl+F5.

El instalador comprueba los archivos, crea un respaldo y restaura si las pruebas fallan. El publicador verifica la base remota y sube exclusivamente el commit del parche, sin force. La publicación real se realiza mediante el Git configurado en el equipo del usuario.

El paquete contiene los archivos completos en archivos/, CAMBIOS.diff, estas instrucciones y una captura con datos ficticios. Comprobar sin aplicar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`. Restaurar archivos con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`; no revierte commits publicados.
