/** Inicia el servidor local con mediciones. Detener el servidor normal antes de ejecutar este archivo. */
require('dotenv').config({ quiet: true });
const App = require('../src/app');
const start = require('../server');
const database = require('../src/config/database');
const NavigationDiagnostics = require('../src/utils/NavigationDiagnostics');
const navigation = require('../src/config/navigation');
const probe = new NavigationDiagnostics({ paths: [...navigation.modules.map(page => page.href), '/inicio', '/login', '/perfil', '/activar', '/demostracion/componentes'] });

class DiagnosticApp extends App {
  configureApplication() {
    // Se coloca antes de sesiones y rutas para medir la petición completa.
    this.app.use((req, res, next) => probe.middleware(req, res, next));
    super.configureApplication();
    for (const method of ['get', 'set', 'touch']) probe.observeCallback(this.sessionStore, method, 'sesion_mysql_ms');
    probe.observeCallback(this.app, 'render', 'plantilla_ejs_ms');
  }
  configureDependencies() {
    super.configureDependencies();
    probe.observeAsync(this.licenseController.activationService, 'getValidatedActivation', 'licencia_activacion_ms');
    probe.observeAsync(this.authMiddleware.authService, 'getAuthenticatedUser', 'usuario_mysql_ms');
  }
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Este diagnóstico está destinado al equipo local de desarrollo.');
  await start({ Application: DiagnosticApp });
  console.log('DIAGNOSTICO ACTIVO: cambia de modulo varias veces. Los tiempos se muestran en milisegundos.');
}
if (require.main === module) main().catch(async () => {
  console.error('No se pudo iniciar el diagnostico. Comprueba que el servidor normal este detenido y la configuracion sea correcta.');
  await database.getPool().end(); process.exitCode = 1;
});
module.exports = { DiagnosticApp, probe };
