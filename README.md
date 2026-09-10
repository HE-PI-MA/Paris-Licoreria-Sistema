# París Licorería — aplicación con parche U004

Aplicación web Node.js / Express / EJS / MySQL, con servidor Windows para licencias Ed25519 y activación DPAPI.

Implementado: activación, login, consulta/cierre de sesión, revalidación del usuario activo, sesiones persistentes en MySQL, protección CSRF y límites de solicitudes. Roles: ADMINISTRADOR y ENCARGADO_VENTA; el middleware se aplica al incorporar los módulos operativos.

Pendiente: dashboard, productos, inventario, proveedores, compras, ventas, caja, administración web de usuarios y reportes. La base de datos V2 ya contiene parte de esas operaciones; todavía no están conectadas a pantallas.

## Actualizar una instalación

Leer `docs/09_PARCHE_U004.md`. Detener el servidor, respaldar MySQL y aplicar la migración U004 antes de iniciar esta versión. La actualización no elimina tablas ni modifica automáticamente operaciones históricas.

La base pasa de 21 tablas de negocio a 23 tablas en total: agrega `sesion_web` y `app_migration`.

## Comandos

- `node --test tests/application.test.js tests/migration-runner.test.js tests/mysql.test.js`: pruebas de aplicación; MySQL se omite salvo activación explícita.
- `node scripts/migrate.js --backup "C:/Respaldos/paris.sql"`: migración sobre la base configurada.
- `node scripts/db-check.js`: revisión de datos existentes, solo lectura.
- `node scripts/create-admin.js`: crear el administrador inicial o reemplazar exclusivamente su registro de demostración; no cambia cuentas reales existentes.
- `node server.js`: iniciar, después de la migración.

También se incluyen los equivalentes `npm test`, `npm run db:migrate`, `npm run db:check`, `npm run admin:create` y `npm start`.

## Configuración

Conservar el `.env` de la instalación. El ejemplo no contiene contraseñas ni claves. El secreto de sesión debe ser privado y tener al menos 32 caracteres. La clave privada de licencias continúa fuera del proyecto.

Para desarrollo local, `NODE_ENV=development`, `HOST=127.0.0.1` y `PORT=3100`.

Para producción, `PUBLIC_ORIGIN` debe indicar el origen HTTPS exacto. Usar certificados TLS en Node o configurar explícitamente el proxy autorizado mediante `TRUST_PROXY`. La configuración incompleta detiene el inicio con un mensaje; no se desactivan cookies seguras para eludir HTTPS.

Las licencias y activaciones existentes conservan su formato y ubicación. Se requieren permisos adecuados del usuario que ejecuta Node sobre ProgramData. El código de activación es repetible en el mismo equipo sin reescribir una activación válida; no se promete consumo global de un solo uso.
