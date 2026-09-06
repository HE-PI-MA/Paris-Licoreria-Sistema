const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');

const SystemRepository = require('./repositories/SystemRepository');
const SystemService = require('./services/SystemService');
const SystemController = require('./controllers/SystemController');
const SystemRoutes = require('./routes/system.routes');

const AuthRepository = require('./repositories/AuthRepository');
const AuthService = require('./services/AuthService');
const AuthController = require('./controllers/AuthController');
const AuthRoutes = require('./routes/auth.routes');

const LicenseRepository = require('./repositories/LicenseRepository');
const LicenseVerifier = require('./core/LicenseVerifier');
const MachineFingerprint = require('./utils/MachineFingerprint');
const LicenseService = require('./services/LicenseService');
const WindowsProtection = require('./utils/WindowsProtection');
const ActivationRepository = require('./repositories/ActivationRepository');
const ActivationService = require('./services/ActivationService');
const LicenseController = require('./controllers/LicenseController');
const LicenseRoutes = require('./routes/license.routes');
const LicenseMiddleware = require('./middleware/LicenseMiddleware');

class App {
  constructor() {
    this.app = express();

    this.configureApplication();
    this.configureDependencies();
    this.configureRoutes();
    this.configureErrors();
  }

  configureApplication() {
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '..', 'views'));

    this.app.use(helmet());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(session({
      name: 'paris.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000
      }
    }));

    this.app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  configureDependencies() {
    const systemRepository = new SystemRepository();
    const systemService = new SystemService(systemRepository);
    this.systemController = new SystemController(systemService);

    const authRepository = new AuthRepository();
    const authService = new AuthService(authRepository);
    this.authController = new AuthController(authService);

    const licenseRepository = new LicenseRepository();
    const licenseVerifier = new LicenseVerifier();
    const machineFingerprint = new MachineFingerprint();

    const licenseService = new LicenseService(
      licenseRepository,
      licenseVerifier,
      machineFingerprint
    );

    const activationRepository = new ActivationRepository();
    const windowsProtection = new WindowsProtection();

    const activationService = new ActivationService(
      activationRepository,
      licenseService,
      windowsProtection,
      machineFingerprint
    );

    this.licenseController = new LicenseController(
      licenseService,
      activationService
    );

    this.licenseMiddleware = new LicenseMiddleware(activationService);
  }

  configureRoutes() {
    const systemRoutes = new SystemRoutes(this.systemController);
    const authRoutes = new AuthRoutes(this.authController, this.licenseMiddleware);
    const licenseRoutes = new LicenseRoutes(this.licenseController);

    this.app.get('/', (req, res) => {
      res.json({
        application: 'Paris Licoreria Sistema',
        message: 'Servidor funcionando',
        architecture: 'POO'
      });
    });

    this.app.use('/api', systemRoutes.getRouter());
    this.app.use('/api/licencia', licenseRoutes.getRouter());
    this.app.use('/api/auth', authRoutes.getRouter());
  }

  configureErrors() {
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Ruta no encontrada' });
    });

    this.app.use((error, req, res, next) => {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    });
  }

  getExpressApp() {
    return this.app;
  }
}

module.exports = App;
