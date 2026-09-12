# Estados compartidos — U022

Inactivo utilizaba el tono neutro, casi blanco, tanto en los listados como en los detalles. La revisión agrega la variante semántica `app-badge--inactive`, con fondo rojo suave, texto y borde rojizos. Activo conserva su apariencia verde.

## Organización y reutilización

Las reglas originales de etiquetas se trasladan desde `data-table.css` a `public/css/components/badges.css`, importado una sola vez por `app.css`. No quedan copias del estilo en hojas de tabla o de página. Las variantes inactivo y error comparten la misma declaración de color; mantienen nombres distintos para expresar su finalidad. El tono neutro sigue disponible para estados desconocidos.

```html
<span class="app-badge app-badge--success">ACTIVO</span>
<span class="app-badge app-badge--inactive">INACTIVO</span>
```

En una columna de DataTable:

```javascript
{
  key: 'state', label: 'Estado', type: 'state',
  states: {
    ACTIVO: { label: 'Activo', tone: 'success' },
    INACTIVO: { label: 'Inactivo', tone: 'inactive' }
  }
}
```

RecordDetails reconoce ACTIVO e INACTIVO y aplica esas mismas clases al recibir un campo de tipo state. Productos, su lista de Presentaciones y la demostración utilizan la variante inactiva. Las etiquetas son texto informativo en un span; el estilo no añade botones ni acciones al pulsarlas. Se mantienen los nombres de estado que entiende la API y la base de datos.

## Archivos incluidos

- `public/css/components/badges.css`: aspecto compartido de todas las etiquetas, con comentario de responsabilidad.
- `public/css/app.css`: carga del componente.
- `public/css/components/data-table.css`: retirada de las definiciones trasladadas.
- `public/js/components/data-table.js`: acepta el tono inactive.
- `public/js/components/record-details.js`: aplica el tono inactivo en los detalles.
- `public/js/pages/products.js` y `components-demo.js`: declaran el tono compartido.
- `README.md`, la guía de mantenimiento y este documento: revisión y uso de las clases.

No se necesita otra clase JavaScript para este cambio visual. Se reutilizan DataTable y RecordDetails y se conservan las notificaciones U021.

## Comprobación

Se ejecutan los 6 escenarios existentes del navegador de Productos, incluidos formularios, teclado, doble envío, presentación, cambio de estado, eliminación, errores, notificaciones y tamaños de pantalla. Una comprobación visual adicional compara el estilo calculado de Inactivo en tabla y detalle: coincide en color, fondo, borde, fuente, relleno y redondeado; Activo sigue verde y un estado desconocido sigue neutro. Las etiquetas conservan su naturaleza informativa.

El instalador se comprueba en copias temporales y ejecuta las 35 pruebas Node existentes. Se verifican respaldo, restauración, repetición, compatibilidad, conservación de configuración y commit local limitado a los archivos del manifiesto. Los datos de prueba son ficticios; no se conecta la base real ni se ejecuta DPAPI de Windows.

## Instalación

Base U021: `0e1419d21caae440013006d4c01253778e999657`, rama main de HE-PI-MA/Paris-Licoreria-Sistema.

1. Detener el servidor con Ctrl+C y extraer el ZIP en una carpeta nueva.
2. Ejecutar `node aplicar-parche.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
3. Ejecutar `node publicar-github.js --proyecto "C:\Users\Usuario\Documents\Paris-Licoreria-Sistema"`.
4. Iniciar `node server.js` desde el proyecto y recargar con Ctrl+F5.

`archivos/` contiene los archivos completos, `CAMBIOS.diff` las diferencias y `vista-previa/` la captura con datos ficticios. El instalador respalda y restaura si fallan las pruebas; el publicador verifica la base y publica sin force. La instalación Windows y el push real se realizan desde el equipo del usuario.

Comprobar sin aplicar: `node aplicar-parche.js --proyecto "RUTA" --comprobar`. Restaurar con el servidor detenido: `node aplicar-parche.js --restaurar "RUTA_DEL_RESPALDO"`; esto no revierte commits publicados.
