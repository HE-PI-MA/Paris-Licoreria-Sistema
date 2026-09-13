/** Compone Express: seguridad, sesiones, dependencias, rutas y plantillas. App.close libera sus recursos. */
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const runtime = require('./config/runtime');
const database = require('./config/database');
const MySqlSessionStore = require('./services/MySqlSessionStore');
const CsrfMiddleware = require('./middleware/CsrfMiddleware');
const makeRateLimits = require('./middleware/rateLimits');
const safeLog = require('./utils/safeLog');
const TemplateCache = require('./core/TemplateCache');
const PurchaseRepository = require('./repositories/PurchaseRepository');
const PurchaseService = require('./services/PurchaseService');
const PurchaseRoutes = require('./routes/purchase.routes');
const CatalogController = require('./controllers/CatalogController');
const ProductRepository = require('./repositories/ProductRepository');
const ProductService = require('./services/ProductService');
const ProductController = require('./controllers/ProductController');
const ProductRoutes = require('./routes/product.routes');
const SupplierRepository = require('./repositories/SupplierRepository');
const SupplierService = require('./services/SupplierService');
const SupplierController = require('./controllers/SupplierController');
const SupplierRoutes = require('./routes/supplier.routes');

const SystemRepository = require('./repositories/SystemRepository');
const SystemService = require('./services/SystemService');
const SystemController = require('./controllers/SystemController');
const SystemRoutes = require('./routes/system.routes');

const AuthRepository = require('./repositories/AuthRepository');
const AuthService = require('./services/AuthService');
const AuthController = require('./controllers/AuthController');
const AuthRoutes = require('./routes/auth.routes');
const AuthMiddleware = require('./middleware/AuthMiddleware');

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
const WebController = require('./controllers/WebController');
const WebRoutes = require('./routes/web.routes');

class App {
  constructor(options = {}) {
    this.options = options;
    this.config = runtime();
    this.app = express();

    this.configureApplication();
    this.configureDependencies();
    this.configureRoutes();
    this.configureErrors();
  }

  configureApplication() {
    this.app.set('view engine', 'ejs');
    const views = path.join(__dirname, '..', 'views');
    this.app.set('views', views);
    this.templateCache = new TemplateCache(this.app, views, { development: !this.config.production, enabled: this.options.templateCache !== false });
    if (this.config.proxies.length) this.app.set('trust proxy', this.config.proxies);
    this.app.use(helmet({ contentSecurityPolicy: {
      directives: { 'upgrade-insecure-requests': this.config.production ? [] : null }
    } }));
    this.app.use((req, res, next) => {
      req.requestId = crypto.randomUUID();
      res.setHeader('X-Request-Id', req.requestId);
      next();
    });
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
    // Los límites se aplican antes de sesiones, autenticación y validación de licencia.
    this.limits = makeRateLimits();
    this.app.use(this.limits.general);
    this.app.post('/api/auth/login', this.limits.login);
    this.app.post('/api/licencia/activar', this.limits.activation);
    this.app.get('/api/licencia/estado', this.limits.status);
    // La compra acepta hasta 50 filas; los demás endpoints conservan el límite anterior.
    this.app.use('/api/compras', express.json({ limit: '128kb' }));
    this.app.use(express.json({ limit: '16kb' }));
    this.sessionStore = this.options.sessionStore || new MySqlSessionStore(database.getPool());
    this.app.use(session({
      name: 'paris.sid', secret: this.config.sessionSecret,
      store: this.sessionStore, resave: false, saveUninitialized: false, rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: this.config.production, maxAge: 8 * 60 * 60 * 1000 }
    }));
    const csrf = new CsrfMiddleware(this.config.origin);
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      req.csrfToken = () => csrf.token(req, res);
      next();
    });
    // Todas las escrituras de la API pasan por CSRF antes de sus rutas.
    this.app.use('/api', csrf.protect);
  }

  configureDependencies() {
    const systemRepository = new SystemRepository();
    const systemService = new SystemService(systemRepository);
    this.systemController = new SystemController(systemService);

    const authRepository = new AuthRepository();
    const authService = new AuthService(authRepository);
    this.authController = new AuthController(authService);
    this.authMiddleware = new AuthMiddleware(authService);

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
      windowsProtection
    );

    this.licenseController = new LicenseController(
      licenseService,
      activationService
    );

    this.licenseMiddleware = new LicenseMiddleware(activationService);

    this.webController = new WebController(activationService);
    this.purchaseController = new CatalogController(new PurchaseService(this.options.purchaseRepository || new PurchaseRepository(database.getPool())), { label: 'Compras', event: 'PURCHASE_REQUEST_FAILED' });
    this.productController = new ProductController(new ProductService(this.options.productRepository || new ProductRepository(database.getPool())));
    this.supplierController = new SupplierController(new SupplierService(this.options.supplierRepository || new SupplierRepository(database.getPool())));
  }

  configureRoutes() {
    const systemRoutes = new SystemRoutes(this.systemController);
    const authRoutes = new AuthRoutes(this.authController, this.licenseMiddleware, this.authMiddleware);
    const licenseRoutes = new LicenseRoutes(this.licenseController);
    const webRoutes = new WebRoutes(
      this.webController,
      this.licenseMiddleware,
      this.authMiddleware
    );


    this.app.use('/', webRoutes.getRouter());

    this.app.use('/api', systemRoutes.getRouter());
    this.app.use('/api/licencia', licenseRoutes.getRouter());
    this.app.use('/api/auth', authRoutes.getRouter());
    this.app.use('/api/productos', new ProductRoutes(this.productController, this.licenseMiddleware, this.authMiddleware).getRouter());
    this.app.use('/api/compras', new PurchaseRoutes(this.purchaseController, this.licenseMiddleware, this.authMiddleware).getRouter());
    this.app.use('/api/proveedores', new SupplierRoutes(this.supplierController, this.licenseMiddleware, this.authMiddleware).getRouter());
  }

  configureErrors() {
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Ruta no encontrada' });
    });

    this.app.use((error, req, res, next) => {
      if (res.headersSent) return next(error);
      const status = [400, 413, 415].includes(error.status) ? error.status : 500;
      safeLog('HTTP_REQUEST_FAILED', error, req.requestId);
      const messages = { 400: 'Solicitud no valida.', 413: 'La solicitud es demasiado grande.', 415: 'Formato no compatible.', 500: 'Error interno del servidor' };
      res.status(status).json({ error: messages[status], requestId: req.requestId });
    });
  }

  close() { this.templateCache.close(); this.sessionStore.close?.(); }

  getExpressApp() {
    return this.app;
  }
}

module.exports = App;
