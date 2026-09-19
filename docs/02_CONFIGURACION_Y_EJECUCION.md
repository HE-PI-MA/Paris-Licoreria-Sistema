# Configuración y ejecución

Estado vigente: **U039**.

## Requisitos

- Windows para la instalación operativa vinculada al equipo.
- Node.js 20 o superior.
- MySQL 8.
- PNPM o NPM.

Las dependencias se definen en `package.json` y el lockfile del proyecto. Una instalación existente puede conservar su `node_modules`; una instalación nueva debe instalar dependencias desde el lockfile.

## Variables de entorno

La aplicación utiliza `NODE_ENV`, `HOST`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `SESSION_SECRET`. En despliegues con proxy/TLS pueden intervenir `PUBLIC_ORIGIN`, `TRUST_PROXY`, `TLS_CERT_PATH` y `TLS_KEY_PATH`. Consultar `.env.example` para el formato.

La actualización U039 **no modifica `.env`**.

## Base existente

Antes de actualizar: respaldo de MySQL y servidor detenido. Ejecutar U039 con una cuenta MySQL de instalación:

```powershell
npm run db:core
```

Después revalidar/aplicar `database/permisos_minimos.sql` a la cuenta de ejecución y arrancar normalmente:

```powershell
node server.js
```

`server.js` comprueba conexión y esquema requerido hasta U039 antes de aceptar peticiones.

## Base nueva

Solo para una base MySQL 8 completamente vacía:

```powershell
npm run db:install
npm run admin:create
node server.js
```

`db:install` usa el bootstrap oficial `database/bootstrap/` y aplica las preparaciones versionadas hasta U039. Si detecta tablas existentes aborta; no reconstruye una base de producción.

## Comprobaciones

```powershell
node --test tests/core-u039.test.js
npm test
```

Las pruebas de integración MySQL deben apuntar a una base desechable preparada para pruebas, nunca a producción.

## Mantenimiento opcional

Las claves idempotentes confirmadas pueden limpiarse manualmente después de un período de retención:

```powershell
npm run db:cleanup-operations -- --dias 30
```

El mantenimiento no se ejecuta al iniciar el servidor y no elimina ventas, compras ni movimientos.

Ver `52_NUCLEO_OPERATIVO_U039.md` para el detalle de actualización, historial, Caja, FEFO y devoluciones.
