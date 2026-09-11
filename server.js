require('dotenv').config({ quiet: true });
const fs = require('fs');
const https = require('https');
const App = require('./src/app');
const database = require('./src/config/database');
const runtime = require('./src/config/runtime');
const safeLog = require('./src/utils/safeLog');

/** Application permite ejecutar el mismo arranque con mediciones locales opcionales. */
async function start({ Application = App } = {}) {
  const config = runtime();
  await database.testConnection();
  await database.assertSchema();
  const application = new Application();
  const handler = application.getExpressApp();
  const server = config.tls
    ? https.createServer({ cert: fs.readFileSync(process.env.TLS_CERT_PATH), key: fs.readFileSync(process.env.TLS_KEY_PATH) }, handler)
    : require('http').createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  console.log('Paris Licoreria: ' + (config.origin || 'http://' + config.host + ':' + config.port));
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      application.close();
      await database.getPool().end();
      clearTimeout(timeout);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}
if (require.main === module) start().catch(async error => {
  safeLog('STARTUP_FAILED', error);
  console.error('No se pudo iniciar. Comprueba la configuracion, MySQL y la migracion U004.');
  // Config errors are fixed strings; never print connection/driver messages.
  if (error.name === 'ConfigurationError') console.error(error.message);
  await database.getPool().end();
  process.exitCode = 1;
});
module.exports = start;
