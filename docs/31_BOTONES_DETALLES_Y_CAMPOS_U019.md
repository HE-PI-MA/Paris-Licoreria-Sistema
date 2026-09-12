# Botones, detalle y campos — U019

## Resultado

Los botones principales, incluidos Nuevo producto, Acciones, Guardar y Nueva presentación, usan el dorado sólido y el texto oscuro de la marca París. Se conservan sus tamaños, iconos, esquinas, enfoque de teclado, bloqueo y estado de procesamiento.

Todas las opciones de ActionMenu usan relleno sólido, texto e icono blancos, siguiendo la presentación de Eliminar: azul para consultar, ocre para editar, violeta para presentaciones, verde para activar, naranja para desactivar y rojo para eliminar. Ya no usan los fondos claros de U018. Las acciones permanecen identificadas por texto e icono, además del color.

RecordDetails conserva un contenedor único. En escritorio presenta las etiquetas a la izquierda y todos los valores alineados en la segunda columna. En pantallas pequeñas coloca cada valor debajo de su etiqueta. Las cantidades conservan su formato y no se cambian los valores originales. El centrado numérico de las tablas permanece.

El texto de ejemplo de un input —placeholder— desaparece al recibir foco y vuelve al salir si el campo sigue vacío. Se resuelve en forms.css mediante `.app-input:focus::placeholder`, sin una nueva clase JavaScript ni eventos. Las etiquetas, textos escritos, categorías seleccionadas, validación y FormData se conservan. La regla también se aplica al buscador y al cuadro de SearchSelect.

Presentaciones ya no muestra Por página, Anterior, Página ni Siguiente. Reutiliza DataTable en modo scroll con carga por bloques y altura ajustada al contenido. Una lista corta ocupa únicamente el alto necesario; una larga tiene desplazamiento interior con barra oculta y obtiene las páginas siguientes al avanzar. Si faltan datos aparece Cargar más y, si una consulta falla, Reintentar. Al completar la lista se oculta ese pie. El cierre del modal permanece disponible.

## Componentes

| Archivo | Responsabilidad |
| --- | --- |
| `public/css/components/buttons.css` | Botones principales con los colores de marca. |
| `public/css/components/action-menu.css` | Opciones con relleno sólido y texto blanco. |
| `public/css/components/forms.css` | Oculta el ejemplo al enfocar, sin cambiar el valor del campo. |
| `public/css/components/record-details.css` | Distribución alineada y adaptable del detalle. |
| `public/js/components/record-details.js` | Documenta la distribución; conserva los valores seguros. |
| `public/js/components/data-table.js` | Opción compartida fillHeight para ajustar el alto en modales y limpieza al destruirse. |
| `public/css/components/data-table.css` | Altura natural de listados cortos y límite de desplazamiento para listados largos. |
| `public/js/pages/products.js` | Configura Presentaciones con la clase DataTable existente. |
| `tests/brand-controls-browser.test.js` | Comprobaciones U019 con registros ficticios. |

Se modifican las definiciones originales. No se añaden estilos al final para tapar otros, no se duplican clases ni se cambian operaciones de negocio, dependencias o rutas de carga.

## Reutilización

Para listados dentro de un modal:

```javascript
const table = new ParisUI.DataTable({
  container: contenedor,
  columns: columnas,
  actions: acciones,
  load: parametros => api.listar(parametros),
  mode: 'scroll',
  fillHeight: false,
  pageSize: 50,
  numbered: true
});
```

fillHeight es true por defecto: conserva los módulos que aprovechan el espacio disponible. false permite que el alto siga al contenido con el límite definido en data-table.css. No significa cargar todos los registros de golpe ni quitar límites del servidor. Llamar destroy al cerrar el modal.

Usar app-button--primary para acciones principales y ActionMenu con tone para las opciones. No agregar estilos propios de cada módulo. Para campos, usar app-input y una etiqueta accesible: el placeholder no sustituye a la etiqueta.

## Integración y comprobación

Base: U018, commit `be42693010fa1483eb85c9b402b5a154fb2e2ed7`, verificado en `HE-PI-MA/Paris-Licoreria-Sistema`.

1. Detener el servidor con Ctrl+C.
2. Extraer el ZIP y ejecutar `node aplicar-parche.js --proyecto "RUTA_DEL_PROYECTO"`.
3. Ejecutar `node publicar-github.js --proyecto "RUTA_DEL_PROYECTO"`.
4. Iniciar `node server.js` y recargar con Ctrl+F5.

El instalador verifica la base, respalda y aplica archivos completos. Ejecuta 35 pruebas de la aplicación con datos simulados y restaura si falla. El publicador incluye únicamente esta revisión, verifica su contenido y usa Git del equipo sin force. Si hay otra revisión o modificaciones diferentes, se detiene para evitar sobrescribirlas.

Solo comprobar: `node aplicar-parche.js --proyecto RUTA --comprobar`.
Restaurar archivos, con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`. No revierte commits publicados.

Se comprueban 35 pruebas Node y 22 escenarios en Chromium: U009 (7), U012 (5), U014 (6), U019 (4). Incluyen teclado, validación, guardado único, cambios pendientes, reintentos, foco, búsqueda, carga completa y conservación de valores al enfocar. Presentaciones se verifica con una fila y con 68 registros ficticios, incluyendo fallo de la segunda página y recuperación sin duplicados.

El ZIP incluye capturas ficticias en vista-previa. La instalación se verifica en copias temporales, incluyendo respaldo, restauración, BOM/CRLF, conflicto, fallo de escritura, servidor abierto y repetición. El publicador se comprueba con un repositorio local de prueba, sin push.

No se conecta la base real. Falta comprobar el instalador en Windows y realizar la publicación con la sesión Git del usuario.
