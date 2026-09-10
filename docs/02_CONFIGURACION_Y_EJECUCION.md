# Configuración y ejecución

Requisitos: Windows, Node.js 20 o superior, MySQL 8 y PNPM o NPM. Las dependencias están definidas en `package.json` y el lockfile existente. U004 no agrega dependencias de terceros.

Instalar dependencias en una instalación nueva mediante `pnpm install --frozen-lockfile`. Una instalación existente conserva su `node_modules` y `.env`.

La actualización se aplica siguiendo `09_PARCHE_U004.md`: respaldo, servidor detenido, migración U004, comprobación y arranque. La migración necesita una cuenta administrativa SQL. Después se utiliza una cuenta dedicada de permisos mínimos para la aplicación.

Variables: NODE_ENV, HOST, PORT, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y SESSION_SECRET. Para producción se agregan PUBLIC_ORIGIN y TRUST_PROXY, o TLS_CERT_PATH y TLS_KEY_PATH para TLS directo. Revisar `.env.example`.

`node server.js` verifica la conexión y la marca de migración U004 antes de atender peticiones. `node scripts/db-check.js` revisa datos sin modificarlos.

Las contraseñas y claves no se guardan en la documentación ni en Git.
