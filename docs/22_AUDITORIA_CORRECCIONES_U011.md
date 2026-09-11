# Auditoría y correcciones U011

Fecha: 11 de septiembre de 2026. Proyecto: **HE-PI-MA/Paris-Licoreria-Sistema**.

## Versión revisada y alcance

Se revisó el ZIP aportado por el usuario, cuya huella SHA-256 es `0b6bb078c6e3eb1e69294713eccbc5c16f6921ecd10aa352e2deec57937bde43`. Sus **155 archivos de proyecto coinciden con GitHub** en el commit [`ac3355fb81b2b28d32247a992e354b2b096e49f2`](https://github.com/HE-PI-MA/Paris-Licoreria-Sistema/commit/ac3355fb81b2b28d32247a992e354b2b096e49f2), normalizando BOM y finales de línea en textos. No había código del ZIP pendiente de incorporar al repositorio. No se encontraron instrucciones AGENTS.md ni SKILL.md dentro del proyecto.

La revisión comprende servidor, rutas, sesión, licencia, permisos, consultas, JavaScript de interfaz, estilos, vistas, pruebas, documentación y dependencias fijadas. Se examinaron las referencias entre archivos antes de retirar código. Las dependencias de Windows, configuración privada, metadatos Git y archivos de ejecución del ZIP se excluyeron del entorno de pruebas y del parche. El ZIP original se conserva.

Las correcciones son de la aplicación y de su documentación. No se ejecutaron operaciones contra la base del negocio, no se implementó el CRUD de Productos y no se cambió la migración U004 ya aplicada.

## Hallazgos y correcciones

| Hallazgo comprobado | Efecto | Corrección y archivos principales |
| --- | --- | --- |
| EJS releía y recompilaba los includes en desarrollo. | Trabajo repetido al cambiar de módulo. | `TemplateCache` reutiliza funciones compiladas e invalida al editar vistas. Se integra en `src/app.js`. |
| El servidor aceptaba contraseñas superiores al límite efectivo de bcrypt. | Un sufijo después de los 72 bytes podía ser ignorado por bcrypt. | `AuthService` rechaza más de 72 bytes UTF-8, coherente con el alta del administrador. |
| Usuario ausente o inactivo podía evitar la comparación bcrypt. | Diferencias en el trabajo realizado para rechazar credenciales. | Se compara siempre después de la búsqueda, usando un hash ficticio cuando no existe cuenta. Se mantiene el mismo error público. Esto reduce esa diferencia; no garantiza tiempos idénticos en todas las condiciones. |
| El botón de acceso volvía a habilitarse durante la espera antes de redirigir. | Permitía un segundo envío después de una respuesta correcta. | `AuthForm` conserva el bloqueo hasta navegar; los errores permiten reintentar. Se evita registrar dos veces sus eventos. |
| Quitar un filtro justo después de escribir perdía la búsqueda pendiente. | El término escrito desaparecía y la tabla consultaba otra búsqueda. | `FilterBar` incorpora el texto pendiente antes de quitar el filtro. |
| Cancelar una confirmación desde una fila dejaba el foco en el área principal. | La navegación con teclado perdía el botón de origen. | `DataTable` recupera el botón al terminar la acción y habilitar la fila, sin interrumpir otro diálogo. Se cubren acciones directas y menú. |
| El CSS de acceso se cargaba también en todos los módulos. | Descarga y análisis de estilos que esas páginas no utilizaban. | `app.css` conserva la base global; login y activación enlazan explícitamente `pages/auth.css`. |
| Siete reglas responsive del login repetían exactamente las definiciones base. | Código redundante y cambios difíciles de mantener. | Se eliminaron las repeticiones, se ordenó la indentación y se integraron las alturas de escritorio en las definiciones originales. |
| La decoración del login producía desbordamiento vertical fuera de su panel. | Aparecía una zona vacía debajo del fondo. | El panel contiene la decoración y conserva su altura automática para permitir desplazamiento cuando el formulario lo necesita. |
| Había dos utilidades equivalentes para etiquetas accesibles ocultas. | Duplicación de estilos. | Login utiliza `.app-sr-only`; se retiró `.app-visually-hidden`. |
| El soporte de pruebas arrastraba siete importaciones sin uso. | Ruido y dependencias innecesarias al leer las pruebas. | Se retiraron únicamente esas importaciones de `application-fixture.js`. |
| README y arquitectura seguían identificando U008. | Descripción incompleta del estado actual. | Se documentan U009–U011 y se añade un mapa de archivos, clases y comentarios. |

`AuthService.toPublicUser` concentra la conversión de la identidad pública utilizada por login y revalidación; el hash no se devuelve. No se modifican las contraseñas guardadas.

## Qué se conservó y por qué

- Sidebar, logos de 135 px y 100 px, iconos SVG locales, fuente del espacio de trabajo, colores y espaciado de 10 px. El contenido mantiene el alto disponible junto al menú.
- Inicio y cierre de sesión, CSRF, rotación y persistencia de sesión, revalidación del usuario, firma de licencia, vigencia, activación y permisos de URL.
- Los estilos `.app-auth-*`: siguen siendo necesarios para Activación. No eran código muerto.
- `RoleMiddleware`: es una utilidad probada para futuras API. Las páginas actuales usan las reglas de `navigation.allowed`.
- Datos de configuración y funciones sin estado en `navigation`, `module-layouts`, `runtime`, `rateLimits`, `safeLog` y scripts de consola. No necesitan una clase vacía para estar organizados.
- SQL U004 y sus huellas. La base V2 ya protege el cambio de producto/factor de una presentación utilizada en compras o ventas; no se alteró esa protección.
- Los archivos de licencia de iconos y fuentes. Las imágenes y fuentes locales no se vuelven a generar.

## Componentes disponibles para Productos

| Necesidad | Componente existente | Estado |
| --- | --- | --- |
| Acciones principales, secundarias, peligrosas y solo icono | `Button`, `Icon`, `buttons.css` | Reutilizable, con nombres accesibles y estado ocupado. |
| Campos, ayudas, errores y envío único | `FormController`, `forms.css` | Reutilizable; la operación se pasa como función del módulo. |
| Diálogos y descarte de cambios | `Modal`, `Confirm` | Cabecera/cuerpo/pie, teclado, Escape y retorno del foco. |
| Avisos persistentes y breves | `Message`, `ModuleLayout`, `NotificationCenter` | Un sistema de presentación compartido con usos distintos. |
| Listados y paginación del servidor | `DataTable` | Columnas, formato, acciones, orden, carga, vacío, error y reintento. |
| Buscador y filtros aplicados | `FilterBar` | Filtros configurables, chips, limpieza y consulta coordinada. |
| Selector con muchos registros | `SearchSelect` | Búsqueda, páginas remotas, teclado, reintento y valor en FormData. |
| Fechas | `DateRange` | Rango de fechas y validación sin conversiones de zona horaria. |
| Acciones por registro | `ActionMenu` | Menú con teclado que delega la operación al módulo. |
| Demostración | `ComponentsDemo` | `/demostracion/componentes`, solo administrador, datos ficticios en memoria. |

La base visual solicitada ya existe. Lo que falta para Productos son su clase de página, API, servicio, repositorio, validaciones y pruebas de negocio. Los mismos componentes sirven para los demás módulos sin copiar su implementación. Exportaciones, impresión, carga de archivos o selección masiva se añadirán cuando una operación concreta las necesite; no están implementadas por esta revisión.

## Medición de navegación

Se realizaron seis peticiones autenticadas alternando Productos e Inventario, con EJS sin caché y con caché. En la ejecución de comprobación:

| Medida de la prueba controlada | Sin caché | Con caché |
| --- | ---: | ---: |
| Lecturas de archivos EJS, seis páginas | 354 | 11 |
| Lecturas del include de iconos | 222 | 1 |
| Mediana de respuesta HTTP local | 11,44 ms | 3,31 ms |

Son resultados de Linux con Node 24.19.0, MySQL/licencia/equipo simulados y conexiones locales. **No miden ni explican por completo los dos segundos observados en Windows.** Sí demuestran la eliminación de lecturas y compilaciones repetidas. Las consultas de sesión y usuario y la comprobación de licencia continúan ejecutándose; no se almacenan páginas de otro usuario ni autorizaciones antiguas.

`TemplateCache` conserva funciones compiladas, tal como permite [EJS](https://ejs.co/#docs). En desarrollo se invalida la caché de EJS y la resolución de vistas de Express cuando cambian archivos EJS. Si la vigilancia no puede iniciarse o informa un error, se desactiva la caché. [Node advierte que la vigilancia de archivos depende del sistema de archivos](https://nodejs.org/api/fs.html#fswatchfilename-options-listener); en recursos de red que no comuniquen cambios, reiniciar o construir App con `{ templateCache: false }`. En producción, reiniciar al desplegar plantillas.

Para medir la instalación real: detener el servidor normal, ejecutar `node scripts/diagnosticar-navegacion.js`, entrar y alternar varios módulos. El diagnóstico U010 separa etapas de la petición y no registra usuarios, contraseñas, cookies ni consultas. Detenerlo y volver a `node server.js` al finalizar.

## Verificaciones ejecutadas

- **32 pruebas automáticas de aplicación aprobadas**, incluidas cinco regresiones U011 de autenticación y caché. Cubren sesión, licencia, roles, CSRF, red, errores, migración simulada, frontend y aislamiento del diagnóstico.
- **18 escenarios de navegador aprobados** en Chromium, agrupados en tres pruebas principales; el ejecutor contabiliza 21 resultados al incluir esos agrupadores. Incluyen teclado, foco, descarte, envío único, paginación, búsquedas, selectores, fechas, estados vacíos/error, reintento, respuestas antiguas y texto seguro.
- Comprobación visual de login, activación y módulo: se conserva la geometría de los controles, colores y tipografía. El módulo ya no solicita `auth.css` y conserva su alto completo.
- Login comprobado a 1440×1000, 1100×700, 1440×450, 900×700, 390×800 y 320×560, además de texto al 200 % en una ventana baja. La decoración no agrega desplazamiento fuera de la pantalla y los campos y botón quedan dentro del panel.
- Revisión del archivo de dependencias: consulta al [servicio de avisos de npm](https://registry.npmjs.org/-/npm/v1/security/advisories/bulk) con las **119 versiones** fijadas en `pnpm-lock.yaml`; no devolvió avisos el 11/09/2026. No se cambiaron dependencias. Esto no garantiza ausencia de vulnerabilidades desconocidas.
- La verificación de bcrypt respeta su [límite documentado de 72 bytes](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns), incluyendo caracteres Unicode.

Para repetir las pruebas comunes:

```powershell
npm test
```

La integración MySQL y las tres suites de navegador se omiten de forma explícita si no se configuran sus requisitos. Para navegador, instalar Playwright en un entorno de pruebas, disponer de Chromium y ejecutar:

```powershell
$env:PARIS_UI_BROWSER_TESTS = "1"
node --test tests/ui-browser.test.js tests/controls-browser.test.js tests/audit-browser.test.js
Remove-Item Env:PARIS_UI_BROWSER_TESTS
```

También se admite `PARIS_PLAYWRIGHT_PATH`, `PARIS_BROWSER_EXECUTABLE` y `PARIS_BROWSER_ARGS` para usar un navegador de pruebas ya instalado. No son dependencias nuevas del sistema en producción.

## Límites y comprobaciones pendientes

No se ejecutaron estas correcciones contra el MySQL real de la instalación ni contra DPAPI de Windows. Los SQL y las protecciones se revisaron en código, y las pruebas ejecutadas emplean dobles o migración simulada. La prueba `tests/mysql.test.js` necesita una base desechable expresamente configurada; no debe apuntar a la del negocio. Falta confirmar tiempo real de navegación y comportamiento visual en el navegador del equipo del usuario.

La auditoría no equivale a una garantía de ausencia de errores. Esta entrega corrige los problemas reproducidos y conserva pruebas que permiten detectarlos si reaparecen.

## Instalación y GitHub

El paquete U011 contiene los archivos completos modificados/nuevos en `archivos/`, su manifiesto, el diff y los scripts de instalación y publicación. La base esperada es el commit `ac3355f`. El instalador comprueba versiones, exige servidor detenido, respalda los archivos anteriores, instala y ejecuta las 32 pruebas comunes. Si fallan, restaura los archivos. Repetir el instalador no acumula reglas ni repite cambios.

`publicar-github.js` verifica repositorio, rama, archivos y commits; prepara solo los archivos del manifiesto, crea el commit y hace un push normal. Conserva los cambios ajenos sin incluirlos y permite reintentar una subida fallida. Si detecta cambios concurrentes en GitHub, se detiene para revisarlos.

La conexión GitHub disponible durante la auditoría permite lectura, no publicación en este repositorio. Por eso el push se realiza desde PowerShell con la cuenta HE-PI-MA ya configurada en la instalación. La entrega del ZIP por sí sola no modifica GitHub.
