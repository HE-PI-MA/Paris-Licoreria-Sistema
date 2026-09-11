# U006E — Altura de las dos versiones del logo

> Registro histórico de U006E, reemplazado por ajustes posteriores. Los valores actuales son 135 px para el logotipo y 100 px para el símbolo; consultar `16_GUIA_DE_MANTENIMIENTO.md`.

Las dos versiones de marca del sidebar utilizan un bloque de la misma altura al expandir y contraer el menú. La referencia es el bloque del logo completo: `8.25rem`, equivalente a 132 px con el tamaño raíz de 16 px.

## Ajuste

- `--sidebar-logo-height` controla la altura común de los dos bloques de imagen en escritorio.
- El logo completo mantiene su presentación existente dentro de su bloque de 132 px.
- El símbolo independiente ocupa 132 px de alto y conserva su proporción original. Su ancho se calcula automáticamente; la imagen completa permanece visible.
- El sidebar contraído pasa de 88 a 120 px de ancho para alojar el símbolo más alto.
- El encabezado pasa a 200 px de alto en ambos estados de escritorio. El enlace de marca ocupa los primeros 152 px y centra la imagen verticalmente, dejando 10 px arriba.
- El botón para expandir conserva su posición debajo de la imagen, con espacio separado para evitar superposiciones.
- En móviles se conserva la presentación del logo completo, sin modo de símbolo contraído.

Los valores en píxeles indicados corresponden al tamaño raíz de 16 px. Los espacios transparentes propios de cada archivo forman parte de la imagen; igualar los bloques no modifica esos espacios ni redibuja la marca.

## Archivos

El ajuste de presentación se realiza en `public/css/components/sidebar.css`. No se modifican ni se generan imágenes nuevas. Las rutas siguen siendo `public/img/login/paris-login-logo.webp` y `public/img/brand/paris-isologo.png`.

La navegación, los iconos, los módulos y los datos conservan su funcionamiento. El instalador verifica la versión de los estilos y las imágenes de referencia, conserva una copia del archivo anterior y permite restaurarla. No modifica MySQL, configuración ni GitHub.
