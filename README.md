# París Licorería

Sistema web para una licorería, con Node.js, Express, EJS y MySQL 8. El servidor de la instalación utiliza Windows para verificar el equipo y proteger la activación con DPAPI.

## Estado del desarrollo — U023

**Funciona:** activación, inicio y cierre de sesión, sesiones persistentes, revalidación del usuario, perfil de consulta, permisos de páginas y sidebar adaptable. Los nueve módulos comparten cabecera, controles, contenido y mensajes. Iconos e Inter se distribuyen localmente en el espacio de trabajo.

**Productos U012:** catálogo conectado a MySQL, búsqueda y filtros remotos, edición, estados, eliminación protegida y presentaciones con equivalencias, barras y precios. Acceso de administrador. El stock se consulta, no se edita aquí.

**Proveedores U023:** catálogo de proveedores con búsqueda remota, filtro por estado, creación, detalle, edición, activación y eliminación protegida cuando no existen compras. NIT opcional y único. Acceso de administrador. Reutiliza DataTable, formularios, modales, avisos y estilos; Productos y Proveedores comparten CatalogApi, CatalogForm, RecordInput y OperationStore.

**Interfaz U015:** cabecera compacta con marca ampliada y hamburguesa integrada en móvil. Texto en mayúsculas, buscador y categoría con estilo compartido, botones de acciones primarios y tabla uniforme sin barra ni contador visibles. Se conservan carga por bloques, numeración, prioridades y teclado.

**Sidebar U016:** ancho automático según pantalla: completo por encima de 1200px, solo iconos entre 769 y 1200px y menú móvil hasta 768px. Marca centrada sin enlace a Inicio; se elimina el control manual de ancho y su preferencia almacenada.

**Interfaz U020:** hover compartido con Eliminar, botones dorados de marca, menú con rellenos sólidos, campos centralizados y limpieza de código sin referencias. Se conserva el detalle alineado y los ejemplos de campos que se ocultan al enfocar. Presentaciones usa una lista continua de alto adaptable. Se conservan los encabezados informativos, sugerencias flotantes y avisos de U018, junto con el sidebar automático U016.

**Notificaciones U021:** guardar, editar, activar, desactivar y eliminar presentaciones reutiliza la notificación flotante verde del catálogo, con icono y cierre automático a los dos segundos. Los errores siguen visibles para permitir corregirlos o reintentar.

**Estados U022:** etiquetas compartidas en `components/badges.css`. Activo conserva el verde e Inactivo utiliza fondo rojo suave, texto y borde rojizos en Productos, Presentaciones, detalles y demostración.

**Pendiente:** las operaciones de los otros módulos. Inicio conserva el saludo y las pantallas restantes conservan sus espacios de preparación.

La base V2 y la migración U004 contienen procedimientos y vistas para parte del negocio; Productos y Proveedores incorporan su API y formularios. Compras, Inventario, Ventas, Caja, Reportes y Usuarios todavía no tienen sus operaciones conectadas a la interfaz.

La interfaz utiliza clases compartidas para formularios, sidebar, mensajes, modales, confirmaciones, tablas, filtros, selectores, fechas y menús de acciones. Login y activación comparten AuthForm. CSS conserva su organización por componentes; la auditoría U011 corrige interacciones y optimiza la compilación de EJS sin cambiar el diseño.

## Documentación

| Documento | Qué explica |
| --- | --- |
| [Proveedores U023](docs/35_PROVEEDORES_U023.md) | Operaciones, clases compartidas, preparación del NIT, permisos, comprobaciones e instalación. |
| [Estados compartidos U022](docs/34_ESTADOS_COMPARTIDOS_U022.md) | Clases CSS reutilizables para estados, comprobaciones e instalación. |
| [Notificaciones de presentaciones U021](docs/33_NOTIFICACIONES_PRESENTACIONES_U021.md) | Avisos compartidos, duración, errores, comprobaciones e instalación. |
| [Limpieza y botones U020](docs/32_LIMPIEZA_Y_BOTONES_U020.md) | Hover único, auditoría de referencias, clases compartidas, pruebas e instalación. |
| [Botones, detalle y campos U019](docs/31_BOTONES_DETALLES_Y_CAMPOS_U019.md) | Marca, campos, listados dentro de modales e instalación. |
| [Interacciones visuales U018](docs/30_INTERACCIONES_VISUALES_U018.md) | Sugerencias, tablas, acciones, avisos, formularios e instalación. |
| [Productos y modales U017](docs/29_PRODUCTOS_Y_MODALES_U017.md) | Tabla, detalles, selectores, modales, notificaciones e integración. |
| [Sidebar automático U016](docs/28_SIDEBAR_AUTOMATICO_U016.md) | Tamaños, marca, teclado, instalación y comprobaciones. |
| [Ajustes visuales U015](docs/27_AJUSTES_VISUALES_U015.md) | Componentes, mayúsculas, selector, móvil, instalación y comprobaciones. |
| [Tablas y estilo U014](docs/26_TABLAS_Y_ESTILO_U014.md) | Scroll continuo, numeración, prioridades, estilo e integración. |
| [Interfaz U013](docs/25_INTERFAZ_MODULOS_U013.md) | Cabecera, botones, categoría directa, integración y comprobaciones. |
| [Productos U012](docs/24_PRODUCTOS_U012.md) | Instalación, permisos, clases, API, formularios y comprobaciones del catálogo. |
| [Arquitectura](docs/01_ARQUITECTURA_DEL_SISTEMA.md) | Capas, archivos y recorrido de una petición. |
| [Configuración y ejecución](docs/02_CONFIGURACION_Y_EJECUCION.md) | Requisitos, dependencias y arranque. |
| [Base de datos y roles](docs/03_BASE_DE_DATOS_Y_ROLES.md) | Tablas, procedimientos y permisos actuales. |
| [Licenciamiento](docs/04_LICENCIAMIENTO_Y_ACTIVACION.md) | Firma, equipo y activación. |
| [Autenticación y pruebas](docs/05_AUTENTICACION_SESIONES_Y_PRUEBAS.md) | Controles implementados y límites de la verificación. |
| [Bitácora](docs/08_BITACORA_DE_DESARROLLO.md) | Jornadas e información de horas confirmada. |
| [Estructura común](docs/11_ESTRUCTURA_MODULOS_U006.md) | Componentes y mensajes reutilizables. |
| [Finalidad de los módulos](docs/15_MODULOS_Y_ALCANCE.md) | Qué hará cada módulo y qué falta. |
| [Mantenimiento del código](docs/16_GUIA_DE_MANTENIMIENTO.md) | Dónde cambiar cada parte y cómo documentarla. |
| [Organización POO](docs/18_ORGANIZACION_POO_U008.md) | Clases JavaScript, componentes CSS y pruebas de U008. |
| [Auditoría y correcciones U011](docs/22_AUDITORIA_CORRECCIONES_U011.md) | Hallazgos, cambios, pruebas y límites de la revisión del ZIP. |
| [Mapa de archivos y comentarios](docs/23_MAPA_ARCHIVOS_Y_COMENTARIOS.md) | Propósito del código y reglas para desarrollar Productos. |
| [Revisión U007](docs/17_REVISION_U007.md) | Limpieza, comprobaciones y publicación. |

Los documentos U002–U006E registran entregas anteriores; los valores visuales vigentes se encuentran en la guía de mantenimiento.

## Ejecutar la instalación existente

Conservar `.env`, dependencias, licencia, activación y base de datos. U012 añade únicamente una tabla de control de reintentos. Instalarla una vez con `node scripts/setup-products.js`, usando una cuenta con permisos de instalación. No volver a ejecutar la migración U004.

U023 añade el NIT opcional a proveedor. Con el servidor detenido y la base respaldada, ejecutar una vez `node scripts/setup-suppliers.js` con permisos de instalación. Actualizar los permisos de ejecución según [Proveedores U023](docs/35_PROVEEDORES_U023.md); no se conceden privilegios automáticamente ni se modifica la estructura al iniciar el servidor.

```powershell
npm test
node scripts/setup-products.js --comprobar
node scripts/setup-suppliers.js --comprobar
node scripts/db-check.js
node server.js
```

El primer comando ejecuta pruebas simuladas; la integración con MySQL real se omite si no se configura expresamente. Los comandos de preparación con --comprobar verifican U012 y U023 sin alterar la estructura. `db-check.js` consulta cuatro comprobaciones sin corregir datos; `server.js` inicia el servidor.

Para una instalación nueva, seguir la configuración y la [migración U004](docs/09_PARCHE_U004.md). Se conserva `pnpm-lock.yaml`; no se actualizan dependencias en U012.

## Configuración privada

`.env` contiene la conexión y el secreto de sesión; no debe subirse a Git. La clave privada, los respaldos, las licencias y la activación permanecen fuera del repositorio. La clave pública de verificación sí forma parte del código.

Desarrollo local: `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=3100`. Producción: origen HTTPS exacto y TLS directo o proxy de confianza explícito. El servidor valida esta configuración antes del arranque.

## Componentes compartidos U009

La base visual reutilizable incluye botones, campos, modales, confirmaciones, mensajes, notificaciones y tablas. Guía y ejemplos: [Componentes compartidos](docs/20_COMPONENTES_COMPARTIDOS_U009.md).

La demostración está en `/demostracion/componentes`, disponible con licencia y sesión de administrador. Utiliza datos ficticios en memoria; Productos y Proveedores usan sus respectivas API y la base configurada en `/productos` y `/proveedores`.

## Controles compartidos U010

La demostración `/demostracion/componentes` incorpora filtros configurables, selectores con búsqueda, fechas, ordenamiento programático y menú de acciones. Sus datos son ficticios. Guía de integración: [Filtros, selectores y listados U010](docs/21_FILTROS_SELECTORES_Y_LISTADOS_U010.md).

Para medir navegación local: detener el servidor y ejecutar `node scripts/diagnosticar-navegacion.js`. El arranque habitual `node server.js` mantiene las mediciones desactivadas.

## Rendimiento y mantenimiento U011

`TemplateCache` reutiliza las funciones compiladas de EJS. En desarrollo invalida la caché al editar vistas; si falla la vigilancia, la desactiva. En producción se reinicia el servidor después de desplegar plantillas. No almacena páginas HTML ni decisiones de acceso: sesión, usuario y licencia se revalidan.

Las contraseñas admiten hasta 72 bytes UTF-8, el mismo límite utilizado al crear el administrador. Los formularios de acceso permanecen bloqueados tras el éxito hasta completar su redirección.
