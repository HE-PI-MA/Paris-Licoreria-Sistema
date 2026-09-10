# Parche U004 — auditoría de París Licorería

Fecha: 10/09/2026. Base: aplicación `3b18c4766f5a57fb6e8a576f66b8840edb74011d`; SQL V2 `75c467b92d86f364ada82603d99790c453f78744`.

## Cambios cubiertos

| Auditoría | Corrección |
|---|---|
| A01 — errores con contraseñas | El registro solo contiene evento, categoría controlada e identificador de petición; JSON inválido responde 400 y tamaño excedido 413. |
| A02 — cookie en producción | HTTPS directo o proxy explícito; se exige origen HTTPS y se conservan cookies Secure. |
| D01 — anulación tras cierre | Se exige caja abierta, con bloqueo de sesión antes de venta. Una caja cerrada conserva su historial. |
| A03 — sesiones en memoria | Almacén MySQL con expiración, renovación, eliminación y limpieza de vencidas. |
| A04 — licencia bloqueante | Operaciones asíncronas, identidad reutilizada y caché de descifrado de datos idénticos; límites antes del trabajo costoso. |
| A05 — formularios externos | Token CSRF ligado a la sesión, comprobación de origen y API que acepta JSON. |
| D02 — stock incoherente | Disponible excluye ubicaciones y productos inactivos; físico conserva existencias. |
| D03 — fechas de caja | Se comprueba apertura, venta y cierre; se ajustan las fechas del escenario de pruebas del repositorio SQL. |
| D04 — historial modificable | Triggers para detalles, cajas, arqueos y denominaciones usadas; guía de permisos mínimos. |
| A06 — JSON en páginas | Redirección al login con mensaje de sesión vencida, o a activación. |
| A07 — activación repetida | Operación idempotente: no vuelve a escribir una activación válida ni cambia su fecha. |

Además: nombres de tablas de autenticación en minúscula; creación inicial de administrador; correcciones de consultas de pago mixto y cantidades con distintas unidades; documentación actualizada y ajuste de desbordamiento vertical del login.

No se agregan dashboard ni módulos de negocio nuevos. Tampoco se cambian contraseñas de usuarios existentes, fechas antiguas ni permisos SQL de una instalación de forma automática.

## Aplicación del paquete único

1. Detener el servidor de París Licorería, incluyendo `pnpm dev` o el servicio que lo ejecute.
2. Crear un respaldo completo y reciente de `paris_licoreria`, incluyendo datos, rutinas y triggers. Puede utilizarse Data Export de MySQL Workbench con esas opciones. Conservar el archivo `.sql` fuera de la carpeta del parche.
3. Descomprimir `Parche_Paris_Licoreria_U004.zip`.
4. Abrir PowerShell en la carpeta descomprimida y ejecutar el instalador indicando las rutas reales:

```powershell
node .\aplicar-parche.js --proyecto "C:\Proyectos\Paris-Licoreria-Sistema" --backup "C:\Respaldos\paris_antes_U004.sql"
```

El instalador comprueba los archivos contra la versión auditada, crea una copia de los archivos afectados, aplica los cambios, ejecuta las pruebas de aplicación y ejecuta la migración con la configuración de la instalación. Si encuentra un archivo con cambios diferentes, se detiene antes de reemplazarlo.

Si también tienes el repositorio separado de la base de datos, puedes añadir su ruta para actualizar sus archivos auxiliares:

```powershell
node .\aplicar-parche.js --proyecto "C:\Proyectos\Paris-Licoreria-Sistema" --backup "C:\Respaldos\paris_antes_U004.sql" --base-proyecto "C:\Proyectos\BD1-Paris-Licoreria"
```

Para comprobar compatibilidad sin escribir archivos ni ejecutar SQL, añadir `--comprobar`.

Las carpetas mostradas son ejemplos. El instalador conserva el `.env`, `node_modules`, `.git`, la clave pública original y los archivos de licencia/activación.

## Requisitos y comportamiento de la migración

Se requiere Node.js 20 o posterior, las dependencias del proyecto ya instaladas y MySQL 8 con las 21 tablas y los cinco procedimientos V2. La cuenta utilizada en la migración necesita permisos para crear tablas, reemplazar vistas, rutinas y triggers. No se conceden permisos administrativos al usuario operativo.

La migración no contiene `DROP DATABASE`, `DROP TABLE` ni instrucciones para borrar operaciones existentes. Agrega dos tablas de infraestructura y reemplaza definiciones SQL. MySQL confirma el DDL por instrucción: la actualización completa no es una transacción única. Por ello se aplica con servidor detenido y respaldo previo.

La marca de versión U004 se registra únicamente cuando todas las instrucciones terminan correctamente. Una marca separada U004_STARTED identifica el contenido exacto de una ejecución incompleta y permite reanudarla. Si falla, mantener el servidor detenido, revisar la sentencia indicada y corregir la causa. El archivo está preparado para volver a ejecutarse; una migración ya completada con el mismo contenido se reconoce y se omite.

Si la copia de archivos ya fue aplicada y se necesita reintentar la migración:

```powershell
cd "C:\Proyectos\Paris-Licoreria-Sistema"
node .\scripts\migrate.js --backup "C:\Respaldos\paris_antes_U004.sql"
```

`database/migrations/U004.sql` es el archivo canónico. Su copia en el repositorio de BD sirve para revisión. No ejecutar `00_ejecutar_todo.sql` sobre datos reales: continúa siendo el script destructivo de reconstrucción del laboratorio.

Las rutinas operativas administran sus propias transacciones y usan READ COMMITTED. Se llaman desde la aplicación sin envolverlas en otra transacción. Los indicadores SQL de operación son controles de coherencia, no reemplazan permisos: una cuenta con acceso administrativo siempre puede cambiar datos o definiciones.

## Configuración después de actualizar

Desarrollo local: conservar `NODE_ENV=development`, la contraseña privada de MySQL y el secreto de sesión existente si ya tiene 32 caracteres o más. El servidor escucha por defecto en `127.0.0.1:3100`; configurar `HOST` expresamente si se necesita acceso desde otros equipos.

Producción mediante Nginx en el mismo equipo:

```dotenv
NODE_ENV=production
PUBLIC_ORIGIN=https://dominio-real-del-sistema
TRUST_PROXY=loopback
HOST=127.0.0.1
```

Nginx debe reenviar Host y X-Forwarded-Proto correctamente, y acceder a Node desde el proxy autorizado. Si el proxy está en otro equipo, configurar su IP o CIDR concreto. No usar `true` ni confianza en todas las redes.

Alternativa de HTTPS directo: configurar `PUBLIC_ORIGIN`, `TLS_CERT_PATH` y `TLS_KEY_PATH` con archivos válidos; no se necesita `TRUST_PROXY` en esa modalidad.

La configuración del dominio, los certificados y el proxy dependen del despliegue real y no pueden deducirse del ZIP. El parche valida la configuración; no obtiene ni instala certificados.

Crear una cuenta MySQL dedicada y usar `database/permisos_minimos.sql` como guía. Actualizar DB_USER y DB_PASSWORD localmente. Estos permisos cubren la aplicación actual; al crear módulos se concederá EXECUTE sobre las rutinas necesarias. No otorgar escritura directa sobre el historial.

## Comprobaciones y arranque

```powershell
node .\scripts\db-check.js
node .\server.js
```

La revisión de datos es de solo lectura. Si detecta fechas antiguas incoherentes o usuarios de demostración, informa cantidades y no inventa valores para corregirlos. Revisar esos casos con sus registros originales.

Si no existe un administrador real, con una cuenta SQL de configuración puede ejecutarse `node scripts/create-admin.js`. Solicita la contraseña de forma oculta y no cambia administradores reales existentes.

El cambio de MemoryStore a MySQL requiere que las personas vuelvan a iniciar sesión; las sesiones antiguas estaban únicamente en memoria.

## Pruebas incluidas y límites

Ejecutadas en esta entrega: 15 pruebas automáticas de aplicación y del ejecutor de migración, todas aprobadas. Se verificó con una conexión simulada la recuperación tras interrumpir DROP/CREATE y el rechazo de otro contenido de migración. Además, aprobaron seis pruebas del instalador: actualización, restauración, conflictos, integridad y rutas protegidas. Incluyen cookies seguras detrás del proxy configurado, autenticación, logout, usuario inactivo, almacenamiento de sesiones entre instancias usando un doble de MySQL, CSRF, errores sin secretos, límites, licencias, idempotencia y análisis de la migración.

La prueba de MySQL real se incluye pero está omitida en este entorno por falta del servidor. Para ejecutarla se utiliza una cuenta de pruebas independiente con permiso para crear una base desechable:

```powershell
$env:PARIS_MYSQL_TEST="1"
$env:TEST_DB_HOST="127.0.0.1"
$env:TEST_DB_PORT="3306"
$env:TEST_DB_USER="cuenta_de_pruebas"
# Definir TEST_DB_PASSWORD localmente sin compartirla.
node --test tests/mysql.test.js
Remove-Item Env:PARIS_MYSQL_TEST
Remove-Item Env:TEST_DB_PASSWORD -ErrorAction SilentlyContinue
```

La prueba crea exclusivamente una base de nombre aleatorio `paris_u004_test_...`, valida preservación, migración repetida, caja, stock, historial y ventas concurrentes, y elimina esa base al terminar. No carga el `.env` de la aplicación.

Pendiente en el equipo Windows: ejecutar esa prueba, comprobar DPAPI con la licencia existente, revisar permisos de ProgramData y realizar la comprobación visual de login con zoom y pantalla baja. El ajuste CSS se incluye, pero no se afirma una validación visual en navegador que no se ejecutó aquí.

## Recuperación

La copia creada por el instalador conserva los archivos anteriores. Para restaurarlos se puede usar `node aplicar-parche.js --restaurar "RUTA_DE_LA_COPIA"`. La restauración comprueba que los archivos no hayan recibido cambios posteriores.

La restauración de archivos no restaura MySQL. Si se necesita revertir la BD, utilizar el respaldo completo durante mantenimiento. No ejecutar una restauración completa después de registrar nuevas operaciones sin evaluar esos datos posteriores.
